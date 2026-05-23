import { Router, Request, Response, NextFunction } from 'express';
import passport from '../middleware/auth';
import speakeasy from 'speakeasy';
import bcrypt from 'bcrypt';
import { SessionUser, User } from '../types/models';
import { isAuthenticated } from '../middleware/auth';
import { generateTwoFactorSecret, verifyTwoFactorToken } from '../utils/twoFactor';
import pool from '../config/database';
import { applySessionCookieMaxAge } from '../utils/sessionCookie';

const router = Router();

function toSessionUser(user: User): SessionUser {
  return {
    id: user.id,
    username: user.username,
    twoFactorEnabled: user.twoFactorEnabled,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

// Login endpoint
router.post('/login', (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate('local', (err: any, user: User | false, info: any) => {
    if (err) {
      return res.status(500).json({ error: 'Internal server error' });
    }

    if (!user) {
      return res.status(401).json({ error: info?.message || 'Authentication failed' });
    }

    const rememberMe = Boolean(req.body.rememberMe);

    // Check if 2FA is enabled
    if (user.twoFactorEnabled) {
      req.session.pendingTwoFactorUserId = user.id;
      req.session.rememberMe = rememberMe;
      // Pending session: no logIn yet — safe to set cookie lifetime for the 2FA step
      applySessionCookieMaxAge(req, rememberMe);
      return res.json({
        requiresTwoFactor: true,
        message: 'Please provide 2FA code',
      });
    }

    const sessionUser = toSessionUser(user);
    req.logIn(sessionUser, (loginErr: any) => {
      if (loginErr) {
        return res.status(500).json({ error: 'Login failed' });
      }

      // After logIn, Passport regenerates the session — set maxAge here
      applySessionCookieMaxAge(req, rememberMe);

      return res.json({
        user: sessionUser,
        message: 'Login successful',
      });
    });
  })(req, res, next);
});

// Verify 2FA code
router.post('/verify-2fa', async (req: Request, res: Response) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'Token is required' });
  }

  const pendingId = req.session.pendingTwoFactorUserId;

  if (!pendingId) {
    return res.status(400).json({ error: 'No pending authentication' });
  }

  try {
    const result = await pool.query(
      `SELECT id, username, two_factor_secret, two_factor_enabled, created_at, updated_at
       FROM users WHERE id = $1`,
      [pendingId]
    );

    if (result.rows.length === 0 || !result.rows[0].two_factor_secret) {
      delete req.session.pendingTwoFactorUserId;
      return res.status(400).json({ error: '2FA not configured' });
    }

    const row = result.rows[0];

    const verified = speakeasy.totp.verify({
      secret: row.two_factor_secret,
      encoding: 'base32',
      token,
      window: 2,
    });

    if (!verified) {
      return res.status(401).json({ error: 'Invalid 2FA code' });
    }

    const sessionUser: SessionUser = {
      id: row.id,
      username: row.username,
      twoFactorEnabled: row.two_factor_enabled,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    const rememberMe = Boolean(req.session.rememberMe);
    delete req.session.pendingTwoFactorUserId;
    delete req.session.rememberMe;

    req.logIn(sessionUser, (err: any) => {
      if (err) {
        return res.status(500).json({ error: 'Login failed' });
      }

      applySessionCookieMaxAge(req, rememberMe);

      return res.json({
        user: sessionUser,
        message: 'Login successful',
      });
    });
  } catch (error) {
    console.error('verify-2fa error:', error);
    return res.status(500).json({ error: 'Verification failed' });
  }
});

// Logout endpoint
router.post('/logout', (req: Request, res: Response) => {
  req.logout((err: any) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }

    req.session.destroy((destroyErr: any) => {
      if (destroyErr) {
        return res.status(500).json({ error: 'Session destruction failed' });
      }

      res.clearCookie('connect.sid');
      return res.json({ message: 'Logout successful' });
    });
  });
});

// Get current user
router.get('/me', (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  return res.json({ user: req.user as SessionUser });
});

// Setup 2FA - Generate secret
router.post('/2fa/setup', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const user = req.user as SessionUser;

    const { secret, qrCodeUrl } = generateTwoFactorSecret(user.username);

    await pool.query('UPDATE users SET two_factor_secret = $1 WHERE id = $2', [secret, user.id]);

    return res.json({
      secret,
      qrCodeUrl,
      message: 'Scan QR code with your authenticator app and verify with a token to enable 2FA',
    });
  } catch (error) {
    console.error('2FA setup error:', error);
    return res.status(500).json({ error: 'Failed to setup 2FA' });
  }
});

// Enable 2FA - Verify token and enable
router.post('/2fa/enable', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const user = req.user as SessionUser;
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    const dbResult = await pool.query('SELECT two_factor_secret FROM users WHERE id = $1', [user.id]);

    if (dbResult.rows.length === 0 || !dbResult.rows[0].two_factor_secret) {
      return res.status(400).json({ error: '2FA not setup. Call /2fa/setup first' });
    }

    const secret = dbResult.rows[0].two_factor_secret;

    const verified = verifyTwoFactorToken(secret, token);

    if (!verified) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    await pool.query('UPDATE users SET two_factor_enabled = TRUE WHERE id = $1', [user.id]);

    return res.json({ message: '2FA enabled successfully' });
  } catch (error) {
    console.error('2FA enable error:', error);
    return res.status(500).json({ error: 'Failed to enable 2FA' });
  }
});

// Disable 2FA
router.post('/2fa/disable', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const user = req.user as SessionUser;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password is required to disable 2FA' });
    }

    const pwdResult = await pool.query('SELECT password_hash FROM users WHERE id = $1', [user.id]);

    if (pwdResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isValidPassword = await bcrypt.compare(password, pwdResult.rows[0].password_hash);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    await pool.query(
      'UPDATE users SET two_factor_enabled = FALSE, two_factor_secret = NULL WHERE id = $1',
      [user.id]
    );

    return res.json({ message: '2FA disabled successfully' });
  } catch (error) {
    console.error('2FA disable error:', error);
    return res.status(500).json({ error: 'Failed to disable 2FA' });
  }
});

export default router;
