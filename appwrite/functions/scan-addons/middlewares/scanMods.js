const { Client, Databases, Query } = require('appwrite');
const { searchModrinthMods } = require("../controllers/modrinth");
const { searchCurseForgeMods } = require("../controllers/curseforge");

// Configuration Appwrite
const client = new Client()
    .setEndpoint('https://api.3de-scs.be/v1') // URL de ton instance Appwrite
    .setProject('67ad0767000d58bb6592'); // Remplace par ton Project ID

const databases = new Databases(client);
const databaseId = '67b1dc430020b4fb23e3'; // Remplace par ton Database ID
const collectionId = '67b1dc4b000762a0ccc6'; // Assure-toi que la collection s'appelle bien 'addons'

// Fonction pour introduire un délai avant la prochaine exécution
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Fonction pour essayer de gérer la rate limit
async function retryOnRateLimit(func, maxRetries = 5, initialDelay = 5000) {
    let attempt = 0;
    let delayTime = initialDelay;

    while (attempt < maxRetries) {
        try {
            return await func();
        } catch (error) {
            if (error.code === 429) { // Rate limit exceeded
                attempt++;
                console.log(`❌ Rate limit exceeded. Retrying in ${delayTime / 1000} seconds... (${attempt}/${maxRetries})`);
                await delay(delayTime);
                delayTime *= 2; // Augmenter le délai à chaque tentative
            } else {
                throw error; // Si l'erreur n'est pas liée à la rate limit, la relancer
            }
        }
    }
    throw new Error('Max retries exceeded for rate limit error');
}

// Fonction pour enregistrer les mods avec leur source
async function saveModsWithSource(mods, source) {
    for (const mod of mods) {
        try {
            // Vérifier si le mod existe déjà
            const existingMods = await databases.listDocuments(databaseId, collectionId, [
                Query.equal('name', mod.name)
            ]);

            if (existingMods.total > 0) {
                // Si le mod existe, mettre à jour en fusionnant les sources
                const existingMod = existingMods.documents[0];
                const updatedSources = Array.from(new Set([...(existingMod.sources || []), source]));

                await retryOnRateLimit(() => databases.updateDocument(databaseId, collectionId, existingMod.$id, {
                    ...mod,
                    sources: updatedSources
                }));
                console.log(`🔄 Mod updated: ${mod.name}`);
            } else {
                // Sinon, créer un nouveau document
                await retryOnRateLimit(() => databases.createDocument(databaseId, collectionId, 'unique()', {
                    ...mod,
                    sources: [source]
                }));
                console.log(`➕ Mod created: ${mod.name}`);
            }
        } catch (error) {
            console.error('❌ Error while inserting/updating mod:', error);
        }
    }
}

// Fonction pour combiner les mods identiques
async function combineAndUpsertMods(mods) {
    const combinedMods = [];
    const modMap = new Map();

    mods.forEach(mod => {
        if (modMap.has(mod.name)) {
            const existingMod = modMap.get(mod.name);
            existingMod.sources = Array.from(new Set([...existingMod.sources, ...mod.sources]));
            existingMod.downloads += mod.downloads;
            existingMod.slug = mod.slug;
            existingMod.description = existingMod.description || mod.description;
            existingMod.icon = existingMod.icon || mod.icon;
            existingMod.categories = Array.from(new Set([...existingMod.categories, ...mod.categories]));
            existingMod.minecraft_versions = Array.from(new Set([...(existingMod.minecraft_versions || []), ...(mod.minecraft_versions || [])]));
            existingMod.loaders = Array.from(new Set([...(existingMod.loaders || []), ...(mod.loaders || [])]));
            existingMod.created_at = existingMod.created_at || mod.created_at;
            existingMod.updated_at = existingMod.updated_at || mod.updated_at;
            existingMod.curseforge_raw = JSON.stringify(existingMod.curseforge_raw || mod.curseforge_raw);
            existingMod.modrinth_raw = JSON.stringify(existingMod.modrinth_raw || mod.modrinth_raw);
        } else {
            modMap.set(mod.name, { ...mod });
        }
    });

    modMap.forEach(mod => {
        combinedMods.push(mod);
    });

    // Enregistrer les mods combinés dans Appwrite
    for (const mod of combinedMods) {
        try {
            const existingMods = await databases.listDocuments(databaseId, collectionId, [
                Query.equal('name', mod.name)
            ]);

            if (existingMods.total > 0) {
                const existingMod = existingMods.documents[0];
                await retryOnRateLimit(() => databases.updateDocument(databaseId, collectionId, existingMod.$id, mod));
                console.log(`🔄 Combined mod updated: ${mod.name}`);
            } else {
                await retryOnRateLimit(() => databases.createDocument(databaseId, collectionId, 'unique()', mod));
                console.log(`➕ Combined mod created: ${mod.name}`);
            }
        } catch (error) {
            console.error('❌ Error while inserting/updating combined mod:', error);
        }
    }
}

