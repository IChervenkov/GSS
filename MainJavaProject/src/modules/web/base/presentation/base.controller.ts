const { generateToken } = require('../../../../core/config/csrf');
const { saveSession, regenerateSession } = require('../../../../shared/utils/session-utils');
const { presentBaseView } = require('./base.presenter');

function createBaseController({ useCases }) {
  const getAuthContext = (req) => ({
    regenerateSession: () => regenerateSession(req),
    saveSession: () => saveSession(req),
    generateToken: () => generateToken(req),
  });

  return {
    basePage: async (req) => {
      const model = await useCases.createBaseView({ authContext: getAuthContext(req) });
      return presentBaseView(model);
    },
  };
}

module.exports = { createBaseController };
