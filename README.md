# UOMi Application

A comprehensive business management system for tracking sales, debts, employee leave, and company operations.

## Quick Links

- [Application Overview](APPLICATION_OVERVIEW_README.md) - Complete feature documentation
- [Sales Tracker](SALES_TRACKER_README.md) - Sales transaction management
- [Debt Tracker](DEBT_TRACKER_README.md) - Debt tracking between partners
- [Leave Tracker](LEAVE_TRACKER_README.md) - Employee leave management
- [Settings](SETTINGS_README.md) - User accounts and calendar settings

## Features

- **Sales Tracker**: Record and analyze sales with item-level insights, seller attribution, and predefined items
- **Debt Tracker**: Track money owed between Lev and Danik with automatic calculations
- **Leave Tracker**: Manage employee leave with intelligent business day calculations
- **Settings**: Configure users, holidays (with bulk import), closed dates, birthdays, and sales items
- **PWA Support**: Install as app on mobile/desktop with offline support and auto-updates
- **Birthday Notifications**: Browser notifications for employee birthdays

## Project Structure

```
uomi-application/
├── backend/                    # Node.js/Express API
│   ├── src/
│   │   ├── business-logic/     # Business calculations
│   │   ├── config/             # Database and configuration
│   │   ├── middleware/         # Express middleware
│   │   ├── repositories/       # Data access layer
│   │   ├── routes/             # API endpoints
│   │   ├── scripts/            # Database scripts
│   │   ├── types/              # TypeScript types
│   │   ├── utils/              # Utility functions
│   │   └── index.ts            # Server entry point
│   └── package.json
├── frontend/                   # React application
│   ├── src/
│   │   ├── api/                # API client functions
│   │   ├── components/         # React components
│   │   ├── contexts/           # React contexts
│   │   ├── hooks/              # Custom hooks
│   │   ├── pages/              # Page components
│   │   ├── store/              # Redux store
│   │   ├── utils/              # Utility functions
│   │   ├── App.tsx             # Root component
│   │   └── main.tsx            # Entry point
│   └── package.json
└── package.json                # Root workspace configuration
```

## Prerequisites

- **Node.js 20 LTS or newer** (recommended). Several frontend dev dependencies (e.g. Vitest/jsdom, Workbox) declare `engines` that require Node 20+; on **Node 18** `npm install` may still succeed but print `EBADENGINE` warnings.
- npm (comes with Node)
- PostgreSQL 14+

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

This installs dependencies for both frontend and backend workspaces.

### 2. Database Setup

Create a PostgreSQL database (name should match `DB_NAME` in `backend/.env`, default below):

```bash
createdb company_tracker
```

Set up the database schema and seed users:

```bash
cd backend
npm run setup-db
```

This script will:
- Create all required tables
- Set up indexes and constraints
- Seed default users (see script output for the initial password — change it after login)

### 3. Environment Configuration

**Backend** - Copy and configure:

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` (mirrors variables used by `backend/src/config/database.ts`):

```env
PORT=3001
DB_HOST=localhost
DB_PORT=5432
DB_NAME=company_tracker
DB_USER=postgres
DB_PASSWORD=postgres
DB_TIMEZONE=Australia/Melbourne
SESSION_SECRET=your-secret-key-change-in-production
NODE_ENV=development

# Skip LoginPage in local dev (auto-auth as DEV_USERNAME; ignored in production)
SKIP_AUTH=true
DEV_USERNAME=Leva
```

Optional production-oriented variables:

- **`FRONTEND_ORIGINS`** — Comma-separated allowed browser origins for CORS (e.g. `https://app.example.com`). If unset, all origins are allowed (fine for trusted LAN dev; set this when exposing the API broadly).
- **`COOKIE_SECURE`** — Set to `true` only when clients use **HTTPS** to reach the API (otherwise the session cookie would not be stored).

**Frontend** - Copy and configure:

```bash
cp frontend/.env.example frontend/.env
```

Edit `frontend/.env` (optional on localhost — Vite proxies `/api` to the backend):

```env
# Needed when opening the UI by LAN IP (not localhost); defaults to http://<hostname>:3001
VITE_API_URL=http://localhost:3001
```

Dev proxy target defaults to `http://localhost:3001`. Override if needed:

```env
VITE_API_PROXY_TARGET=http://localhost:3001
```

### 4. Start Development Servers

Start both frontend and backend:

```bash
npm run dev
```

Or start them separately:

```bash
# Backend (runs on port 3001)
npm run dev:backend

# Frontend (Vite dev server — port 5176)
npm run dev:frontend
```

