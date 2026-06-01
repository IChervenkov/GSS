function toDateOnly(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function buildAccommodationTargetWindow(now = new Date()) {
  const today = toDateOnly(now);
  const yesterdayDate = new Date(`${today}T00:00:00.000Z`);
  yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);

  return {
    today,
    yesterday: toDateOnly(yesterdayDate),
  };
}

function isWithinAccommodationTargetWindow(value, targetWindow) {
  const normalized = toDateOnly(value);
  return normalized === targetWindow.today || normalized === targetWindow.yesterday;
}

module.exports = {
  toDateOnly,
  buildAccommodationTargetWindow,
  isWithinAccommodationTargetWindow,
};
