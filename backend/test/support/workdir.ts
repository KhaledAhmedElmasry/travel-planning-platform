// Runs before each test file is loaded: uploaded files of the test run go to the temporary
// folder that global-setup.ts created, not to backend/uploads.
if (process.env.SYSTEST_WORKDIR) process.chdir(process.env.SYSTEST_WORKDIR);
