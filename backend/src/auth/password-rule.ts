// Area: Auth & Accounts
// The password rule from ACC-01: at least 8 characters, including at least one letter and one
// digit (openapi.yaml RegisterRequest.password). Reuse it for every new password: change password
// (ACC-08), admin reset (ACC-07a) and moderator creation (ACC-13).
export const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

export const PASSWORD_RULE_MESSAGE =
  'Password must be at least 8 characters long and include at least one letter and one digit';

// bcrypt cost factor. The seeded admin (database/seed.ts) uses the same value.
export const BCRYPT_ROUNDS = 12;
