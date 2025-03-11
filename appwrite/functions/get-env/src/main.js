const { throwIfMissing } = require('./utils.js');

const ALLOWED_ORIGINS_ENV_VAR = process.env.ALLOWED_ORIGINS; // Get the env var

const ALLOWED_ORIGINS = ALLOWED_ORIGINS_ENV_VAR ? ALLOWED_ORIGINS_ENV_VAR.split(',') : []; // Split the string into an array

module.exports = async ({ req, res, log }) => {
    try {
        const origin = req.headers['origin'];

        if (ALLOWED_ORIGINS.includes(origin)) {
            res.setHeader('Access-Control-Allow-Origin', origin);
        } else {
            return res.status(403).json({ error: 'CORS policy violation' });
        }

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
