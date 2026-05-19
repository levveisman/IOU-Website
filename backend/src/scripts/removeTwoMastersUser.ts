/**
 * Safely remove the legacy "2 Masters" login user from the users table.
 * Does not touch debt_transactions_v2 "2masters" entity data.
 *
 * Run: npm run remove-2-masters-user (from backend/)
 */

import pool from '../config/database';
import { LEAVE_TRACKER_EXCLUDED_USERNAME } from '../constants/leaveTrackerUsers';

async function removeTwoMastersUser(): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const userResult = await client.query(
      'SELECT id, username FROM users WHERE username = $1',
      [LEAVE_TRACKER_EXCLUDED_USERNAME]
    );

    if (userResult.rows.length === 0) {
      console.log(`ℹ️  User "${LEAVE_TRACKER_EXCLUDED_USERNAME}" not found — nothing to do.`);
      await client.query('ROLLBACK');
      return;
    }

    const userId = userResult.rows[0].id as string;

    const leaveCount = await client.query(
      'SELECT COUNT(*)::int AS count FROM leave_records WHERE user_id = $1',
      [userId]
    );
    const legacyTxCount = await client.query(
      `SELECT COUNT(*)::int AS count FROM transactions
       WHERE from_user_id = $1 OR to_user_id = $1`,
      [userId]
    );

    const leaveRows = leaveCount.rows[0].count as number;
    const legacyRows = legacyTxCount.rows[0].count as number;

    if (leaveRows > 0) {
      console.log(
        `⚠️  Will CASCADE-delete ${leaveRows} leave record(s) for "${LEAVE_TRACKER_EXCLUDED_USERNAME}".`
      );
    }
    if (legacyRows > 0) {
      console.log(
        `⚠️  Will CASCADE-delete ${legacyRows} legacy transaction(s) for "${LEAVE_TRACKER_EXCLUDED_USERNAME}".`
      );
    }

    const deleteResult = await client.query(
      'DELETE FROM users WHERE id = $1 AND username = $2 RETURNING id, username',
      [userId, LEAVE_TRACKER_EXCLUDED_USERNAME]
    );

    if (deleteResult.rowCount !== 1) {
      throw new Error('Delete did not affect exactly one user row');
    }

    const remaining = await client.query(
      'SELECT username FROM users ORDER BY username'
    );

    await client.query('COMMIT');

    console.log(`✅ Removed user: ${LEAVE_TRACKER_EXCLUDED_USERNAME}`);
    console.log(`   Remaining users (${remaining.rows.length}):`, remaining.rows.map((r) => r.username).join(', '));

    if (remaining.rows.length !== 2) {
      console.warn(
        `⚠️  Expected 2 users for leave-owed calculation; found ${remaining.rows.length}.`
      );
    }
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

removeTwoMastersUser()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error removing user:', error);
    process.exit(1);
  });
