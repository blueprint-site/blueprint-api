import { Client, Databases, Query } from 'node-appwrite';
import { getStaticFile, interpolate, throwIfMissing } from './utils.js';
import { MeiliSearch } from 'meilisearch';

export default async ({ req, res, log }) => {
  throwIfMissing(process.env, [
    'APPWRITE_DATABASE_ID',
    'APPWRITE_COLLECTION_ID',
    'MEILISEARCH_ENDPOINT',
    'MEILISEARCH_INDEX_NAME',
    'MEILISEARCH_ADMIN_API_KEY',
    'MEILISEARCH_SEARCH_API_KEY',
  ]);

  if (req.method === 'GET') {
    const html = interpolate(getStaticFile('index.html'), {
      MEILISEARCH_ENDPOINT: process.env.MEILISEARCH_ENDPOINT,
      MEILISEARCH_INDEX_NAME: process.env.MEILISEARCH_INDEX_NAME,
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

  const index = meilisearch.index(process.env.MEILISEARCH_INDEX_NAME);

  // 🟢 Étape 1 : Récupérer tous les IDs actuels dans Meilisearch avec pagination
  const meiliIds = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const meilisearchDocuments = await index.getDocuments({
      fields: ["$id"],
      limit,
      offset
    });

    if (meilisearchDocuments.results.length === 0) break;

    meiliIds.push(...meilisearchDocuments.results.map((doc) => doc.$id));
    log(`Fetched ${meiliIds.length} documents from Meilisearch...`);

    offset += limit;
  }

  // 🟢 Étape 2 : Récupérer tous les documents depuis Appwrite avec pagination
  let appwriteIds = [];
  let documents = [];
  let cursor = null;

  do {
    const queries = [Query.limit(100)];

    if (cursor) {
      queries.push(Query.cursorAfter(cursor));
    }

    const response = await databases.listDocuments(
      process.env.APPWRITE_DATABASE_ID,
      process.env.APPWRITE_COLLECTION_ID,
      queries
    );

    if (response.documents.length > 0) {
      cursor = response.documents[response.documents.length - 1].$id;
      appwriteIds.push(...response.documents.map((doc) => doc.$id));
      documents.push(...response.documents);
    } else {
      log(`No more documents found.`);
      cursor = null;
      break;
    }

    log(`Syncing chunk of ${response.documents.length} documents ...`);
    await index.addDocuments(response.documents, { primaryKey: '$id' });
  } while (cursor !== null);

  // 🟢 Étape 3 : Identifier les documents obsolètes à supprimer
  const idsToDelete = meiliIds.filter((id) => !appwriteIds.includes(id));
  log(`Found ${idsToDelete.length} obsolete documents to delete.`);

  // 🟢 Étape 4 : Supprimer les documents obsolètes par lots de 1000
  const deleteBatchSize = 1000;
  for (let i = 0; i < idsToDelete.length; i += deleteBatchSize) {
    const batch = idsToDelete.slice(i, i + deleteBatchSize);
    await index.deleteDocuments(batch);
    log(`Deleted ${batch.length} obsolete documents.`);
  }

  log('Sync finished.');

  return res.text('Sync finished.', 200);
};
