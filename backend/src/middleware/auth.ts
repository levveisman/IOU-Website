import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import bcrypt from 'bcrypt';
import pool from '../config/database';
import { SessionUser, User } from '../types/models';
import { Request, Response, NextFunction } from 'express';

// Configure Passport Local Strategy
passport.use(
  new LocalStrategy(async (username: string, password: string, done: any) => {
    try {
      // Query user from database
      const result = await pool.query(
        'SELECT id, username, password_hash, pin_hash, two_factor_secret, two_factor_enabled, created_at, updated_at FROM users WHERE username = $1',
        [username]
      );

      if (result.rows.length === 0) {
        return done(null, false, { message: 'Invalid username or password' });
      }

      const user = result.rows[0];

      // Verify password or PIN
      let isValid = await bcrypt.compare(password, user.password_hash);
      
      // If password fails and PIN exists, try PIN
      if (!isValid && user.pin_hash) {
        isValid = await bcrypt.compare(password, user.pin_hash);
      }
      
      if (!isValid) {
        return done(null, false, { message: 'Invalid username or password' });
      }

      // Convert snake_case to camelCase for User interface
      const userObj: User = {
        id: user.id,
        username: user.username,
        passwordHash: user.password_hash,
        twoFactorSecret: user.two_factor_secret,
        twoFactorEnabled: user.two_factor_enabled,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      };

      return done(null, userObj);
    } catch (error) {
      return done(error);
    }
  })
);

// Serialize user for session
passport.serializeUser((user: any, done: any) => {
  done(null, user.id);
});

// Deserialize user from session (no credential material)
passport.deserializeUser(async (id: string, done: any) => {
  try {
    const result = await pool.query(
      'SELECT id, username, two_factor_enabled, created_at, updated_at FROM users WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return done(null, false);
    }

    const user = result.rows[0];
    const userObj: SessionUser = {
      id: user.id,
      username: user.username,
      twoFactorEnabled: user.two_factor_enabled,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };

    done(null, userObj);
  } catch (error) {
    done(error);
  }
});

/** Dev-only: skip login when SKIP_AUTH=true (never in production). */
export const isSkipAuthEnabled = (): boolean =>
  process.env.SKIP_AUTH === 'true' && process.env.NODE_ENV !== 'production';

/**
 * When SKIP_AUTH is enabled, attach DEV_USERNAME (default Leva) as req.user
 * so /api/auth/me and protected routes work without logging in.
 */
export const attachDevUserIfSkipAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!isSkipAuthEnabled() || req.isAuthenticated()) {
    return next();
  }

  try {
    const username = process.env.DEV_USERNAME || 'Leva';
    const result = await pool.query(
      'SELECT id, username, two_factor_enabled, created_at, updated_at FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      console.warn(
        `[SKIP_AUTH] Dev user "${username}" not found — run npm run setup-db, or set DEV_USERNAME`
      );
      return next();
    }

    const row = result.rows[0];
    req.user = {
      id: row.id,
      username: row.username,
      twoFactorEnabled: row.two_factor_enabled,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    } satisfies SessionUser;

    return next();
  } catch (error) {
    return next(error);
  }
};

// Middleware to check if user is authenticated
export const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: 'Unauthorized' });
};

export default passport;
