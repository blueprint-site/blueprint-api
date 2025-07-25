import { Client, Databases } from 'node-appwrite';
import { getStaticFile, interpolate, throwIfMissing } from './utils.js';
import { MeiliSearch } from 'meilisearch';
import { SYNC_CONFIG, REQUIRED_ENV_VARS } from './config.js';
import { syncIndex } from './indexManager.js';

export default async ({ req, res, log }) => {
  throwIfMissing(process.env, REQUIRED_ENV_VARS);

  if (req.method === 'GET') {
    const html = interpolate(getStaticFile('index.html'), {
      MEILISEARCH_ENDPOINT: process.env.MEILISEARCH_ENDPOINT,
      MEILISEARCH_SEARCH_API_KEY: process.env.MEILISEARCH_SEARCH_API_KEY,
    });

    return res.text(html, 200, { 'Content-Type': 'text/html; charset=utf-8' });
  }

  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(req.headers['x-appwrite-key']);

  const databases = new Databases(client);

  const meilisearch = new MeiliSearch({
    host: process.env.MEILISEARCH_ENDPOINT,
    apiKey: process.env.MEILISEARCH_ADMIN_API_KEY,
  });

  // Check for force full sync parameter
  const forceFullSync = req.body?.forceFullSync === true || req.query?.forceFullSync === 'true';
  
  if (forceFullSync) {
    log('🔄 Force full sync requested - will ignore last sync timestamps');
  }

  const results = {};
  let totalSynced = 0;
  let totalDeleted = 0;

  // Sync all indexes sequentially
  for (const config of SYNC_CONFIG) {
    try {
      const result = await syncIndex(databases, meilisearch, config, log, forceFullSync);
      results[config.indexName] = result;
      totalSynced += result.synced;
      totalDeleted += result.deleted;
      log(`✅ ${config.indexName}: ${result.synced} synced, ${result.deleted} deleted`);
    } catch (error) {
      log(`❌ Error syncing ${config.indexName}: ${error.message}`);
      results[config.indexName] = { error: error.message };
    }
  }

  log(`🎉 All syncs completed! Total: ${totalSynced} synced, ${totalDeleted} deleted`);

  return res.json({
    success: true,
    message: 'All indexes synced',
    syncType: forceFullSync ? 'full' : 'incremental',
    results,
    totals: {
      synced: totalSynced,
      deleted: totalDeleted
    }
  }, 200);
};
