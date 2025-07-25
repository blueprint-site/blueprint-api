/**
 * Configuration for all sync operations
 */
export const SYNC_CONFIG = [
  { indexName: 'addons', collectionName: 'addons', hasObsoleteCleanup: false },
  { indexName: 'blogs', collectionName: 'blogs', hasObsoleteCleanup: true },
  { indexName: 'blog_tags', collectionName: 'blog_tags', hasObsoleteCleanup: true },
  { indexName: 'schematics', collectionName: 'schematics', hasObsoleteCleanup: true },
  { indexName: 'schematics_tags', collectionName: 'schematics_tags', hasObsoleteCleanup: true },
];

/**
 * Environment variables required for the sync function
 */
export const REQUIRED_ENV_VARS = [
  'APPWRITE_FUNCTION_API_ENDPOINT',
  'APPWRITE_FUNCTION_PROJECT_ID',
  'MEILISEARCH_ENDPOINT',
  'MEILISEARCH_ADMIN_API_KEY',
  'MEILISEARCH_SEARCH_API_KEY',
];
