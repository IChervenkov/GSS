const { saveSession } = require('../../../../../shared/utils/session-utils');

function setCurrentCamp(req, campId) {
  req.session.camp = campId;
}

function clearCurrentCamp(req) {
  delete req.session.camp;
}

function buildMainSession(req) {
  return {
    setCurrentCamp: (campId) => setCurrentCamp(req, campId),
    clearCurrentCamp: () => clearCurrentCamp(req),
    save: () => saveSession(req),
  };
}

module.exports = {
  setCurrentCamp,
  clearCurrentCamp,
  buildMainSession,
};
