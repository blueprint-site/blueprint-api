import {throwIfMissing } from './utils.js';

export default async ({ req, res, log }) => {
    throwIfMissing(process.env, [
        'APPWRITE_DATABASE_ID',
        'APPWRITE_URL',
        'MEILISEARCH_URL',
        'MEILISEARCH_SEARCH_API_KEY',
    ]);

    res.json(process.env);
};
