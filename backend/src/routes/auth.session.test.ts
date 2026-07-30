/**
 * Verifies remember-me cookie lifetime survives session regeneration (as Passport logIn does).
 */
import { describe, it, expect } from 'vitest';
import express, { Express, Request, Response } from 'express';
import session from 'express-session';
import request from 'supertest';
import {
  applySessionCookieMaxAge,
  REMEMBER_ME_MAX_AGE_MS,
} from '../utils/sessionCookie';

function createSessionTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(
    session({
      secret: 'test-session-secret',
      resave: false,
      saveUninitialized: false,
      cookie: { secure: false, httpOnly: true, maxAge: undefined },
    })
  );

  // Mimics login: regenerate session, then apply remember-me (fixed order)
  app.post('/test-login', (req: Request, res: Response) => {
    const rememberMe = Boolean(req.body.rememberMe);
    req.session.regenerate((err) => {
      if (err) {
        return res.status(500).json({ error: 'regenerate failed' });
      }
      applySessionCookieMaxAge(req, rememberMe);
      req.session.userId = 'test-user';
      return res.json({ ok: true, maxAge: req.session.cookie.maxAge });
    });
  });

  app.get('/test-me', (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    return res.json({ userId: req.session.userId });
  });

  return app;
}

function parseCookieLifetimeSeconds(
  setCookie: string | string[] | undefined
): number | null {
  const header = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  if (!header) return null;

  const maxAgeMatch = header.match(/Max-Age=(\d+)/i);
  if (maxAgeMatch) {
    return parseInt(maxAgeMatch[1], 10);
  }

  const expiresMatch = header.match(/Expires=([^;]+)/i);
  if (expiresMatch) {
    const expiresMs = new Date(expiresMatch[1].trim()).getTime();
    if (!Number.isNaN(expiresMs)) {
      return Math.floor((expiresMs - Date.now()) / 1000);
    }
  }

  return null;
}

describe('remember-me session cookie', () => {
  const app = createSessionTestApp();
  const expectedMaxAgeSeconds = Math.floor(REMEMBER_ME_MAX_AGE_MS / 1000);

  it('sets Max-Age on Set-Cookie when rememberMe is true after session regenerate', async () => {
    const agent = request.agent(app);

    const loginRes = await agent
      .post('/test-login')
      .send({ rememberMe: true })
      .expect(200);

    expect(loginRes.body.maxAge).toBe(REMEMBER_ME_MAX_AGE_MS);

    const cookieLifetime = parseCookieLifetimeSeconds(loginRes.headers['set-cookie']);
    expect(cookieLifetime).not.toBeNull();
    // Allow small tolerance for clock skew / rounding
    expect(cookieLifetime!).toBeGreaterThanOrEqual(expectedMaxAgeSeconds - 5);
    expect(cookieLifetime!).toBeLessThanOrEqual(expectedMaxAgeSeconds + 5);
  });

  it('persists session across requests when rememberMe is true', async () => {
    const agent = request.agent(app);

    await agent.post('/test-login').send({ rememberMe: true }).expect(200);

    const meRes = await agent.get('/test-me').expect(200);
    expect(meRes.body.userId).toBe('test-user');
  });

  it('omits long Max-Age when rememberMe is false', async () => {
    const agent = request.agent(app);

    const loginRes = await agent
      .post('/test-login')
      .send({ rememberMe: false })
      .expect(200);

    expect(loginRes.body.maxAge).toBeUndefined();

    const cookieLifetime = parseCookieLifetimeSeconds(loginRes.headers['set-cookie']);
    // Session cookie: no long-lived Max-Age/Expires (~30 days)
    if (cookieLifetime !== null) {
      expect(cookieLifetime).toBeLessThan(expectedMaxAgeSeconds);
    }
  });
});
