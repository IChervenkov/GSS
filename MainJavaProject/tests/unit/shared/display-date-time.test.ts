const test = require('node:test');
const assert = require('node:assert/strict');

const {
  formatUtcDateTimeDisplay,
  normalizeDisplayDateTimeText,
} = require('../../../src/shared/datetime/display-date-time');

test('formatUtcDateTimeDisplay formats timestamps as YYYY-MM-DD HH:mm AM/PM', () => {
  assert.equal(
    formatUtcDateTimeDisplay(new Date('2026-04-17T09:15:00.000Z')),
    '2026-04-17 09:15 AM',
  );
  assert.equal(
    formatUtcDateTimeDisplay('2026-04-17T12:05:00.000Z'),
    '2026-04-17 12:05 PM',
  );
  assert.equal(
    formatUtcDateTimeDisplay('2026-04-17T00:05:00.000Z'),
    '2026-04-17 12:05 AM',
  );
});

test('formatUtcDateTimeDisplay preserves already formatted timestamp text', () => {
  assert.equal(normalizeDisplayDateTimeText('2026-04-17 09:15 pm'), '2026-04-17 09:15 PM');
  assert.equal(formatUtcDateTimeDisplay('2026-04-17 09:15 pm'), '2026-04-17 09:15 PM');
});

test('formatUtcDateTimeDisplay returns fallback for invalid values', () => {
  assert.equal(formatUtcDateTimeDisplay(null, 'Not recorded'), 'Not recorded');
  assert.equal(formatUtcDateTimeDisplay('not-a-date', 'Not recorded'), 'Not recorded');
});
