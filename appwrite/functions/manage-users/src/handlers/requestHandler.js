// src/handlers/requestHandler.js

import { HttpError, BadRequestError } from '../utils/errors.js';
import { listUsersWithTeams } from '../services/userService.js';
import { updateTeamMembership } from '../services/teamService.js';

/**
 * Parses the request body and validates the basic action/payload structure.
 * @param {object} req - The Appwrite request object.
 * @returns {{action: string, payload: object}} - The validated action and payload.
 * @throws {BadRequestError} - If parsing fails or structure is invalid.
 * @throws {SyntaxError} - If JSON parsing fails (will be caught by main handler).
 */
export function parseAndValidateRequest(req) {
  let requestPayload;
  if (typeof req.body === 'string' && req.body.trim().length > 0) {
    requestPayload = JSON.parse(req.body); // Can throw SyntaxError
  } else if (typeof req.body === 'object' && req.body !== null) {
    requestPayload = req.body;
  } else {
    throw new BadRequestError('Request body is empty or invalid.');
  }

  if (!requestPayload || typeof requestPayload !== 'object') {
    throw new BadRequestError('Parsed request body is not a valid object.');
  }

  const { action, payload } = requestPayload;

  if (!action) {
    throw new BadRequestError('Invalid request: "action" is required.');
  }
  if (typeof payload !== 'object' || payload === null) {
    throw new BadRequestError('Invalid request: "payload" object is required.');
  }

  return { action, payload };
}

/**
 * Routes the action to the appropriate service and executes it.
 * @param {object} context - Contains action, payload, and dependencies.
 * @param {string} context.action - The action to perform.
 * @param {object} context.payload - The payload for the action.
 * @param {object} context.services - Object containing SDK instances { usersSdk, teamsSdk }.
 * @param {object} context.config - Relevant configuration { relevantTeamIdsSet, membershipRedirectUrl }.
 * @returns {Promise<any>} - The result data from the executed service.
 * @throws {BadRequestError} - If action is unknown or payload invalid for the action.
 * @throws {Error} - Propagates errors from services.
 */
export async function routeAndExecuteAction({
  action,
  payload,
  services,
  config,
}) {
  const { usersSdk, teamsSdk } = services;
  const { relevantTeamIdsSet, membershipRedirectUrl } = config;

  switch (action) {
    case 'listUsers':
      return await listUsersWithTeams({
        usersSdk,
        teamsSdk,
        payload,
        relevantTeamIdsSet,
      });

    case 'updateTeamMembership':
      if (
        !payload.userId ||
        !payload.teamId ||
        typeof payload.add !== 'boolean'
      ) {
        throw new BadRequestError(
          'Invalid updateTeamMembership payload: Requires userId, teamId, add.'
        );
      }
      if (!relevantTeamIdsSet.has(payload.teamId)) {
        throw new BadRequestError(
          `Operation not allowed for team ID ${payload.teamId}.`
        );
      }
      return await updateTeamMembership({
        teamsSdk,
        payload,
        membershipRedirectUrl,
      });

    default:
      throw new BadRequestError(`Unknown action: ${action}`);
  }
}

/**
 * Formats and sends an error response.
 * @param {object} context - Contains error details and response objects.
 * @param {Error} context.e - The caught error.
 * @param {string} context.action - The action being attempted (for logging).
 * @param {object} context.res - The Appwrite response object.
 * @param {Function} context.errorLogger - The error logging function.
 * @param {number} context.start - The timestamp when the request started.
 */
export function handleErrorResponse({ e, action, res, errorLogger, start }) {
  const duration = Date.now() - start;
  let statusCode = 500;
  let message = 'An internal error occurred.';

  if (e instanceof HttpError) {
    statusCode = e.statusCode;
    message = e.message;
  } else if (e instanceof SyntaxError && e.message.includes('JSON')) {
    statusCode = 400;
    message = 'Invalid JSON format in request body.';
  }

  errorLogger(
    `Action "${action}" failed after ${duration}ms. Status: ${statusCode}. Error: ${e.message}. Stack: ${e.stack || 'N/A'}`
  );

  return res.json({ success: false, message: message }, statusCode);
}
