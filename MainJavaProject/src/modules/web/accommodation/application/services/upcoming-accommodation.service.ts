const { AppError } = require('../../../../../shared/errors/app-error');
const {
  toDateOnly,
  buildAccommodationTargetWindow,
  isWithinAccommodationTargetWindow,
} = require('../../domain/accommodation-window.policy');

function normalizeName(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ');
}

function formatUpcomingAccommodationSummary(row) {
  const soldier = normalizeName(row?.soldierName) || 'Unknown soldier';
  const key =
    normalizeName(row?.upcomingAccommodationKeyName) ||
    normalizeName(row?.upcomingAccommodationKey) ||
    'None';
  return `${soldier} - Upcoming key: ${key}`;
}

function formatUpcomingReleaseSummary(row) {
  const soldier = normalizeName(row?.soldierName) || 'Unknown soldier';
  const key = normalizeName(row?.keyName) || normalizeName(row?.keyId) || 'None';
  return `${soldier} - Key: ${key}`;
}

function isOnOrAfterDate(value, target) {
  const date = toDateOnly(value);
  const targetDate = toDateOnly(target);
  return Boolean(date && targetDate && date >= targetDate);
}

function hasActiveAccommodation(row) {
  return Boolean(
    row?.keyId ||
      row?.usedKey ||
      normalizeName(row?.keyName) ||
      (row?.dateAccommodation && !row?.dateFree),
  );
}

function isPendingUpcomingAccommodation(row, targetWindow) {
  return (
    isWithinAccommodationTargetWindow(row?.upcomingAccommodation, targetWindow) &&
    !hasActiveAccommodation(row) &&
    !isOnOrAfterDate(row?.dateAccommodation, row?.upcomingAccommodation) &&
    !isOnOrAfterDate(row?.dateFree, row?.upcomingAccommodation)
  );
}

function isPendingUpcomingRelease(row, targetWindow) {
  return (
    isWithinAccommodationTargetWindow(row?.upcomingRelease, targetWindow) &&
    hasActiveAccommodation(row) &&
    !isOnOrAfterDate(row?.dateFree, row?.upcomingRelease)
  );
}

function createAccommodationService({ repository, now = () => new Date() }) {
  return {
    async getUpcomingSummary({ campId }) {
      if (!campId) {
        throw new AppError({
          status: 400,
          code: 'CAMP_CONTEXT_REQUIRED',
          message: 'Camp context is required to load accommodation updates.',
        });
      }

      const rows = await repository.findUpcomingActionsByCamp(campId);
      const targetWindow = buildAccommodationTargetWindow(now());

      const accommodationList = rows
        .filter((row) => isPendingUpcomingAccommodation(row, targetWindow))
        .map(formatUpcomingAccommodationSummary);

      const releaseList = rows
        .filter((row) => isPendingUpcomingRelease(row, targetWindow))
        .map(formatUpcomingReleaseSummary);

      return {
        isAccommodation: accommodationList.length > 0,
        isRelease: releaseList.length > 0,
        accommodationList,
        releaseList,
      };
    },
  };
}

module.exports = { createAccommodationService };
