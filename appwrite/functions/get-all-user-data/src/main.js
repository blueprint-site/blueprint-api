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
        // Serve the HTML page (potentially with a search form)
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

    // NEW: Check if a userId is provided in the request
    const userId = req.headers['x-user-id'] || req.body?.userId || req.query?.userId; // Adjust how you get the userId

    if (!userId) {
        return res.json({ error: 'User ID is required' }, 400);
    }

    // 🟢 Étape 1 & 2 (Combined): Récupérer les documents depuis Appwrite pour un utilisateur spécifique
    let documents = [];
    let cursor = null;

    do {
        const queries = [
            Query.limit(100),
            Query.equal('userId', userId), // NEW: Filter by userId.  Assumes 'userId' field exists.
        ];

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
            documents.push(...response.documents);
        } else {
            log(`No more documents found for user ${userId}.`);
            cursor = null;
            break;
        }

        log(`Syncing chunk of ${response.documents.length} documents for user ${userId}...`);
        await index.addDocuments(response.documents, { primaryKey: '$id' }); // Make sure userId is in the documents
    } while (cursor !== null);

    log(`Sync finished for user ${userId}.`);

    // 🟢 Étape 3 & 4 :  No longer needed, as we are only syncing for a specific user.
    // The old logic was for a full sync, which is not needed in this case.

    // 🟢 Étape 5 : Search Meilisearch for the user's data (Example)
    try {
        const searchResults = await index.search('', { // You can add a search query here if needed
            filter: `userId = ${userId}`, // Filter by userId
        });

        return res.json({
            message: `Sync and search finished for user ${userId}.`,
            results: searchResults.hits,
        }, 200);
    } catch (searchError) {
        log(`Meilisearch search error: ${searchError}`);
        return res.json({
            message: `Sync finished for user ${userId}, but search failed.`,
            error: searchError.message,
        }, 500);
    }
};
