// Imported FIRST by revalidation.system-spec.ts: ConfigModule reads the environment when
// AppModule is imported (by the harness), so the fake frontend's address and the shared secret
// must be set before that import. The previous values are restored after the file.
export const REVALIDATION_PORT = Number(process.env.SYSTEST_PORT) + 7;
export const REVALIDATION_SECRET = 'systest-revalidate-secret';
export const savedRevalidationEnv = {
  url: process.env.FRONTEND_URL,
  secret: process.env.REVALIDATE_SECRET,
};
process.env.FRONTEND_URL = `http://127.0.0.1:${REVALIDATION_PORT}`;
process.env.REVALIDATE_SECRET = REVALIDATION_SECRET;
