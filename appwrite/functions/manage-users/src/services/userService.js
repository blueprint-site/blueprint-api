// src/services/userService.js

import { Query } from 'node-appwrite';

/**
 * Lists users, optionally filters, and enriches them with relevant team IDs.
 * @param {object} payload - Payload containing list options (search, limit, offset).
 * @param {Users} usersSdk - Initialized Appwrite Users SDK.
 * @returns {Promise<{total: number, users: Array<object>}>} - Object with total count and enriched user list.
 * @throws {Error} - If SDK calls fail or unexpected structure received.
 */
export const fetchUsers = async ({ usersSdk, payload }) => {
  const listQueries = [];
  const search = payload?.search;
  const limit = parseInt(payload?.limit, 10) || 25;
  const offset = parseInt(payload?.offset, 10) || 0;

  if (search) {
    listQueries.push(Query.search('search', search));
  }
  listQueries.push(Query.limit(limit));
  listQueries.push(Query.offset(offset));

  const userListResult = await usersSdk.list(listQueries);

  const usersArray = userListResult.users;
  if (!Array.isArray(usersArray)) {
    error('Unexpected user list structure:', userListResult);
    throw new Error(
      'Internal error: Failed to retrieve expected user list data structure.'
    );
  }

  if (usersArray.length === 0) {
    return { total: 0, users: [] }; // Return data structure
  }

  const userWithTeamIds = await Promise.all(
    usersArray.map(async (user) => {
      try {
        const teams = await usersSdk.listMemberships(userId);
        return { ...user, teams };
      } catch (sdkError) {
        error(`SDK Error getting teams for ${userId}: ${sdkError.message}`);
        throw sdkError;
      }
    })
  );

  return { total: userListResult.total, users: userWithTeamIds };
};

/**
 * Fetches the teams a user belongs to.
 * @param {Users} usersSdk - Initialized Appwrite User SDK.
 * @param {string} userId - The user ID.
 * @returns {Promise<Membership[]>} - Array of user memberships.
 * @throws {Error} - Throws if the Appwrite SDK call fails unexpectedly.
 */
export const getUserTeams = async (usersSdk, userId) => {
  try {
    const { memberships } = await usersSdk.listMemberships(userId);

    return memberships;
  } catch (sdkError) {
    error(
      `SDK Error in getting teams for ${userId}: ${sdkError.message}`
    );
    throw sdkError;
  }
};
