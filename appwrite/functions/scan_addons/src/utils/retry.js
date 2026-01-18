import { delay } from './utils.js';

export async function withRetry(fn, options = {}) {
  const {
    retries = 3,
    delay: initialDelay = 1000,
    log = console.log,
    shouldRetry = (error) => true,
  } = options;

  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (!shouldRetry(error) || i === retries - 1) {
        throw error;
      }

      const backoffDelay = initialDelay * Math.pow(2, i);
      log(`🔁 Retrying in ${backoffDelay}ms...`);
      await delay(backoffDelay);
    }
  }
}
