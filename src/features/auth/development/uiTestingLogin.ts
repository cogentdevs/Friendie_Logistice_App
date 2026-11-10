// Public UI-testing gate, not an account, secret, or backend authentication credential.
// Used only when the explicitly configured UI preview mode is allowed.
export const uiTestingLogin = {
  email: 'demo@friendie.test',
  password: 'Friendie@123',
} as const;
