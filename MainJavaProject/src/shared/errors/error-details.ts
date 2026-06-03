// @ts-nocheck
function normalizePath(path) {
  if (Array.isArray(path)) return path.map((segment) => String(segment));
  if (path === undefined || path === null || path === '') return [];
  return [String(path)];
}

function normalizeValidationDetail(detail = {}) {
  if (typeof detail === 'string') {
    return { message: detail, path: [] };
  }

  return {
    message: detail.message || 'Invalid input.',
    path: normalizePath(detail.path),
    ...(detail.type ? { type: detail.type } : {}),
    ...(detail.context && typeof detail.context === 'object' ? { context: detail.context } : {}),
  };
}

function normalizeErrorDetails(details, { code } = {}) {
  if (details === undefined || details === null) return [];
  const detailList = Array.isArray(details) ? details : [details];

  if (code === 'VALIDATION_ERROR') {
    return detailList.map((detail) => normalizeValidationDetail(detail));
  }

  return detailList.map((detail) => {
    if (detail && typeof detail === 'object') return detail;
    return { message: String(detail) };
  });
}

module.exports = {
  normalizeErrorDetails,
  normalizeValidationDetail,
};
