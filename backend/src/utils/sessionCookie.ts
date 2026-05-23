import { Request } from 'express';

/** 30 days in milliseconds */
export const REMEMBER_ME_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Apply session cookie lifetime after Passport logIn (which regenerates the session).
 * Must be called inside the logIn callback, not before.
 */
export function applySessionCookieMaxAge(req: Request, rememberMe: boolean): void {
  if (rememberMe) {
    req.session.cookie.maxAge = REMEMBER_ME_MAX_AGE_MS;
  } else {
    // Session cookie — expires when the browser/PWA session ends
    req.session.cookie.maxAge = undefined as unknown as number;
    req.session.cookie.expires = undefined;
  }
}