### 5. Access the Application

- Frontend: http://localhost:5176
- Backend API: http://localhost:3001
- Health Check: http://localhost:3001/health

### 6. Initial Setup

1. Sign in with a user created by `npm run setup-db` (password printed in the script output), then change passwords in Settings
2. Configure public holidays in Settings
3. Add any company closed dates
4. Start tracking sales, debts, and leave!

### Docker Compose

Backend listens on **port 3001** on the host (`docker-compose.yml`). The frontend nginx container proxies `/api` to the backend. After changing compose env vars, rebuild images if needed.

Local **npm** dev (without Docker) uses the same API port **3001** so the Vite proxy and LAN defaults stay aligned.

## Development

### Available Scripts

**Root:**
- `npm run dev` - Start both frontend and backend
- `npm test` - Run all tests
- `npm run test:watch` - Vitest watch mode in frontend and backend workspaces
- `npm run dev:backend` - Start backend only
- `npm run dev:frontend` - Start frontend only

**Backend:**
- `npm run dev` - Start with hot reload
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm test` - Run tests
- `npm run setup-db` - Initialize database (from `backend/` or `npm run setup-db --workspace=backend`)
- `npm run migrate` - Legacy migration helper (`migrate.js`; only if you still need old schema patches)

**Frontend:**
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm test` - Run tests

### Database Scripts

Located in `backend/src/scripts/`:

- `setupDatabase.ts` - Initialize database schema
- `initUsers.ts` - Create initial users
- `seedReasonableTestData.ts` - Add realistic test data
- `seedStressTestData.ts` - Add large dataset for testing
- `clearStressTestData.ts` - Remove stress test data
- `addSalesTransactionsTable.ts` - Add sales table
- `addDebtTransactionsV2Table.ts` - Add debt v2 table
- `addQuantityToSalesTransactions.ts` - Add quantity column
- `addSellerToSalesTransactions.ts` - Add seller column
- `verifySalesTable.ts` - Verify sales table structure
- `verifyDebtV2Table.ts` - Verify debt table structure
- `setSimplePassword.ts` - Set simple password for testing
- `setPin.ts` - Set PIN for user
- `resetPassword.ts` - Reset user password
- `disableTwoFactor.ts` - Disable 2FA for user

Run scripts with:
```bash
cd backend
npx tsx src/scripts/scriptName.ts
```

## Technology Stack

### Frontend
- **React 18** with TypeScript
- **Material-UI (MUI) v5** - UI components
- **Redux Toolkit** - State management
- **React Router v6** - Routing
- **Vite** - Build tool with PWA plugin
- **date-fns** - Date handling
- **Axios** - HTTP client
- **Workbox** - Service worker and caching

### Backend
- **Express.js** with TypeScript
- **PostgreSQL** - Database
- **Passport.js** - Authentication
- **express-session** - Session management
- **bcrypt** - Password hashing
- **speakeasy** - Two-factor authentication (TOTP)
- **date-fns-tz** - Timezone handling
- **axios** - External API calls (holiday import)

### Testing
- **Vitest** - Test runner
- **React Testing Library** - Component testing
- **fast-check** - Property-based testing
- **Supertest** - API endpoint testing

## Database Schema

### Core Tables

- `users` - User authentication and profiles
- `sales_transactions` - Sales records with item, price, quantity, seller
- `sales_items` - Predefined sales items for quick selection
- `debt_transactions_v2` - Debt tracking between Lev, Danik, and 2masters
- `leave_records` - Employee leave tracking
- `public_holidays` - National and regional holidays
- `closed_dates` - Company closure periods
- `birthdays` - Employee birthday tracking

All tables use UUID primary keys and include `created_at` and `updated_at` timestamps.

### Key Indexes

- `idx_sales_date` - Sales by date (DESC)
- `idx_sales_seller` - Sales by seller
- `idx_debt_timestamp` - Debt by timestamp (DESC)
- `idx_leave_dates` - Leave by date range
- `idx_holiday_date` - Holidays by date

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user
- `POST /api/auth/verify-2fa` - Verify 2FA code
- `POST /api/auth/2fa/setup` - Setup 2FA (authenticated)
- `POST /api/auth/2fa/enable` - Enable 2FA after TOTP verification
- `POST /api/auth/2fa/disable` - Disable 2FA (requires password in body)

### Sales Transactions
- `GET /api/sales` - List sales (paginated)
- `POST /api/sales` - Create sale
- `PUT /api/sales/:id` - Update sale
- `DELETE /api/sales/:id` - Delete sale

