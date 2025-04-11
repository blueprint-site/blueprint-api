import { Client, Users, Teams, Query } from 'node-appwrite';

// Helper function (JavaScript compatible)
const getUserTeamIds = async (teamsAdmin, userId, relevantTeamIds) => {
  const userTeamIds = [];
  try {
    const memberships = await teamsAdmin.listMemberships(null, [
      Query.equal('userId', userId),
      Query.limit(100)
    ]);

    memberships.memberships.forEach(membership => {
      if (relevantTeamIds.includes(membership.teamId)) {
        userTeamIds.push(membership.teamId);
      }
    });
  } catch (e) {
    // Access .message directly (standard JS error property)
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
    return res.json({ success: false, message: 'Internal server configuration error.' }, 500);
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
  log(`Function invoked by User ID: ${invokingUserId}. (Execution permission assumed granted by Appwrite settings).`);

  // Parsing request body (JS compatible error handling)
  let action, payload;
  try {
    const rawBody = req.body || '{}';
    const body = JSON.parse(rawBody);
    action = body.action;
    payload = body.payload;
    if (!action) throw new Error('Missing "action" in request body.');
  } catch (parseError) {
    // Remove 'as Error', access .message directly
    error(`Failed to parse request body: ${parseError.message}`);
    return res.json({ success: false, message: 'Invalid request format.' }, 400);
  }

  // Executing action (JS compatible error handling)
  try {
    log(`Executing action: ${action}`);

    switch (action) {
      case 'listUsers': {
        const listQueries = [];
        if (payload?.search) { // Optional chaining is fine in modern JS
          listQueries.push(Query.search('search', payload.search));
        }
        const limit = parseInt(payload?.limit, 10) || 25; // Use optional chaining for default
        const offset = parseInt(payload?.offset, 10) || 0; // Use optional chaining for default
        listQueries.push(Query.limit(limit));
        listQueries.push(Query.offset(offset));

        const userList = await usersAdmin.list(listQueries);

        const enrichedUsers = await Promise.all(
          userList.documents.map(async (user) => {
            const teamIds = await getUserTeamIds(teamsAdmin, user.$id, relevantTeamIds);
            return { ...user, teamIds: teamIds };
          })
        );

        log(`Returning ${enrichedUsers.length} enriched users (Total found: ${userList.total}).`);
        return res.json({ success: true, data: { total: userList.total, documents: enrichedUsers } });
      }

      case 'updateTeamMembership': {
        if (!payload || !payload.userId || !payload.teamId || typeof payload.add !== 'boolean') {
          throw new Error('Missing required payload fields for updateTeamMembership (userId, teamId, add).');
        }
        const { userId, teamId, add } = payload;

        if (!relevantTeamIds.includes(teamId)) {
          throw new Error(`Invalid or disallowed teamId: ${teamId}`);
        }

        if (add) {
          try {
            const result = await teamsAdmin.createMembership(teamId, userId, ['member'], 'https://placeholder.url/team-invite');
            log(`Added user ${userId} to team ${teamId} (Membership ID: ${result.$id})`);
            return res.json({ success: true, message: `User ${userId} added to team ${teamId}.` });
          } catch (addError) { // Remove ': any'
              // Use optional chaining ?. for safe access (good JS practice)
              if (addError?.code === 409) {
                log(`User ${userId} already in team ${teamId}. No action needed.`);
                return res.json({ success: true, message: `User ${userId} is already in the team.` });
              }
              throw addError;
          }
        } else { // Remove
          const membershipsList = await teamsAdmin.listMemberships(teamId, [
            Query.equal('userId', userId),
            Query.limit(1)
          ]);

          if (membershipsList.total === 0) {
            log(`User ${userId} not found in team ${teamId}. No action needed for removal.`);
            return res.json({ success: true, message: `User ${userId} was not in team ${teamId}.` });
          }

          const membershipId = membershipsList.memberships[0].$id;
          await teamsAdmin.deleteMembership(teamId, membershipId);
          log(`Removed user ${userId} (membership ${membershipId}) from team ${teamId}.`);
          return res.json({ success: true, message: `User ${userId} removed from team ${teamId}.` });
        }
      }

      default: {
        log(`Unknown action received: ${action}`);
        return res.json({ success: false, message: `Unknown action: ${action}` }, 400);
      }
    }

  } catch (e) { // Remove ': any'
    // Access .message and .stack directly
    error(`Error executing action "${action}": ${e.message} ${e.stack || ''}`);
    return res.json({ success: false, message: 'An error occurred while processing your request.' }, 500);
  }
};