const { saveSession } = require('../../../../../shared/utils/session-utils');

function setCurrentCamp(req, campId) {
  req.session.camp = campId;
  delete req.session.campSelectionCleared;
}

function clearCurrentCamp(req) {
  delete req.session.camp;
  req.session.campSelectionCleared = true;
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