### Debt Transactions
- `GET /api/debt-transactions-v2` - List transactions (paginated)
- `POST /api/debt-transactions-v2` - Create transaction
- `GET /api/debt-transactions-v2/net-debt` - Get net debt
- `PUT /api/debt-transactions-v2/:id` - Update transaction
- `DELETE /api/debt-transactions-v2/:id` - Delete transaction

### Leave Management
- `GET /api/leave` - List leave records (paginated)
- `POST /api/leave` - Create leave
- `PUT /api/leave/:id` - Update leave
- `DELETE /api/leave/:id` - Delete leave
- `POST /api/leave/calculate-business-days` - Calculate business days
- `POST /api/leave/check-overlap` - Check for overlaps

### Settings
- `GET /api/holidays` - List holidays
- `POST /api/holidays` - Create holiday
- `PUT /api/holidays/:id` - Update holiday
- `DELETE /api/holidays/:id` - Delete holiday
- `POST /api/holiday-import/import` - Bulk import holidays
- `GET /api/holiday-import/countries` - List available countries
- `GET /api/closed-dates` - List closed dates
- `POST /api/closed-dates` - Create closed date
- `PUT /api/closed-dates/:id` - Update closed date
- `DELETE /api/closed-dates/:id` - Delete closed date
- `GET /api/birthdays` - List birthdays
- `POST /api/birthdays` - Create birthday
- `PUT /api/birthdays/:id` - Update birthday
- `DELETE /api/birthdays/:id` - Delete birthday
- `GET /api/sales-items` - List sales items
- `POST /api/sales-items` - Create sales item
- `PUT /api/sales-items/:id` - Update sales item
- `DELETE /api/sales-items/:id` - Delete sales item

### User Management
- `GET /api/users` - List users
- `PUT /api/users/:id` - Update user (username/password; requires current password)

PIN login support uses hashed PINs in the database; set or change a PIN via `backend/src/scripts/setPin.ts` (`npx tsx src/scripts/setPin.ts`), not via a REST endpoint.

## Testing

Run all tests:
```bash
npm test
```

Run tests in watch mode (from repo root):
```bash
npm run test:watch
```

Optional coverage: install `@vitest/coverage-v8` in a workspace, then run `npx vitest run --coverage` from that workspace.

## Timezone Configuration

The application uses a single consistent timezone (configurable via `DB_TIMEZONE` environment variable, default: `Australia/Melbourne`) for all date operations to ensure consistency across the system.

## PWA Features

The application is a Progressive Web App (PWA) with:

- **Installable**: Can be installed on mobile and desktop devices
- **Offline Support**: Works offline after first visit with service worker caching
- **Auto-Updates**: Automatically detects and prompts for updates
- **Push Notifications**: Browser notifications for birthdays
- **App-like Experience**: Custom icons, splash screens, and standalone mode

To build and test PWA features:
```bash
cd frontend
npm run build
npm run preview
```

See [frontend/PWA_SETUP.md](frontend/PWA_SETUP.md) for detailed PWA configuration.

## Production Deployment

### Build for Production

```bash
# Frontend
cd frontend
npm run build
# Output: dist/

# Backend
cd backend
npm run build
# Output: dist/
```

### Environment Variables

Set `NODE_ENV=production` and a strong random `SESSION_SECRET` (the server **refuses to start** in production if `SESSION_SECRET` is unset or still set to the example default shipped in code).

Use **`FRONTEND_ORIGINS`** for an explicit CORS allowlist, and **`COOKIE_SECURE=true`** when clients reach the API over HTTPS.

### Database Migration

```bash
cd backend
npm run migrate
```

`migrate.js` targets legacy schema changes (e.g. old `transactions` table). Prefer `npm run setup-db` for fresh installs; only run `migrate` if you know your database needs those specific ALTER statements.

## Documentation

- [APPLICATION_OVERVIEW_README.md](APPLICATION_OVERVIEW_README.md) - Complete application documentation
- [SALES_TRACKER_README.md](SALES_TRACKER_README.md) - Sales tracker features and API
- [DEBT_TRACKER_README.md](DEBT_TRACKER_README.md) - Debt tracker features and API
- [LEAVE_TRACKER_README.md](LEAVE_TRACKER_README.md) - Leave tracker features and API
- [SETTINGS_README.md](SETTINGS_README.md) - Settings and authentication

## License

[Your License Here]

## Support

For issues and questions, please refer to the detailed documentation in the README files listed above.
