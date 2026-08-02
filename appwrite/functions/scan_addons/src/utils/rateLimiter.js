import { delay } from '../utils.js';

/**
 * Creates a rate limiter that ensures a minimum delay between function calls.
 * @param {number} minDelay - The minimum delay in milliseconds between calls.
 * @returns {Function} An async function that waits for the rate limit to be met before resolving.
 */
export function createRateLimiter(minDelay) {
  let lastCall = 0;

  return async function waitForRateLimit() {
    const now = Date.now();
    const timeSinceLastCall = now - lastCall;

    if (timeSinceLastCall < minDelay) {
      const delayTime = minDelay - timeSinceLastCall;
      await delay(delayTime);
    }

    lastCall = Date.now();
  };
}
