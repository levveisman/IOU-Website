import 'express-session';

declare module 'express-session' {
  interface SessionData {
    pendingTwoFactorUserId?: string;
    /** Stored during 2FA login; applied after verify-2fa logIn */
    rememberMe?: boolean;
  }
}
