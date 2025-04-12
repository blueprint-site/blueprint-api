// src/main.js
import { config } from './utils/config.js';
import { appwrite } from './utils/appwrite.js';
import { authorizeRequest } from './handlers/authHandler.js';
import {
    parseAndValidateRequest,
    routeAndExecuteAction,
    handleErrorResponse
} from './handlers/requestHandler.js';
const { usersSdk, teamsSdk } = appwrite;
const { adminTeamId, MEMBERSHIP_REDIRECT_URL } = config;

export default async ({ req, res, log, error }) => {
    const start = Date.now();
    const invokingUserId = req.headers['x-appwrite-user-id'] ?? 'unknown';

    log(`Invocation Start. User ID: ${invokingUserId}. Method: ${req.method}. Path: ${req.path}.`);

    try {
        await authorizeRequest(invokingUserId, { teamsSdk, adminTeamId });
        log(`User ${invokingUserId} authorized.`);

        const { action, payload } = parseAndValidateRequest(req);
        log(`Action: ${action}. Payload keys: ${Object.keys(payload || {}).join(', ')}`);

        const resultData = await routeAndExecuteAction({
            action,
            payload,
            services: { usersSdk, teamsSdk },
            config: { membershipRedirectUrl: MEMBERSHIP_REDIRECT_URL }
        });

        const duration = Date.now() - start;
        log(`Action "${action}" executed successfully in ${duration}ms.`);
        return res.json({ success: true, data: resultData });

    } catch (e) {
        return handleErrorResponse({ e, action, res, errorLogger: error, start });
    }
};