import { Client, Databases, Query } from 'node-appwrite';

export default async function (req, res) {
    const client = new Client()
        .setEndpoint(process.env.APPWRITE_ENDPOINT)
        .setProject(process.env.APPWRITE_PROJECT_ID)
        .setKey(process.env.APPWRITE_API_KEY);

    const databases = new Databases(client);
    const storage = new Storage(client);

    const SOURCE_DB_ID = "67b1dc430020b4fb23e3";  // Remplace avec l'ID de ta base source
    const TARGET_DB_ID = "67e6ec5c0032a90a14e6";  // ID de la base cible

    try {
        // Vérifier si la base de destination existe
        let existingDB;
        try {
            existingDB = await databases.get(TARGET_DB_ID);
        } catch (e) {
            console.log("Base inexistante, création...");
        }

        if (!existingDB) {
            await databases.create(TARGET_DB_ID, "Test Environment DB");
        }

        // Étape 1 : Récupérer toutes les collections
        const collections = await databases.listCollections(SOURCE_DB_ID);

        for (const collection of collections.collections) {
            console.log(`Clonage de la collection : ${collection.name}`);

            // Vérifier si la collection existe déjà
            let existingCollection;
            try {
                existingCollection = await databases.getCollection(TARGET_DB_ID, collection.$id);
            } catch (e) {
                console.log(`Collection ${collection.name} inexistante, création...`);
            }

            if (!existingCollection) {
                // Créer la collection avec les mêmes paramètres
                await databases.createCollection(
                    TARGET_DB_ID,
                    collection.$id,
                    collection.name,
                    collection.permissions
                );

                // Copier les indexes
                const indexes = collection.indexes || [];
                for (const index of indexes) {
                    await databases.createIndex(TARGET_DB_ID, collection.$id, index.$id, index.type, index.attributes);
                }

                console.log(`Collection ${collection.name} créée.`);
            }

            // Étape 2 : Copier tous les documents
            const documents = await databases.listDocuments(SOURCE_DB_ID, collection.$id);
            for (const doc of documents.documents) {
                await databases.createDocument(
                    TARGET_DB_ID,
                    collection.$id,
                    doc.$id,
                    doc,  // Contenu du document
                    doc.permissions
                );
            }
            console.log(`Documents copiés pour ${collection.name}`);
        }

        // Étape 3 : Copier les fichiers du Storage
        const buckets = await storage.listBuckets();
        for (const bucket of buckets.buckets) {
            console.log(`Clonage du bucket : ${bucket.name}`);

            let existingBucket;
            try {
                existingBucket = await storage.getBucket(bucket.$id);
            } catch (e) {
                console.log(`Bucket ${bucket.name} inexistant, création...`);
            }

            if (!existingBucket) {
                await storage.createBucket(
                    bucket.$id,
                    bucket.name,
                    bucket.permissions,
                    bucket.fileSecurity
                );
            }

            // Copier les fichiers du bucket
            const files = await storage.listFiles(bucket.$id);
            for (const file of files.files) {
                const fileData = await storage.getFileDownload(bucket.$id, file.$id);
                await storage.createFile(
                    bucket.$id,
                    file.$id,
                    fileData,  // Contenu du fichier
                    file.permissions
                );
            }
            console.log(`Fichiers copiés pour ${bucket.name}`);
        }

        return res.json({ success: true, message: "Base et storage synchronisés avec succès !" });
    } catch (error) {
        console.error(error);
        return res.json({ success: false, message: "Erreur lors de la synchronisation complète." });
    }
}
