import { Client, Databases } from "node-appwrite";
import dotenv from "dotenv";

// Charger les variables d'environnement
dotenv.config();

// Config Appwrite
const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT)
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);

// IDs des bases source et destination
const SOURCE_DB_ID = process.env.SOURCE_DB_ID;
const TARGET_DB_ID = process.env.TARGET_DB_ID;

async function createAttributeSafely(databases, targetDbId, collectionId, attr) {
    try {
        console.log(`➡️ Création de l'attribut : ${attr.key} (${attr.type})`);

        switch (attr.type) {
            case "string":
                await databases.createStringAttribute(
                    targetDbId,
                    collectionId,
                    attr.key,
                    attr.size || 256,
                    attr.required,
                    attr.default || ""
                );
                break;
            case "integer":
                await databases.createIntegerAttribute(
                    targetDbId,
                    collectionId,
                    attr.key,
                    attr.required,
                    0,
                    null,
                    attr.default || 0
                );
                break;
            case "boolean":
                await databases.createBooleanAttribute(
                    targetDbId,
                    collectionId,
                    attr.key,
                    attr.required,
                    attr.default || false
                );
                break;
            case "float":
                await databases.createFloatAttribute(
                    targetDbId,
                    collectionId,
                    attr.key,
                    attr.required,
                    0,
                    null,
                    attr.default || 0.0
                );
                break;
            case "email":
                await databases.createEmailAttribute(
                    targetDbId,
                    collectionId,
                    attr.key,
                    attr.required,
                    attr.default || undefined
                );
                break;
            case "enum":
                await databases.createEnumAttribute(
                    targetDbId,
                    collectionId,
                    attr.key,
                    attr.elements,
                    attr.required,
                    attr.default || attr.elements[0]
                );
                break;
            case "datetime":
                await databases.createDatetimeAttribute(
                    targetDbId,
                    collectionId,
                    attr.key,
                    attr.required,
                    attr.default || null
                );
                break;
            default:
                console.log(`⚠️ Type d'attribut non pris en charge : ${attr.type}`);
                return;
        }
        console.log(`✅ Attribut ${attr.key} créé avec succès`);
    } catch (err) {
        if (err.message.includes("Attribute with the requested key already exists")) {
            console.log(`ℹ️ Attribut ${attr.key} existe déjà. Ignoré.`);
        } else {
            console.error(`❌ Erreur lors de la création de l'attribut ${attr.key} :`, err.message);
        }
    }
}

async function copyDocumentsSafely(databases, sourceDbId, targetDbId, collectionId) {
    console.log(`📦 Copie des documents de collection ${collectionId}...`);

    // Récupérer les attributs de la collection cible
    const targetAttributes = await databases.listAttributes(targetDbId, collectionId);
    const validAttributes = targetAttributes.attributes.map(attr => attr.key);

    // Récupérer les documents source
    const documents = await databases.listDocuments(sourceDbId, collectionId);

    for (const doc of documents.documents) {
        let cleanedDoc = {};

        // Filtrer et nettoyer uniquement les attributs qui existent dans la collection cible
        for (const [key, value] of Object.entries(doc)) {
            // Ignorer les attributs système
            if (key.startsWith('$')) continue;

            // Vérifier si l'attribut existe dans la collection cible
            if (validAttributes.includes(key)) {
                // Nettoyer et formater la valeur
                if (typeof value === "string" && value.length > 256) {
                    cleanedDoc[key] = value.substring(0, 256);
                } else if (Array.isArray(value)) {
                    // Convertir les tableaux en chaînes pour les attributs string
                    cleanedDoc[key] = value.join(',');
                } else {
                    cleanedDoc[key] = value;
                }
            } else {
                console.log(`ℹ️ Attribut ignoré : ${key} (non présent dans la collection cible)`);
            }
        }

        try {
            await databases.createDocument(
                targetDbId,
                collectionId,
                doc.$id,
                cleanedDoc,
                doc.$permissions
            );
            console.log(`✅ Document ${doc.$id} copié avec succès`);
        } catch (err) {
            console.error(`⚠️ Erreur lors de la copie du document ${doc.$id} :`, err.message);
            console.error('Détails du document nettoyé :', cleanedDoc);
        }
    }
}

async function cloneDatabase() {
    try {
        console.log("🔄 Vérification de la base cible...");
        try {
            await databases.get(TARGET_DB_ID);
            console.log("✅ La base cible existe déjà.");
        } catch (e) {
            console.log("⚠️ Base cible inexistante, création...");
            await databases.create(TARGET_DB_ID, "Test Environment DB");
        }

        console.log("📂 Récupération des collections...");
        const collections = await databases.listCollections(SOURCE_DB_ID);

        for (const collection of collections.collections) {
            console.log(`🔄 Clonage de la collection : ${collection.name} (${collection.$id})`);

            // Vérifier si la collection existe déjà
            try {
                await databases.getCollection(TARGET_DB_ID, collection.$id);
                console.log(`✅ Collection ${collection.name} existe déjà.`);
            } catch (e) {
                console.log(`⚠️ Collection ${collection.name} inexistante, création...`);
                await databases.createCollection(
                    TARGET_DB_ID, collection.$id, collection.name, collection.permissions
                );
            }

            // 🔹 Copier les attributs de la collection
            console.log(`🛠️ Copie des attributs de ${collection.name}...`);
            const attributes = await databases.listAttributes(SOURCE_DB_ID, collection.$id);

            for (const attr of attributes.attributes) {
                await createAttributeSafely(databases, TARGET_DB_ID, collection.$id, attr);
            }

            // 🔹 Copier les documents
            await copyDocumentsSafely(databases, SOURCE_DB_ID, TARGET_DB_ID, collection.$id);
        }

        console.log("✅ Synchronisation complète !");
    } catch (error) {
        console.error("❌ Erreur lors de la synchronisation :", error.message);
    }
}

cloneDatabase();