// Fonction principale pour scanner les mods
async function scanMods() {
    try {
        let offset = 0;
        let iterationCount = 1;
        const maxIterations = 50;
        const allMods = [];

        while (iterationCount <= maxIterations) {
            console.log(`⏳ Iteration ${iterationCount}...`);

            // Récupérer les mods depuis Modrinth et CurseForge
            const [ModrinthMods, CurseForgeMods] = await Promise.all([  // Requête parallèle
                searchModrinthMods(offset).catch((err) => {
                    console.error("❌ Error while fetching Modrinth mods:", err);
                    return [];
                }),
                searchCurseForgeMods(offset).catch((err) => {
                    console.error("❌ Error while fetching CurseForge mods:", err);
                    return [];
                })
            ]);

            // Ajout des mods récupérés à la liste
            const curseForgeModsWithSource = CurseForgeMods.data.map(mod => {
                const allLoaders = [
                    'forge', 'fabric', 'quilt', 'liteloader', 'rift', 'bukkit', 'spigot', 'paper',
                    'fabric-api', 'fml', 'bedrock', 'sponge', 'tconstruct', 'curseforge', 'neoforge'
                ];

                // Extraction des versions Minecraft et des loaders
                const gameVersions = [...new Set(mod.latestFiles?.flatMap(file => file.gameVersions || []) || [])];
                const modLoaders = gameVersions
                    .filter(version => typeof version === 'string' && allLoaders.includes(version.toLowerCase()));

                // Retirer les loaders des catégories et versions Minecraft
                const filteredCategories = mod.categories.filter(category => typeof category === 'string' && !allLoaders.includes(category.toLowerCase()));
                const filteredVersions = gameVersions.filter(version => typeof version === 'string' && !allLoaders.includes(version.toLowerCase()));

                return {
                    project_id: mod.id.toString(),
                    name: mod.name,
                    description: mod.summary,
                    slug: mod.slug,
                    sources: ["CurseForge"],
                    icon: mod.logo?.thumbnailUrl || "",
                    created_at: mod.created_at,
                    updated_at: mod.updated_at,
                    author: mod.authors.map(a => a.name).join(", "),
                    categories: filteredCategories,
                    downloads: mod.downloadCount,
                    curseforge_raw: JSON.stringify(mod),
                    minecraft_versions: filteredVersions,
                    loaders: modLoaders,
                };
            });
            allMods.push(...curseForgeModsWithSource);

            const modrinthModsWithSource = ModrinthMods.map(mod => {
                const allLoaders = [
                    'forge', 'fabric', 'quilt', 'liteloader', 'rift', 'bukkit', 'spigot', 'paper',
                    'fabric-api', 'fml', 'bedrock', 'sponge', 'tconstruct', 'curseforge', 'neoforge'
                ];
                // Extraction des versions Minecraft et des loaders
                const minecraftVersions = [...new Set(mod.categories || [])];
                const loaders = minecraftVersions.filter(version => allLoaders.includes(version.toLowerCase()));

                // Retirer les loaders des catégories et versions Minecraft
                const filteredCategories = mod.categories.filter(category => typeof category === 'string' && !allLoaders.includes(category.toLowerCase()));
                const filteredVersions = minecraftVersions.filter(version => typeof version === 'string' && !allLoaders.includes(version.toLowerCase()));

                return {
                    project_id: mod.project_id,
                    name: mod.title,
                    slug: mod.slug,
                    description: mod.description,
                    sources: ["Modrinth"],
                    icon: mod.icon_url || "",
                    created_at: mod.created_at,
                    updated_at: mod.updated_at,
                    author: mod.author,
                    categories: filteredCategories,
                    downloads: mod.downloads,
                    modrinth_raw: JSON.stringify(mod),
                    minecraft_versions: filteredVersions,
                    loaders: loaders,
                };
            });
            allMods.push(...modrinthModsWithSource);

            // Délai global avant l'enregistrement dans Appwrite
            await delay(5000); // Délai de 5 secondes avant l'enregistrement dans Appwrite

            // Enregistrement des mods avec source
            await saveModsWithSource(curseForgeModsWithSource, 'CurseForge');
            await saveModsWithSource(modrinthModsWithSource, 'Modrinth');

            // Si aucune donnée n'est trouvée, on arrête les itérations
            if (ModrinthMods.length === 0 && CurseForgeMods.data.length === 0) {
                console.log("❌ No more data found. Stopping iterations.");
                break;
            }

            // Augmenter le décalage pour la prochaine itération
            offset += 50;
            iterationCount++;

            // Délai entre les itérations avant l'enregistrement
            await delay(5000); // Délai de 5 secondes entre les itérations
        }

        console.log(`✅ Finished iterations after ${iterationCount - 1} iterations.`);

        // Combinaison et mise à jour des mods
        await combineAndUpsertMods(allMods);

    } catch (error) {
        console.error("❌ Unexpected error while fetching mods:", error);
    }
}

module.exports = { scanMods };
