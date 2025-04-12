// src/handlers/authHandler.js

import { ForbiddenError } from '../utils/errors.js';
import { getUserMemberships } from '../services/userService.js';
import { adminTeamId } from '../utils/config.js';

/**
 * Checks if the invoking user is authorized (is an admin).
 * @param {string} userId - The ID of the user invoking the function.
 * @param {object} context - Dependencies needed for authorization.
 * @throws {ForbiddenError} - If the user is not authorized.
 */
export const authorizeRequest = async (
  userId,
) => {
  const teams = await getUserMemberships(userId);
  const isAdmin = teams.some(team => team.$id === adminTeamId);

  if (!isAdmin) {
    throw new ForbiddenError(`User ${userId} is not authorized.`);
  }
};
