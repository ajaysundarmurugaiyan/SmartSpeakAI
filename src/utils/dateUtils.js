/**
 * Get the current date key in YYYY-MM-DD format (local timezone)
 * This is used to track daily activities
 */
export const getDateKey = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/**
 * Calculate milliseconds until next midnight (local timezone)
 * Used to schedule automatic refresh at midnight
 */
export const getMillisecondsUntilMidnight = () => {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow.getTime() - now.getTime();
};

/**
 * Check if two date keys are different (indicates day change)
 */
export const isDifferentDay = (dateKey1, dateKey2) => {
  return dateKey1 !== dateKey2;
};
