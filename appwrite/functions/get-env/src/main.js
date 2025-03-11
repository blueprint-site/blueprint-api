const { throwIfMissing } = require('./utils.js');

module.exports = async ({ req, res, log }) => {
    throwIfMissing(process.env, [
        'APPWRITE_DATABASE_ID',
        'APPWRITE_URL',
        'MEILISEARCH_URL',
        'MEILISEARCH_SEARCH_API_KEY',
    ]);

    res.json(process.env);
};
