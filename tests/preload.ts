/**
 * Bun test preload — placeholder.
 *
 * Individual test files mock their own dependencies (ioredis, bullmq,
 * voyageai, @supabase/supabase-js) via mock.module() or DI setters.
 *
 * No global mocks needed because:
 * - connection.ts / notificationQueue.ts use lazy initialization
 * - embeddings.ts uses lazy require() for voyageai / @supabase/supabase-js
 */
