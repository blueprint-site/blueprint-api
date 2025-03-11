const { throwIfMissing } = require('./utils.js');

const ALLOWED_ORIGINS_ENV_VAR = process.env.ALLOWED_ORIGINS; // Get the env var

const ALLOWED_ORIGINS = ALLOWED_ORIGINS_ENV_VAR ? ALLOWED_ORIGINS_ENV_VAR.split(',') : []; // Split the string into an array

module.exports = async ({ req, res, log }) => {
    try {
        const origin = req.headers['origin'];
        let corsMessage = null;

        if (ALLOWED_ORIGINS.includes(origin)) {
            res.setHeader('Access-Control-Allow-Origin', origin);
        } else {
            corsMessage = `CORS violation: Origin ${origin} is not allowed.`;
            log(corsMessage); // Added log
            return res.json({ error: 'CORS policy violation', log: corsMessage }); // Changed res.status(403).json to res.json and added log
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

        const response = { ...filteredEnv };
        if (corsMessage) {
            response.log = corsMessage;
        }

        return res.json(response);

    } catch (error) {
        console.error(error);
        return res.json({ error: error.message }); // Changed res.status(500).json to res.json
    }
};
