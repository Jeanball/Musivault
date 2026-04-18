/**
 * Automatic Migration Runner
 * 
 * Tracks executed migrations in MongoDB and only runs pending ones.
 * Admins don't need to do anything - migrations run automatically on startup.
 * 
 * Migration types:
 * - 'blocking': Runs before server starts (schema changes, index updates)
 * - 'background': Runs after server starts (data backfills, price fetches)
 */

import Migration from '../models/Migration';
import { migrateIndexes } from './migrate-indexes';
import { cleanupArtistNames } from './cleanup-artist-names';
import { migrateAlbumData } from './migrate-album-data';

interface MigrationDefinition {
  id: string;
  description: string;
  type: 'blocking' | 'background';
  run: () => Promise<string>;
}

/**
 * Registry of all migrations, ordered chronologically.
 * New migrations should be added at the bottom of this array.
 * 
 * IMPORTANT: Never remove or rename a migration ID once it's been released.
 * If a migration needs to be re-run, create a new migration entry.
 */
const MIGRATIONS: MigrationDefinition[] = [
  {
    id: '2026-03-15_migrate-indexes',
    description: 'Update database indexes for sparse unique constraints',
    type: 'blocking',
    run: async () => {
      await migrateIndexes();
      return 'Indexes updated';
    }
  },
  {
    id: '2026-03-15_cleanup-artist-names',
    description: 'Remove numeric suffixes from artist names (e.g. "Artist (2)" -> "Artist")',
    type: 'blocking',
    run: async () => {
      await cleanupArtistNames();
      return 'Artist names cleaned';
    }
  },
  {
    id: '2026-03-28_album-data-backfill',
    description: 'Backfill missing album metadata, format details, and price cache from Discogs',
    type: 'background',
    run: async () => {
      await migrateAlbumData();
      return 'Album data backfill complete';
    }
  },
];

/**
 * Run all pending migrations automatically.
 * Called on server startup after database connection.
 * 
 * - Blocking migrations run sequentially before the server starts accepting requests.
 * - Background migrations are launched after blocking ones complete (fire-and-forget).
 */
export async function runPendingMigrations(): Promise<void> {
  const executed = await Migration.find({}, 'migrationId status').lean();
  const executedMap = new Map(executed.map(m => [m.migrationId, m.status]));

  const pending = MIGRATIONS.filter(m => {
    const status = executedMap.get(m.id);
    // Run if never executed, or if it previously failed
    return !status || status === 'failed';
  });

  if (pending.length === 0) {
    console.log('No pending migrations.');
    return;
  }

  const blockingMigrations = pending.filter(m => m.type === 'blocking');
  const backgroundMigrations = pending.filter(m => m.type === 'background');

  console.log(`Found ${pending.length} pending migration(s): ${blockingMigrations.length} blocking, ${backgroundMigrations.length} background`);

  // Run blocking migrations sequentially
  for (const migration of blockingMigrations) {
    await executeMigration(migration);
  }

  // Launch background migrations (non-blocking, fire-and-forget)
  if (backgroundMigrations.length > 0) {
    console.log(`Launching ${backgroundMigrations.length} background migration(s)...`);
    for (const migration of backgroundMigrations) {
      activeBackgroundMigrations++;
      executeMigration(migration).catch(err => {
        console.error(`Background migration ${migration.id} error:`, err);
      }).finally(() => {
        activeBackgroundMigrations--;
      });
    }
  }
}

let activeBackgroundMigrations = 0;

export function isBackgroundMigrationRunning(): boolean {
  return activeBackgroundMigrations > 0;
}

/**
 * Execute a single migration and record the result.
 */
async function executeMigration(migration: MigrationDefinition): Promise<void> {
  const label = migration.type === 'blocking' ? 'BLOCKING' : 'BACKGROUND';
  console.log(`[Migration] [${label}] Running: ${migration.id} - ${migration.description}`);
  const start = Date.now();

  try {
    const details = await migration.run();
    const durationMs = Date.now() - start;

    await Migration.findOneAndUpdate(
      { migrationId: migration.id },
      {
        migrationId: migration.id,
        description: migration.description,
        executedAt: new Date(),
        durationMs,
        status: 'success',
        details,
      },
      { upsert: true }
    );

    console.log(`[Migration] ${migration.id} completed in ${durationMs}ms`);
  } catch (error: any) {
    const durationMs = Date.now() - start;

    await Migration.findOneAndUpdate(
      { migrationId: migration.id },
      {
        migrationId: migration.id,
        description: migration.description,
        executedAt: new Date(),
        durationMs,
        status: 'failed',
        details: error.message || String(error),
      },
      { upsert: true }
    );

    console.error(`[Migration] ${migration.id} FAILED after ${durationMs}ms:`, error.message);
    // Don't throw - allow other migrations to continue
  }
}
