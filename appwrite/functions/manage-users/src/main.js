// Import the Appwrite Server SDK
const sdk = require('node-appwrite');

// --- Helper Function to Get Team Memberships for a User ---
// Uses the ADMIN client for efficiency
const getUserTeamIds = async (teamsAdmin, userId, relevantTeamIds) => {
  const userTeamIds = [];
  try {
    const memberships = await teamsAdmin.listMemberships(null, [
      sdk.Query.equal('userId', userId),
      sdk.Query.limit(100) // Assuming users aren't in hundreds of teams
    ]);

    memberships.memberships.forEach(membership => {
      if (relevantTeamIds.includes(membership.teamId)) {
        userTeamIds.push(membership.teamId);
      }
    });
  } catch (e) {
    console.error(`Error fetching teams for user ${userId}: ${e.message}`);
  }
  return userTeamIds;
};


// Exported function executed by Appwrite
module.exports = async ({ req, res, log, error }) => {
  // --- Basic Validation: Check Environment Variables ---
  if (
    !process.env.APPWRITE_API_KEY ||                     // Your function's secret API key
    !process.env.APPWRITE_FUNCTION_PROJECT_ID ||        // Provided by Appwrite runtime
    !process.env.ADMIN_TEAM_ID ||                     // Your Admin Team ID
    !process.env.BETA_TESTER_TEAM_ID ||               // Your Beta Tester Team ID
    !process.env.APPWRITE_FUNCTION_API_ENDPOINT       // Provided by Appwrite runtime
  ) {
    error('Function configuration error: Missing environment variables.');
    return res.json({ success: false, message: 'Internal server configuration error.' }, 500);
  }

  const adminTeamId = process.env.ADMIN_TEAM_ID;
  const betaTesterTeamId = process.env.BETA_TESTER_TEAM_ID;
  const relevantTeamIds = [adminTeamId, betaTesterTeamId];

  // --- 1. Initialize Admin Client (using API Key from Env Vars) ---
  // This client performs actions using the function's own permissions (via API key)
  const clientAdmin = new sdk.Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

  const usersAdmin = new sdk.Users(clientAdmin);
  const teamsAdmin = new sdk.Teams(clientAdmin);

  // --- 2. Authorization Check ---
  // REMOVED - We are relying on Appwrite's function-level execute permissions
  // which should be set to allow only members of the Admin team.
  // Log the invoking user ID (provided by Appwrite) for auditing purposes.
  const invokingUserId = req.headers['x-appwrite-user-id'] ?? 'unknown';
  log(`Function invoked by User ID: ${invokingUserId}. (Execution permission assumed granted by Appwrite settings).`);

  // --- 3. Parse Request Body and Determine Action ---
  let action, payload;
  try {
    const body = JSON.parse(req.body || '{}');
    action = body.action;
    payload = body.payload;
    if (!action) throw new Error('Missing "action" in request body.');
  } catch (parseError) {
    error(`Failed to parse request body: ${parseError.message}`);
    return res.json({ success: false, message: 'Invalid request format.' }, 400);
  }

  // --- 4. Execute Action using Admin Client ---
  try {
    log(`Executing action: ${action}`);

    switch (action) {
      case 'listUsers':
        const listQueries = [];
        if (payload?.search) {
          listQueries.push(sdk.Query.search('search', payload.search)); // Generic search term
        }
        const limit = parseInt(payload?.limit, 10) || 25;
        const offset = parseInt(payload?.offset, 10) || 0;
        listQueries.push(sdk.Query.limit(limit));
        listQueries.push(sdk.Query.offset(offset));
        // Add sorting if needed: listQueries.push(sdk.Query.orderDesc('$createdAt'));

        const userList = await usersAdmin.list(listQueries);

        // Enrich users with relevant team memberships
        const enrichedUsers = await Promise.all(
          userList.documents.map(async (user) => {
            const teamIds = await getUserTeamIds(teamsAdmin, user.$id, relevantTeamIds);
            return { ...user, teamIds: teamIds };
          })
        );

        log(`Returning ${enrichedUsers.length} enriched users (Total found: ${userList.total}).`);
        return res.json({ success: true, data: { total: userList.total, documents: enrichedUsers } });

      case 'updateTeamMembership':
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
          } catch (addError) {
              if (addError.code === 409) { // Conflict - already exists
                 log(`User ${userId} already in team ${teamId}. No action needed.`);
                 return res.json({ success: true, message: `User ${userId} is already in the team.` });
              }
              throw addError; // Re-throw other errors
          }
        } else { // Remove
          const membershipsList = await teamsAdmin.listMemberships(teamId, [
            sdk.Query.equal('userId', userId),
            sdk.Query.limit(1)
          ]);

          if (membershipsList.total === 0) {
             log(`User ${userId} not found in team ${teamId}. No action needed for removal.`);
             return res.json({ success: true, message: `User ${userId} was not in team ${teamId}.` });
          }

          const membershipId = membershipsList.memberships[0].$id;
          await teamsAdmin.deleteMembership(teamId, membershipId);
          log(`Removed user ${userId} (membership ${membershipId}) from team ${teamId}`);
          return res.json({ success: true, message: `User ${userId} removed from team ${teamId}.` });
        }

      default:
        log(`Unknown action received: ${action}`);
        return res.json({ success: false, message: `Unknown action: ${action}` }, 400);
    }
  } catch (e) {
    error(`Error executing action "${action}": ${e.message} ${e.stack || ''}`);
    // Consider adding specific checks for Appwrite error codes (e.g., e.code === 404 for User Not Found)
    return res.json({ success: false, message: 'An error occurred while processing your request.' }, 500);
  }
};