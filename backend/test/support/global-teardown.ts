// Runs once after the system tests: stops the Stripe CLI and drops the throwaway database.
import { ChildProcess } from 'child_process';
import { existsSync, readFileSync, rmSync } from 'fs';
import { connect, connection, disconnect } from 'mongoose';
import { tmpdir } from 'os';
import { join } from 'path';

const STATE_FILE = join(tmpdir(), 'tp-systest-state.json');

export default async function globalTeardown(): Promise<void> {
  const listener = (globalThis as { __STRIPE_LISTENER__?: ChildProcess })
    .__STRIPE_LISTENER__;
  listener?.kill();

  if (!existsSync(STATE_FILE)) return;
  const state = JSON.parse(readFileSync(STATE_FILE, 'utf8')) as {
    database: string;
    uri: string;
    pid?: number;
    workDir?: string;
  };
  if (state.pid) {
    try {
      process.kill(state.pid);
    } catch {
      // already stopped
    }
  }
  // Safety: only a database created by global-setup.ts is ever dropped.
  if (/^tp_systest_\d+$/.test(state.database)) {
    await connect(state.uri);
    if (connection.db?.databaseName === state.database) {
      await connection.db.dropDatabase();
    }
    await disconnect();
  }
  if (state.workDir && state.workDir.includes('tp-systest-')) {
    // The tests ran inside this folder; leave it before removing it.
    process.chdir(join(__dirname, '..', '..'));
    try {
      rmSync(state.workDir, { recursive: true, force: true });
    } catch {
      // Windows may still hold the folder; the operating system cleans its temp folder.
    }
  }
  rmSync(STATE_FILE, { force: true });
}
