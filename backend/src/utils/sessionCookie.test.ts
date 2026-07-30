import { describe, it, expect } from 'vitest';
import { Request } from 'express';
import {
  applySessionCookieMaxAge,
  REMEMBER_ME_MAX_AGE_MS,
} from './sessionCookie';

function mockRequest(): Request {
  return {
    session: {
      cookie: {},
    },
  } as unknown as Request;
}

describe('applySessionCookieMaxAge', () => {
  it('sets 30-day maxAge when rememberMe is true', () => {
    const req = mockRequest();
    applySessionCookieMaxAge(req, true);
    expect(req.session.cookie.maxAge).toBe(REMEMBER_ME_MAX_AGE_MS);
  });

  it('clears maxAge and expires when rememberMe is false', () => {
    const req = mockRequest();
    req.session.cookie.maxAge = REMEMBER_ME_MAX_AGE_MS;
    req.session.cookie.expires = new Date();
    applySessionCookieMaxAge(req, false);
    expect(req.session.cookie.maxAge).toBeUndefined();
    expect(req.session.cookie.expires).toBeUndefined();
  });
});
