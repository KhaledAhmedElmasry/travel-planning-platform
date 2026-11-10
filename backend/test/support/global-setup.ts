// Runs once before the system tests (jest --config test/jest-system.json).
//
// The system tests call the REAL application and the REAL external services:
//   - MongoDB Atlas: the cluster of backend/.env, but a throwaway database (tp_systest_<time>), so
//     the shared team database is never touched. It is dropped again in global-teardown.ts.
//   - Stripe: test mode only (the run stops if STRIPE_SECRET_KEY is not a test key). The Stripe CLI
//     forwards the real webhook events of the test account to the application under test.
//   - FXRatesAPI: the real public API.
import { execFileSync, spawn } from 'child_process';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

export const WEBHOOK_EVENTS =
  'payment_intent.succeeded,payment_intent.payment_failed,payment_intent.canceled,refund.created,refund.updated,refund.failed';

const BACKEND = join(__dirname, '..', '..');
const STATE_FILE = join(tmpdir(), 'tp-systest-state.json');

export default async function globalSetup(): Promise<void> {
  const envFile = join(BACKEND, '.env');
  if (!existsSync(envFile)) {
    throw new Error('backend/.env is missing: the system tests need it.');
  }
  process.loadEnvFile(envFile);

  const stripeKey = process.env.STRIPE_SECRET_KEY ?? '';
  if (!/^(sk|rk)_test_/.test(stripeKey)) {
    throw new Error(
      'STRIPE_SECRET_KEY is not a Stripe TEST key. The tests never run against live mode.',
    );
  }

  // A throwaway database on the same cluster.
  const database = `tp_systest_${Date.now()}`;
  const uri = process.env.MONGODB_URI ?? '';
  const testUri = uri.replace(
    /^(mongodb(?:\+srv)?:\/\/[^/]+\/)([^?]*)/,
    `$1${database}`,
  );
  if (testUri === uri || !testUri.includes(database)) {
    throw new Error('Could not point MONGODB_URI at a throwaway database.');
  }
  process.env.MONGODB_URI = testUri;
  process.env.SYSTEST_DATABASE = database;

  // The application under test listens here; the Stripe CLI forwards webhooks to it.
  const port = process.env.SYSTEST_PORT ?? '3210';
  process.env.SYSTEST_PORT = port;
  process.env.PORT = port;

  // Uploaded files of the test run go to a temporary folder, not backend/uploads.
  const workDir = mkdtempSync(join(tmpdir(), 'tp-systest-'));
  mkdirSync(join(workDir, 'uploads'), { recursive: true });
  process.env.SYSTEST_WORKDIR = workDir;

  // GEN-12: the real seed script loads the official reference data and the admin account.
  execFileSync(
    process.execPath,
    [
      join(BACKEND, 'node_modules', 'ts-node', 'dist', 'bin.js'),
      '-r',
      'tsconfig-paths/register',
      join(BACKEND, 'src', 'database', 'seed.ts'),
    ],
    { cwd: BACKEND, env: process.env, stdio: 'pipe' },
  );

  // Stripe CLI: the signing secret of this device, then forward the real test-mode events.
  const stripeArgs = ['--api-key', stripeKey];
  const secret = execFileSync(
    'stripe',
    ['listen', '--print-secret', ...stripeArgs],
    { encoding: 'utf8' },
  ).trim();
  if (!secret.startsWith('whsec_')) {
    throw new Error('The Stripe CLI did not print a webhook signing secret.');
  }
  process.env.STRIPE_WEBHOOK_SECRET = secret;

  const listener = spawn(
    'stripe',
    [
      'listen',
      ...stripeArgs,
      '--events',
      WEBHOOK_EVENTS,
      '--forward-to',
      `localhost:${port}/api/payments/webhook`,
    ],
    { stdio: ['ignore', 'pipe', 'pipe'], detached: false },
  );
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('stripe listen did not become ready in 60 s.')),
      60_000,
    );
    const onData = (chunk: Buffer) => {
      if (chunk.toString().includes('Ready!')) {
        clearTimeout(timer);
        resolve();
      }
    };
    listener.stdout.on('data', onData);
    listener.stderr.on('data', onData);
    listener.on('exit', (code) =>
      reject(new Error(`stripe listen stopped early (exit code ${code}).`)),
    );
  });
  listener.stdout.removeAllListeners('data');
  listener.stderr.removeAllListeners('data');
  listener.removeAllListeners('exit');
  listener.stdout.resume();
  listener.stderr.resume();
  listener.unref();

  writeFileSync(
    STATE_FILE,
    JSON.stringify({ database, uri: testUri, pid: listener.pid, workDir }),
  );
  (globalThis as { __STRIPE_LISTENER__?: unknown }).__STRIPE_LISTENER__ =
    listener;
}
