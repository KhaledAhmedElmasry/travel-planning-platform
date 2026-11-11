// Runs once after the system tests: stops this run's Stripe CLI and drops this run's throwaway
// database. The state comes from global-setup.ts in the same process, so runs that overlap
// never touch each other's database.
import { rmSync } from 'fs';
import { connect, connection, disconnect } from 'mongoose';
import { join } from 'path';
import type { SystemTestState } from './global-setup';

export default async function globalTeardown(): Promise<void> {
  const state = (globalThis as { __SYSTEST__?: SystemTestState }).__SYSTEST__;
  if (!state) return;
  state.listener.kill();

  // Safety: only a database created by global-setup.ts is ever dropped.
  if (/^tp_systest_\d+$/.test(state.database)) {
    await connect(state.uri);
    if (connection.db?.databaseName === state.database) {
      await connection.db.dropDatabase();
    }
    await disconnect();
  }
  if (state.workDir.includes('tp-systest-')) {
    // The tests ran inside this folder; leave it before removing it.
    process.chdir(join(__dirname, '..', '..'));
    try {
      rmSync(state.workDir, { recursive: true, force: true });
    } catch {
      // Windows may still hold the folder; the operating system cleans its temp folder.
    }
  }
}
