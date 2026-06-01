function createNextRecorder() {
  const calls = [];
  const next = (error) => {
    calls.push(error || null);
  };
  return { next, calls };
}

function createReqRes({ method = 'POST', body = {}, query = {}, headers = {}, session = {} } = {}) {
  const req = { method, body, query, headers, session };
  const responseState = {
    statusCode: 200,
    jsonBody: null,
    clearedCookies: [],
    ended: false,
  };
  const res = {
    locals: {},
    status(code) {
      responseState.statusCode = code;
      return this;
    },
    json(payload) {
      responseState.jsonBody = payload;
      return this;
    },
    clearCookie(name, options) {
      responseState.clearedCookies.push({ name, options });
      return this;
    },
    end() {
      responseState.ended = true;
      return this;
    },
  };
  return { req, res, responseState };
}

module.exports = {
  createNextRecorder,
  createReqRes,
};
