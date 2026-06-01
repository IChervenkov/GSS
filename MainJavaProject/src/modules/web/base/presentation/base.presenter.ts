const { renderResponse } = require('../../../../shared/http/response-contract');

function presentBaseView(model) {
  return renderResponse(
    'login',
    {
      title: String(model?.title || 'LogIn'),
      csrfToken: model?.csrfToken || null,
    },
    200,
  );
}

module.exports = { presentBaseView };
