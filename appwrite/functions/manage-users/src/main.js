import { Client, Users, Teams, Query } from 'node-appwrite';

const getUserTeamIds = async (teamsAdmin, userId, relevantTeamIds) => {
  const userTeamIds = [];
  try {
    const memberships = await teamsAdmin.listMemberships(null, [
      Query.equal('userId', userId),
      Query.limit(100),
    ]);
    memberships.memberships.forEach((membership) => {
      if (relevantTeamIds.includes(membership.teamId)) {
        userTeamIds.push(membership.teamId);
      }
    });
  } catch (e) {
    console.error(`Error fetching teams for user ${userId}: ${e.message}`);
  }
  return userTeamIds;
};

export default async ({ req, res, log, error }) => {
  // Env var check (remains the same)
  if (
    !process.env.APPWRITE_API_KEY ||
    !process.env.APPWRITE_FUNCTION_PROJECT_ID ||
    !process.env.ADMIN_TEAM_ID ||
    !process.env.BETA_TESTER_TEAM_ID ||
    !process.env.APPWRITE_FUNCTION_API_ENDPOINT
  ) {
    error('Function configuration error: Missing environment variables.');
    return res.json(
      { success: false, message: 'Internal server configuration error.' },
      500
    );
  }

  const adminTeamId = process.env.ADMIN_TEAM_ID;
  const betaTesterTeamId = process.env.BETA_TESTER_TEAM_ID;
  const relevantTeamIds = [adminTeamId, betaTesterTeamId];

  // Client Init (remains the same)
  const clientAdmin = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

  const usersAdmin = new Users(clientAdmin);
  const teamsAdmin = new Teams(clientAdmin);

  const invokingUserId = req.headers['x-appwrite-user-id'] ?? 'unknown';
  log(`Function invoked by User ID: ${invokingUserId}.`);

  // --- 3. Handle Request Body (Check if Pre-Parsed) ---
  let action, payload;
  let body = {};

  try {
    if (typeof req.body === 'string' && req.body.trim().length > 0) {
      log('Request body received as string, parsing...');
      body = JSON.parse(req.body);
    } else if (typeof req.body === 'object' && req.body !== null) {
      log('Request body received as object (pre-parsed).');
      body = req.body;
    } else {
      log(`Request body is empty or has unexpected type: ${typeof req.body}`);
    }

    action = body.action;
    payload = body.payload;

    if (!action) {
      throw new Error('Missing "action" in request body.');
    }
    log(`Action: ${action}, Payload: ${JSON.stringify(payload)}`);
  } catch (handleBodyError) {
    error(`Failed to handle request body: ${handleBodyError.message}`);
    error(`Raw request body type: ${typeof req.body}, value: ${req.body}`);
    return res.json(
      { success: false, message: 'Invalid request format.' },
      400
    );
  }

  try {
    log(`Executing action: ${action}`);

    switch (action) {
      case 'listUsers': {
        const listQueries = [];
        if (payload?.search) {
          listQueries.push(Query.search('search', payload.search));
        }
        const limit = parseInt(payload?.limit, 10) || 25;
        const offset = parseInt(payload?.offset, 10) || 0;
        listQueries.push(Query.limit(limit));
        listQueries.push(Query.offset(offset));

        // --- Execute the list call ---
        const userList = await usersAdmin.list(listQueries);

        // --- Log the raw response for debugging ---
        log(`Response from users.list: ${JSON.stringify(userList)}`);

        // --- Safely access the user array (handles SDK versions) ---
        // Check for 'users' first (newer SDK), then 'documents' (older SDK)
        const usersArray = userList.users || userList.documents;

        // --- Validate that we have an array ---
        if (!Array.isArray(usersArray)) {
          error(
            `Unexpected response structure from users.list. Expected 'users' or 'documents' array.`
          );
          error(`Received: ${JSON.stringify(userList)}`); // Log the bad structure
          // Return an error or potentially an empty list
          return res.json(
            {
              success: false,
              message:
                'Internal error: Failed to retrieve user list data structure.',
            },
            500
          );
        }

        log(
          `Found ${usersArray.length} users in this batch (Total: ${userList.total}). Enriching...`
        );

        // --- Enrich users (now using the safe 'usersArray') ---
        const enrichedUsers = await Promise.all(
          usersArray.map(async (user) => {
            // Line 99 should now be safe
            const teamIds = await getUserTeamIds(
              teamsAdmin,
              user.$id,
              relevantTeamIds
            );
            return { ...user, teamIds: teamIds };
          })
        );

        log(`Returning ${enrichedUsers.length} enriched users.`);
        return res.json({
          success: true,
          data: { total: userList.total, documents: enrichedUsers },
        });
        // Note: We still return the data under 'documents' key for consistency
        // with the frontend hook expectation, even if we read from userList.users.
      }

      case 'updateTeamMembership': {
        if (
          !payload?.userId ||
          !payload.teamId ||
          typeof payload.add !== 'boolean'
        ) {
          throw new Error(/*...*/);
        }
        const { userId, teamId, add } = payload;
        if (!relevantTeamIds.includes(teamId)) {
          throw new Error(/*...*/);
        }

        if (add) {
          try {
            const membershipObj = await teamsAdmin.createMembership(
              teamId,
              ['member'],
              null,
              userId,
              null,
              'https://blueprint-create.com'
            );
            const result = await teamsAdmin.createMembership(membershipObj)
            log(
              `Added user ${userId} to team ${teamId} (Membership ID: ${result.$id})`
            );
            return res.json({
              success: true,
              message: `User ${userId} added to team ${teamId}.`,
            });
          } catch (addError) {
            if (addError?.code === 409) {
              log(
                `User ${userId} already in team ${teamId}. No action needed.`
              );
              return res.json({
                success: true,
                message: `User ${userId} is already in the team.`,
              });
            }
            throw addError;
          }
        } else {
          const membershipsList = await teamsAdmin.listMemberships(teamId, [
            Query.equal('userId', userId),
            Query.limit(1),
          ]);

          if (membershipsList.total === 0) {
            log(
              `User ${userId} not found in team ${teamId}. No action needed for removal.`
            );
            return res.json({
              success: true,
              message: `User ${userId} was not in team ${teamId}.`,
            });
          }

          const membershipId = membershipsList.memberships[0].$id;
          await teamsAdmin.deleteMembership(teamId, membershipId);
          log(
            `Removed user ${userId} (membership ${membershipId}) from team ${teamId}.`
          );
          return res.json({
            success: true,
            message: `User ${userId} removed from team ${teamId}.`,
          });
        }
      }

      default: {
        log(`Unknown action received: ${action}`);
        return res.json(
          { success: false, message: `Unknown action: ${action}` },
          400
        );
      }
    }
  } catch (e) {
    error(`Error executing action "${action}": ${e.message} ${e.stack || ''}`);
    return res.json(
      {
        success: false,
        message: 'An error occurred while processing your request.',
      },
      500
    );
  }
};
