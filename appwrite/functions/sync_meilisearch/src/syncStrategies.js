import { Query } from 'node-appwrite';
import { getLastSyncTime, updateLastSyncTime } from './syncMetadata.js';

/**
 * Perform a full sync with cleanup of obsolete documents
 * @param {Object} databases - Appwrite Databases instance
 * @param {Object} index - Meilisearch index instance
 * @param {string} collectionName - Appwrite collection name
 * @param {Function} log - Logging function
 * @param {boolean} forceFullSync - Force full sync even if timestamp exists
 * @returns {Object} Sync results { synced, deleted }
 */
export async function syncWithCleanup(databases, index, collectionName, log, forceFullSync = false) {
  const currentTime = new Date().toISOString();
  let totalSynced = 0;
  let totalDeleted = 0;
  
  // Get last sync time for incremental sync
  const lastSyncTime = forceFullSync ? null : await getLastSyncTime(databases, index._uid, log);
  
  if (lastSyncTime) {
    log(`Performing incremental sync since ${lastSyncTime}`);
    
    // Incremental sync: only get documents updated since last sync
    let cursor = null;
    do {
      const queries = [
        Query.greaterThan('$updatedAt', lastSyncTime),
        Query.limit(100)
      ];

      if (cursor) {
        queries.push(Query.cursorAfter(cursor));
      }

      const response = await databases.listDocuments('main', collectionName, queries);

      if (response.documents.length > 0) {
        cursor = response.documents[response.documents.length - 1].$id;
        totalSynced += response.documents.length;
        
        log(`Syncing ${response.documents.length} updated documents...`);
        await index.addDocuments(response.documents, { primaryKey: '$id' });
      } else {
        cursor = null;
        break;
      }
    } while (cursor !== null);
    
    log(`Incremental sync completed: ${totalSynced} documents updated`);
    
  } else {
    log(`Performing full sync (first time or forced)`);
    
    // Full sync: get all documents and clean up obsoletes
    const meiliIds = [];
    let offset = 0;
    const limit = 1000;

    // Step 1: Get all IDs from Meilisearch (for deletion detection)
    while (true) {
      const meilisearchDocuments = await index.getDocuments({
        fields: ['$id'],
        limit,
        offset,
      });

      if (meilisearchDocuments.results.length === 0) break;

      meiliIds.push(...meilisearchDocuments.results.map((doc) => doc.$id));
      offset += limit;
    }

    // Step 2: Sync all documents from Appwrite
    let appwriteIds = [];
    let cursor = null;

    do {
      const queries = [Query.limit(100)];

      if (cursor) {
        queries.push(Query.cursorAfter(cursor));
      }

      const response = await databases.listDocuments('main', collectionName, queries);

      if (response.documents.length > 0) {
        cursor = response.documents[response.documents.length - 1].$id;
        appwriteIds.push(...response.documents.map((doc) => doc.$id));
        totalSynced += response.documents.length;
        
        log(`Syncing chunk of ${response.documents.length} documents...`);
        await index.addDocuments(response.documents, { primaryKey: '$id' });
      } else {
        cursor = null;
        break;
      }
    } while (cursor !== null);

    // Step 3: Delete obsolete documents
    const idsToDelete = meiliIds.filter((id) => !appwriteIds.includes(id));
    totalDeleted = idsToDelete.length;
    
    if (totalDeleted > 0) {
      log(`Found ${totalDeleted} obsolete documents to delete`);
      const deleteBatchSize = 1000;
      for (let i = 0; i < idsToDelete.length; i += deleteBatchSize) {
        const batch = idsToDelete.slice(i, i + deleteBatchSize);
        await index.deleteDocuments(batch);
        log(`Deleted ${batch.length} obsolete documents`);
      }
    }
  }
  
  // Update the sync timestamp
  await updateLastSyncTime(databases, index._uid, currentTime, log);
  
  return { synced: totalSynced, deleted: totalDeleted };
}

/**
 * Perform a simple sync (add/update only, no deletions)
 * @param {Object} databases - Appwrite Databases instance
 * @param {Object} index - Meilisearch index instance
 * @param {string} collectionName - Appwrite collection name
 * @param {Function} log - Logging function
 * @param {boolean} forceFullSync - Force full sync even if timestamp exists
 * @returns {Object} Sync results { synced, deleted }
 */
export async function syncSimple(databases, index, collectionName, log, forceFullSync = false) {
  const currentTime = new Date().toISOString();
  let totalSynced = 0;
  
  // Get last sync time for incremental sync
  const lastSyncTime = forceFullSync ? null : await getLastSyncTime(databases, index._uid, log);
  
  let cursor = null;
  do {
    const queries = [Query.limit(100)];
    
    // Add incremental sync filter if we have a last sync time
    if (lastSyncTime) {
      queries.push(Query.greaterThan('$updatedAt', lastSyncTime));
      log(`Incremental sync: fetching documents updated since ${lastSyncTime}`);
    } else {
      log(`Full sync: fetching all documents`);
    }

    if (cursor) {
      queries.push(Query.cursorAfter(cursor));
    }

    const { documents } = await databases.listDocuments('main', collectionName, queries);

    if (documents.length > 0) {
      cursor = documents[documents.length - 1].$id;
      totalSynced += documents.length;
      
      log(`Syncing chunk of ${documents.length} documents...`);
      await index.addDocuments(documents, { primaryKey: '$id' });
    } else {
      log(`No more documents found.`);
      cursor = null;
      break;
    }
  } while (cursor !== null);
  
  // Update the sync timestamp
  await updateLastSyncTime(databases, index._uid, currentTime, log);

  return { synced: totalSynced, deleted: 0 };
}
