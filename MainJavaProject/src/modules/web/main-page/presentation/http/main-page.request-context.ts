// @ts-nocheck
function toTrimmedArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? '').trim()).filter(Boolean);
  }

  if (value === undefined || value === null) {
    return [];
  }

  const normalized = String(value).trim();
  return normalized ? [normalized] : [];
}

function normalizeSearchQuery(query = {}) {
  const searchColumns = toTrimmedArray(query.searchColumn);
  const searchValues = toTrimmedArray(query.searchValue);

  return {
    page: query.page,
    limit: query.limit,
    sortColumn: query.sortColumn,
    sortDirection: query.sortDirection,
    searchColumns,
    searchValues,
  };
}

function readSessionUserId(req) {
  return req.session?.userId;
}

function readCurrentCampId(req) {
  return req.session?.camp || null;
}

function readMainPageSessionState(req) {
  return {
    firstLogin: Boolean(req.session?.firstLogin),
    currentCampId: readCurrentCampId(req),
    campSelectionCleared: Boolean(req.session?.campSelectionCleared),
  };
}

module.exports = {
  normalizeSearchQuery,
  readSessionUserId,
  readCurrentCampId,
  readMainPageSessionState,
};
