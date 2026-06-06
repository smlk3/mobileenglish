/**
 * SyncService — WatermelonDB <-> Supabase synchronization.
 *
 * Uses WatermelonDB's built-in `synchronize()` against two Postgres RPC functions
 * (`pull` / `push`, defined in supabase/sync.sql). Only runs when a user is signed in;
 * guest data stays local until the first sync after login (which pushes it up).
 */
import { synchronize } from '@nozbe/watermelondb/sync';
import { getDatabase } from '../../../entities/database';
import { supabase } from './client';

let syncing = false;

/** Run a full pull+push cycle. No-op if already syncing or not signed in. */
export async function syncDatabase(): Promise<void> {
  if (syncing) return;

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return; // guest mode — nothing to sync

  syncing = true;
  try {
    await synchronize({
      database: getDatabase(),
      // Backend upserts, so we don't need to distinguish created vs updated on push.
      sendCreatedAsUpdated: true,
      pullChanges: async ({ lastPulledAt }) => {
        const { data, error } = await supabase.rpc('pull', {
          last_pulled_at: lastPulledAt ?? 0,
        });
        if (error) throw error;
        return { changes: data.changes, timestamp: data.timestamp };
      },
      pushChanges: async ({ changes }) => {
        const { error } = await supabase.rpc('push', { changes });
        if (error) throw error;
      },
    });
  } finally {
    syncing = false;
  }
}
