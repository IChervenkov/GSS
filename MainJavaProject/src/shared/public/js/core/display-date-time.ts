const DISPLAY_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2} (?:AM|PM)$/i;

function padDatePart(value) {
  return String(value).padStart(2, '0');
}

export function formatDateTimeDisplay(value, fallback = '') {
  const text = String(value || '').trim();
  if (DISPLAY_DATE_TIME_PATTERN.test(text)) {
    return text.replace(/(am|pm)$/i, (part) => part.toUpperCase());
  }

  const date = value instanceof Date ? value : new Date(value);
  if (!value || !Number.isFinite(date.getTime())) return fallback;

  const hour24 = date.getHours();
  const meridiem = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 || 12;
  return [
    `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`,
    `${padDatePart(hour12)}:${padDatePart(date.getMinutes())} ${meridiem}`,
  ].join(' ');
}
