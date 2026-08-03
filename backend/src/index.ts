import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import session from 'express-session';
import pool from './config/database';
import { buildSessionOptions } from './config/sessionStore';
import { ensureRuntimeSchema } from './scripts/ensureRuntimeSchema';
import passport, { attachDevUserIfSkipAuth, isSkipAuthEnabled } from './middleware/auth';
import authRoutes from './routes/auth';
import usersRoutes from './routes/users';
import leaveRoutes from './routes/leave';
import holidaysRoutes from './routes/holidays';
import holidayImportRoutes from './routes/holidayImport';
import closedDatesRoutes from './routes/closedDates';
import birthdaysRoutes from './routes/birthdays';
import salesTransactionsRoutes from './routes/salesTransactions';
import salesItemsRoutes from './routes/salesItems';
import debtTransactionsV2Routes from './routes/debtTransactionsV2';
import debtRecurrenceTemplatesRoutes from './routes/debtRecurrenceTemplates';
import debtWeeklyRecurrenceTemplatesRoutes from './routes/debtWeeklyRecurrenceTemplates';
import { startDebtRecurrenceScheduler } from './jobs/debtRecurrenceJob';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);
const isProd = process.env.NODE_ENV === 'production';
const defaultSessionSecret = 'company-tracker-secret-key-change-in-production';
const sessionSecret = process.env.SESSION_SECRET || defaultSessionSecret;

if (isProd && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === defaultSessionSecret)) {
  console.error(
    'FATAL: Set SESSION_SECRET to a strong random value in production (not the example default).'
  );
  process.exit(1);
}

const corsAllowed = process.env.FRONTEND_ORIGINS?.split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!corsAllowed?.length) {
        callback(null, true);
        return;
      }
      if (!origin || corsAllowed.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Use COOKIE_SECURE=true only behind HTTPS (otherwise browsers omit the session cookie)
const cookieSecure = process.env.COOKIE_SECURE === 'true';

if (isProd) {
  app.set('trust proxy', 1);
}

function registerRoutes(): void {
  // Health check endpoint
  app.get('/health', async (req, res) => {
    try {
      await pool.query('SELECT NOW()');
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    } catch (error) {
      res.status(500).json({ status: 'error', message: 'Database connection failed' });
    }
  });

  app.get('/api', (req, res) => {
    res.json({ message: 'UOMi API' });
  });

  app.use(attachDevUserIfSkipAuth);

  if (isSkipAuthEnabled()) {
    console.warn(
      `⚠️  SKIP_AUTH enabled — auto-authenticated as "${process.env.DEV_USERNAME || 'Leva'}" (login skipped)`
    );
  }


  app.use('/api/auth', authRoutes);
  app.use('/api/users', usersRoutes);
  app.use('/api/leave', leaveRoutes);
  app.use('/api/holidays', holidaysRoutes);
  app.use('/api/holiday-import', holidayImportRoutes);
  app.use('/api/closed-dates', closedDatesRoutes);
  app.use('/api/birthdays', birthdaysRoutes);
  app.use('/api/sales', salesTransactionsRoutes);
  app.use('/api/sales-items', salesItemsRoutes);
  app.use('/api/debt-transactions-v2', debtTransactionsV2Routes);
  app.use('/api/debt-recurrence-templates', debtRecurrenceTemplatesRoutes);
  app.use('/api/debt-weekly-recurrence-templates', debtWeeklyRecurrenceTemplatesRoutes);
}

async function start() {
  const sessionOptions = await buildSessionOptions(sessionSecret, isProd, cookieSecure);
  app.use(session(sessionOptions));
  app.use(passport.initialize());
  app.use(passport.session());

  registerRoutes();

  await ensureRuntimeSchema();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Access locally: http://localhost:${PORT}`);
    console.log(`Access on network: http://[YOUR_IP]:${PORT}`);
    startDebtRecurrenceScheduler();
  });
}

void start().catch((err) => {
  console.error('Server failed to start:', err);
  process.exit(1);
});

export default app;
