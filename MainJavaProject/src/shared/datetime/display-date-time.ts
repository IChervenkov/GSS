const DISPLAY_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2} (?:AM|PM)$/i;

function padDatePart(value) {
  return String(value).padStart(2, '0');
}

function normalizeDisplayDateTimeText(value) {
  const text = String(value || '').trim();
  return DISPLAY_DATE_TIME_PATTERN.test(text)
    ? text.replace(/(am|pm)$/i, (part) => part.toUpperCase())
    : null;
}

function formatUtcDateTimeDisplay(value, fallback = null) {
  const normalized = normalizeDisplayDateTimeText(value);
  if (normalized) return normalized;

  const date = value instanceof Date ? value : new Date(value);
  if (!value || !Number.isFinite(date.getTime())) return fallback;

  const hour24 = date.getUTCHours();
  const meridiem = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 || 12;
  return [
    `${date.getUTCFullYear()}-${padDatePart(date.getUTCMonth() + 1)}-${padDatePart(
      date.getUTCDate(),
    )}`,
    `${padDatePart(hour12)}:${padDatePart(date.getUTCMinutes())} ${meridiem}`,
  ].join(' ');
}

module.exports = {
  DISPLAY_DATE_TIME_PATTERN,
  formatUtcDateTimeDisplay,
  normalizeDisplayDateTimeText,
};
