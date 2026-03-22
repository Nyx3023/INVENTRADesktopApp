/**
 * Format a number as currency with comma separators
 * @param {number|string} amount - The amount to format
 * @returns {string} Formatted currency string (e.g., ₱12,345.67)
 */
export const formatCurrency = (amount) => {
  const num = parseFloat(amount) || 0;
  return `₱${num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
};

/**
 * Format a number with comma separators (no currency symbol)
 * @param {number|string} number - The number to format
 * @param {number} decimals - Number of decimal places (default: 0)
 * @returns {string} Formatted number string (e.g., 12,345 or 12,345.67)
 */
export const formatNumber = (number, decimals = 0) => {
  const num = parseFloat(number) || 0;
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
};

/**
 * Parse a timestamp string and convert to local time for display.
 * The database stores timestamps in UTC format (e.g., "2026-01-08 12:33:06" or "2026-01-08T12:33:06").
 * Since these are UTC, we need to convert them to local time for proper display.
 * 
 * For timestamps that already include timezone info (Z or +/-XX:XX), parse normally.
 * For timestamps without timezone info, treat them as UTC and convert to local.
 * 
 * @param {string} dateString - Timestamp string from the database
 * @returns {Date} A Date object representing the local time
 */
export const parseLocalTimestamp = (dateString) => {
  if (!dateString) return new Date(NaN);

  // If timestamp already has timezone info (Z or +XX:XX), parse normally
  if (dateString.includes('Z') || dateString.match(/[+-]\d{2}:\d{2}$/)) {
    return new Date(dateString);
  }

  // Try to parse timestamps in format: "YYYY-MM-DD HH:mm:ss" or "YYYY-MM-DDTHH:mm:ss"
  // Match both space and T as separator
  const parts = dateString.match(/(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})\.?(\d{3})?/);
  if (parts) {
    const [, year, month, day, hours, minutes, seconds, ms] = parts;
    // Since the timestamp is stored as UTC in the database, 
    // we use Date.UTC to interpret it as UTC and then convert to local
    const utcTime = Date.UTC(
      parseInt(year),
      parseInt(month) - 1,  // month is 0-indexed
      parseInt(day),
      parseInt(hours),
      parseInt(minutes),
      parseInt(seconds),
      parseInt(ms || 0)
    );
    return new Date(utcTime);
  }

  // Fallback to default parsing
  return new Date(dateString);
};

/**
 * Format a date string for display, correctly handling local timestamps
 * @param {string} dateString - ISO timestamp string
 * @returns {string} Formatted date string (e.g., "1/8/2026, 8:33:06 PM")
 */
export const formatDate = (dateString) => {
  if (!dateString) return 'Invalid Date';
  const date = parseLocalTimestamp(dateString);
  if (isNaN(date.getTime())) return 'Invalid Date';
  return date.toLocaleString();
};

