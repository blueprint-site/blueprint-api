import { Client, Databases, Query } from 'node-appwrite';
import { getStaticFile, interpolate, throwIfMissing } from './utils.js';
import { MeiliSearch } from 'meilisearch';

export default async ({ req, res, log }) => {
    throwIfMissing(process.env, [
        'APPWRITE_DATABASE_ID',
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

    const collectionsConfig = [
        { id: '67b2310d00356b0cb53c', row: 'user_id' },
        { id: '67b2310d00356b0cb53c', row: 'authors_uuid' }
    ];

    let allData = [];

    for (const collectionConfig of collectionsConfig) {
        let documents = [];
        let cursor = null;

        do {
            let queries = [
                Query.limit(100)
            ];

            try {
                // Tentative avec contains
                queries.push(Query.equal(collectionConfig.row, [userId]));
            } catch (e) {
                // Fallback vers equal si contains échoue
                log(`"contains" failed, falling back to "equal" for ${collectionConfig.row}`);
                queries.push(Query.equal(collectionConfig.row, userId));
            }

            if (cursor) {
                queries.push(Query.cursorAfter(cursor));
            }

            const response = await databases.listDocuments(
                process.env.APPWRITE_DATABASE_ID,
                collectionConfig.id,
                queries
            );

            if (response.documents.length > 0) {
                cursor = response.documents[response.documents.length - 1].$id;
                documents.push(...response.documents);
            } else {
                log(`No more documents found for user ${userId} in collection ${collectionConfig.id}.`);
                cursor = null;
                break;
            }

            log(`Fetched chunk of ${response.documents.length} documents for user ${userId} from collection ${collectionConfig.id}...`);
        } while (cursor !== null);

        allData.push({
            collectionId: collectionConfig.id,
            row: collectionConfig.row,
            data: documents,

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
