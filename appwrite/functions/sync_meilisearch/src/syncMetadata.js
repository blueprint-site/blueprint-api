import { Query } from 'node-appwrite';

/**
 * Get the last sync timestamp for a specific index
 * @param {Object} databases - Appwrite Databases instance
 * @param {string} indexName - Name of the Meilisearch index
 * @param {Function} log - Logging function
 * @returns {string|null} Last sync timestamp or null if first time
 */
export async function getLastSyncTime(databases, indexName, log) {
  try {
    const result = await databases.listDocuments('main', 'sync_metadata', [
      Query.equal('index_name', indexName),
      Query.limit(1)
    ]);
    
    if (result.documents.length > 0) {
      const lastSync = result.documents[0].last_sync_time;
      log(`Last sync for ${indexName}: ${lastSync}`);
      return lastSync;
    }
  } catch (error) {
    if (error.code === 404) {
      log(`sync_metadata collection not found. Will create it.`);
      // Collection doesn't exist yet, will be created on first sync
    } else {
      log(`Error fetching last sync time: ${error.message}`);
    }
  }
  
  return null; // First time sync
}

/**
 * Update the last sync timestamp for a specific index
 * @param {Object} databases - Appwrite Databases instance
 * @param {string} indexName - Name of the Meilisearch index
 * @param {string} timestamp - ISO timestamp of the sync
 * @param {Function} log - Logging function
 */
export async function updateLastSyncTime(databases, indexName, timestamp, log) {
  try {
    // Try to find existing record
    const existing = await databases.listDocuments('main', 'sync_metadata', [
      Query.equal('index_name', indexName),
      Query.limit(1)
    ]);
    
    if (existing.documents.length > 0) {
      // Update existing record
      await databases.updateDocument('main', 'sync_metadata', existing.documents[0].$id, {
        last_sync_time: timestamp,
        updated_at: new Date().toISOString()
      });
      log(`Updated sync timestamp for ${indexName}`);
    } else {
      // Create new record
      await databases.createDocument('main', 'sync_metadata', 'unique()', {
        index_name: indexName,
        last_sync_time: timestamp,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      log(`Created sync metadata record for ${indexName}`);
    }
  } catch (error) {
    log(`Error updating sync timestamp: ${error.message}`);
    throw error;
  }
}
