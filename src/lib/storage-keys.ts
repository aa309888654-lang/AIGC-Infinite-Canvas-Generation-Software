export const STORAGE_KEYS = {
  AUTH_TOKEN: 'authToken',
  REMEMBERED_EMAIL: 'rememberedEmail',
  ADMIN_TOKEN: 'admin_token_v1',
  GUEST_TRIAL_COUNT: 'guestTrialCount',
  LAYOUT_MANAGER: 'layout-manager',
  CREDENTIALS_EXPIRE: 'credentials_expire',
  LOGIN_FORM: 'loginFormState',
} as const;

export const AUTH_TOKEN_KEY = STORAGE_KEYS.AUTH_TOKEN;
