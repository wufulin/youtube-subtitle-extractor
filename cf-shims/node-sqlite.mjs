/**
 * Stub for `node:sqlite` when bundling for Cloudflare Workers.
 * Undici may reference sqlite cache store; it is not used in this Worker at runtime.
 * @see https://developers.cloudflare.com/workers/wrangler/configuration/#module-aliasing
 */

export class DatabaseSync {
  constructor() {
    throw new Error(
      'node:sqlite is not available in Cloudflare Workers (undici SqliteCacheStore should not be used)',
    );
  }
}

export class StatementSync {
  constructor() {
    throw new Error('node:sqlite is not available in Cloudflare Workers');
  }
}
