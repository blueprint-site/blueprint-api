const { throwIfMissing } = require('./utils.js');

module.exports = async ({ req, res, log }) => {
    try {
        const requiredKeys = [
            'APPWRITE_DATABASE_ID',
            'APPWRITE_URL',
            'MEILISEARCH_URL',
            'MEILISEARCH_SEARCH_API_KEY',
        ];

        throwIfMissing(process.env, requiredKeys);

        const filteredEnv = requiredKeys.reduce((obj, key) => {
            obj[key] = process.env[key];
            return obj;
        }, {});

        return res.json(filteredEnv);

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: error.message });
    }
};
