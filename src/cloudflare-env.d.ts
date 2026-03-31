import type { D1Database } from '@cloudflare/workers-types';

declare global {
  // OpenNext merges Worker bindings; augment with app D1 binding
  interface CloudflareEnv {
    DB?: D1Database;
  }
}

export {};
