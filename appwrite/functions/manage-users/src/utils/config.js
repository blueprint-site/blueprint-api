// src/utils/config.js

// Read Environment Variables
const apiKey = process.env.APPWRITE_API_KEY;
const projectId = process.env.APPWRITE_FUNCTION_PROJECT_ID;
const adminTeamId = process.env.ADMIN_TEAM_ID;
const betaTesterTeamId = process.env.BETA_TESTER_TEAM_ID;
const endpoint = process.env.APPWRITE_FUNCTION_API_ENDPOINT;

// Validate required variables
const requiredEnvVars = {
  APPWRITE_API_KEY: apiKey,
  APPWRITE_FUNCTION_PROJECT_ID: projectId,
  ADMIN_TEAM_ID: adminTeamId,
  BETA_TESTER_TEAM_ID: betaTesterTeamId,
  APPWRITE_FUNCTION_API_ENDPOINT: endpoint,
};

const missingVars = Object.entries(requiredEnvVars)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missingVars.length > 0) {
  // Throw an error during initialization if config is missing
  // This prevents the function from starting in an invalid state
  throw new Error(
    `Function configuration error: Missing environment variables: ${missingVars.join(', ')}`
  );
}

// Define constants
const MEMBERSHIP_REDIRECT_URL = 'https://blueprint-create.com'; // Or read from env var if needed
const relevantTeamIdsSet = new Set([adminTeamId, betaTesterTeamId]);

// Export configuration values
export const config = {
  apiKey,
  projectId,
  endpoint,
  adminTeamId,
  betaTesterTeamId,
  relevantTeamIdsSet,
  MEMBERSHIP_REDIRECT_URL,
};
