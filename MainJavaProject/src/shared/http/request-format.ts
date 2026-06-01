function wantsJsonResponse(req = {}) {
  const accept = String(req.headers?.accept || '').toLowerCase();
  const contentType = String(req.headers?.['content-type'] || '').toLowerCase();

  return Boolean(
    req.xhr ||
      contentType.includes('application/json') ||
      (accept.includes('application/json') && !accept.includes('text/html')),
  );
}

module.exports = {
  wantsJsonResponse,
};
