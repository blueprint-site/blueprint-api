// src/handlers/authHandler.js

import { ForbiddenError } from '../utils/errors.js';
import { getUserRelevantTeamIds } from '../services/teamsService.js';

/**
 * Checks if the invoking user is authorized (is an admin).
 * @param {string} invokingUserId - The ID of the user invoking the function.
 * @param {object} context - Dependencies needed for authorization.
 * @param {Teams} context.teamsSdk - Initialized Appwrite Teams SDK.
 * @param {Set<string>} context.relevantTeamIdsSet - Set of relevant team IDs.
 * @param {string} context.adminTeamId - The ID of the admin team.
 * @throws {ForbiddenError} - If the user is not authorized.
 */
export const authorizeRequest = async (invokingUserId, { teamsSdk, relevantTeamIdsSet, adminTeamId }) => {
    const invokerTeams = await getUserRelevantTeamIds(teamsSdk, relevantTeamIdsSet, invokingUserId);

    if (!invokerTeams.includes(adminTeamId)) {
        throw new ForbiddenError(`User ${invokingUserId} is not authorized.`);
    }
    // If no error is thrown, the user is considered authorized.
};