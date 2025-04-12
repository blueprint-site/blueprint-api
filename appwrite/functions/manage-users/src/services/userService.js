// src/services/userService.js

import { Query } from 'node-appwrite';
import { getUserRelevantTeamIds } from './teamService.js'; // Still need this helper

/**
 * Lists users, optionally filters, and enriches them with relevant team IDs.
 * @param {object} params - Parameters object.
 * @param {Users} params.usersSdk - Initialized Appwrite Users SDK.
 * @param {Teams} params.teamsSdk - Initialized Appwrite Teams SDK.
 * @param {object} params.payload - Payload containing list options (search, limit, offset).
 * @param {Set<string>} params.relevantTeamIdsSet - Set of relevant team IDs.
 * @returns {Promise<{total: number, users: Array<object>}>} - Object with total count and enriched user list.
 * @throws {Error} - If SDK calls fail or unexpected structure received.
 */
export const listUsersWithTeams = async ({
    usersSdk,
    teamsSdk,
    payload,
    relevantTeamIdsSet,
}) => {
    const listQueries = [];
    const search = payload?.search;
    const limit = parseInt(payload?.limit, 10) || 25;
    const offset = parseInt(payload?.offset, 10) || 0;

    if (search) {
        listQueries.push(Query.search('search', search));
    }
    listQueries.push(Query.limit(limit));
    listQueries.push(Query.offset(offset));

    // Let SDK errors propagate
    const userListResult = await usersSdk.list(listQueries);

    const usersArray = userListResult.users;
    if (!Array.isArray(usersArray)) {
        // Throw an error if the structure is wrong
        console.error("Unexpected user list structure:", userListResult);
        throw new Error('Internal error: Failed to retrieve expected user list data structure.');
    }

    if (usersArray.length === 0) {
        return { total: 0, users: [] }; // Return data structure
    }

    const enrichedUsers = await Promise.all(
        usersArray.map(async (user) => {
            // Let errors from getUserRelevantTeamIds propagate
            const teamIds = await getUserRelevantTeamIds(teamsSdk, relevantTeamIdsSet, user.$id);
            return {
                $id: user.$id,
                name: user.name,
                email: user.email,
                teamIds: teamIds,
            };
        })
    );

    // Return the data structure expected by the handler
    return { total: userListResult.total, users: enrichedUsers };
};