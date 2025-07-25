import { Query } from 'node-appwrite';
import { retryOnRateLimit, combineDuplicateMods } from './utils.js';

/**
 * Save or update mods in the database
 * @param {Object} databases - Appwrite Databases instance
 * @param {Array} mods - Array of mod objects
 * @param {string} source - Source platform name
 * @param {Function} log - Logging function
 * @returns {Promise<Object>} Operation results
 */
export async function saveModsWithSource(databases, mods, source, log) {
  let created = 0;
  let updated = 0;
  let errors = 0;

  log(`💾 Saving ${mods.length} mods from ${source}...`);

  for (const mod of mods) {
    try {
      // Check if mod already exists
      const existingMods = await databases.listDocuments('main', 'addons', [
        Query.equal('name', mod.name),
      ]);

      if (existingMods.total > 0) {
        // Update existing mod by merging sources and other arrays
        const existingMod = existingMods.documents[0];
        const updatedSources = Array.from(new Set([...(existingMod.sources || []), source]));
        const updatedAuthors = Array.from(
          new Set([...(existingMod.authors || []), ...(mod.authors || [])])
        );

        await retryOnRateLimit(
          () =>
            databases.updateDocument('main', 'addons', existingMod.$id, {
              ...mod,
              sources: updatedSources,
              authors: updatedAuthors,
              curseforge_id: existingMod.curseforge_id || mod.curseforge_id,
              modrinth_id: existingMod.modrinth_id || mod.modrinth_id,
              downloads: (existingMod.downloads || 0) + (mod.downloads || 0),
            }),
          5,
          1000,
          log
        );

        updated++;
        log(`🔄 Updated mod: ${mod.name}`);
      } else {
        // Create new mod
        await retryOnRateLimit(
          () => databases.createDocument('main', 'addons', 'unique()', mod),
          5,
          1000,
          log
        );

        created++;
        log(`➕ Created mod: ${mod.name}`);
      }
    } catch (error) {
      errors++;
      log(`❌ Error saving mod ${mod.name}: ${error.message}`);
    }
  }

  const results = { created, updated, errors, total: mods.length };
  log(`📊 ${source} save results: ${created} created, ${updated} updated, ${errors} errors`);

  return results;
}

/**
 * Combine and upsert mods to handle duplicates across sources
 * @param {Object} databases - Appwrite Databases instance
 * @param {Array} allMods - Array of all mod objects
 * @param {Function} log - Logging function
 * @returns {Promise<Object>} Operation results
 */
export async function combineAndUpsertMods(databases, allMods, log) {
  log(`🔄 Combining ${allMods.length} mods and handling duplicates...`);

  const combinedMods = combineDuplicateMods(allMods);

  log(`📦 Combined into ${combinedMods.length} unique mods`);

  let created = 0;
  let updated = 0;
  let errors = 0;

  for (const mod of combinedMods) {
    try {
      const existingMods = await databases.listDocuments('main', 'addons', [
        Query.equal('name', mod.name),
      ]);

      if (existingMods.total > 0) {
        const existingMod = existingMods.documents[0];
        await retryOnRateLimit(
          () => databases.updateDocument('main', 'addons', existingMod.$id, mod),
          5,
          1000,
          log
        );
        updated++;
        log(`🔄 Combined mod updated: ${mod.name}`);
      } else {
        await retryOnRateLimit(
          () => databases.createDocument('main', 'addons', 'unique()', mod),
          5,
          1000,
          log
        );
        created++;
        log(`➕ Combined mod created: ${mod.name}`);
      }
    } catch (error) {
      errors++;
      log(`❌ Error upserting combined mod ${mod.name}: ${error.message}`);
    }
  }

  const results = { created, updated, errors, total: combinedMods.length };
  log(`📊 Combined upsert results: ${created} created, ${updated} updated, ${errors} errors`);

  return results;
}

/**
 * Get total count of mods in the database
 * @param {Object} databases - Appwrite Databases instance
 * @param {Function} log - Logging function
 * @returns {Promise<number>} Total count of mods
 */
export async function getModsCount(databases, log) {
  try {
    const result = await databases.listDocuments('main', 'addons', [Query.limit(1)]);

    log(`📊 Total mods in database: ${result.total}`);
    return result.total;
  } catch (error) {
    log(`❌ Error getting mods count: ${error.message}`);
    return 0;
  }
}

/**
 * Get mods by source platform
 * @param {Object} databases - Appwrite Databases instance
 * @param {string} source - Source platform
 * @param {Function} log - Logging function
 * @returns {Promise<Array>} Array of mods from the specified source
 */
export async function getModsBySource(databases, source, log) {
  try {
    const result = await databases.listDocuments('main', 'addons', [
      Query.search('sources', source),
      Query.limit(100),
    ]);

    log(`📊 Found ${result.documents.length} mods from ${source}`);
    return result.documents;
  } catch (error) {
    log(`❌ Error getting mods by source ${source}: ${error.message}`);
    return [];
  }
}
