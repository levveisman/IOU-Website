/**
 * Login accounts excluded from leave tracking.
 * Debt tracker "2masters" entity is separate and unchanged.
 */
export const LEAVE_TRACKER_EXCLUDED_USERNAMES = ['2 Masters'] as const;

export const LEAVE_TRACKER_EXCLUDED_USERNAME = LEAVE_TRACKER_EXCLUDED_USERNAMES[0];
