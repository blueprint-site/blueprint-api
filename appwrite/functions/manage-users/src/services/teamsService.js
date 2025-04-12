// src/services/teamsService.js

import { Query } from 'node-appwrite';
import { ConflictError, NotFoundError } from '../utils/errors.js'; // Import custom errors

/**
 * Fetches the IDs of the relevant teams a user belongs to.
 * @param {Teams} teamsSdk - Initialized Appwrite Teams SDK.
 * @param {Set<string>} relevantTeamIdsSet - Set of relevant team IDs.
 * @param {string} userId - The user ID.
 * @returns {Promise<string[]>} - Array of relevant team IDs.
 * @throws {Error} - Throws if the Appwrite SDK call fails unexpectedly.
 */
export const getUserRelevantTeamIds = async (
  teamsSdk,
  relevantTeamIdsSet,
  userId
) => {
  try {
    const response = await teamsSdk.listMemberships(undefined, [
      Query.equal('userId', [userId]),
      Query.limit(100),
    ]);

    const userTeamIds = response.memberships
      .map((membership) => membership.teamId)
      .filter((teamId) => relevantTeamIdsSet.has(teamId));

    return userTeamIds;
  } catch (sdkError) {
    console.error(
      `SDK Error in getUserRelevantTeamIds for ${userId}: ${sdkError.message}`
    );
    throw sdkError;
  }
};

/**
 * Adds or removes a user from a specific relevant team.
 * @param {object} params - Parameters object.
 * @param {Teams} params.teamsSdk - Initialized Appwrite Teams SDK.
 * @param {object} params.payload - Payload with userId, teamId, add flag.
 * @param {string} params.membershipRedirectUrl - URL for createMembership.
 * @returns {Promise<{message: string}>} - Success message object.
 * @throws {ConflictError} - If user already in team when adding.
 * @throws {NotFoundError} - If user not in team when removing.
 * @throws {Error} - For other SDK errors.
 */
export const updateTeamMembership = async ({
  teamsSdk,
  payload,
  membershipRedirectUrl,
}) => {
  const { userId, teamId, add } = payload ?? {};
  if (!userId || !teamId || typeof add !== 'boolean') {
    throw new Error(
      'Internal validation failed: Invalid payload passed to updateTeamMembership service.'
    );
  }

  if (add) {
    try {
      const result = await teamsSdk.createMembership(
        teamId,
        [],
        undefined,
        userId,
        undefined,
        membershipRedirectUrl,
        undefined
      );
      return {
        message: `User ${userId} added to team ${teamId} (Membership ID: ${result.$id}).`,
      };
    } catch (addError) {
      if (addError?.response?.code === 409) {
        // Throw a specific error the handler can catch
        throw new ConflictError(
          `User ${userId} is already a member of team ${teamId}.`
        );
      }
      console.error(
        `SDK Error adding user ${userId} to team ${teamId}: ${addError.message}`
      );
      throw addError; // Re-throw other SDK errors
    }
  } else {
    try {
      const membershipsList = await teamsSdk.listMemberships(teamId, [
        Query.equal('userId', [userId]),
        Query.limit(1),
      ]);

      if (membershipsList.total === 0) {
        // Throw specific error
        throw new NotFoundError(
          `User ${userId} was not found in team ${teamId}.`
        );
      }

      const membershipId = membershipsList.memberships[0].$id;
      await teamsSdk.deleteMembership(teamId, membershipId);
      return {
        message: `User ${userId} removed from team ${teamId} (membership ${membershipId}).`,
      };
    } catch (removeError) {
      // Handle NotFoundError thrown above, or let it propagate
      if (removeError instanceof NotFoundError) {
        throw removeError;
      }
      console.error(
        `SDK Error removing user ${userId} from team ${teamId}: ${removeError.message}`
      );
      throw removeError; // Re-throw other SDK errors
    }
  }
};
