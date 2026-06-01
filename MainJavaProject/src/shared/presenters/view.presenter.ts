function presentRenderModel(model = {}) {
  return { ...model };
}

function presentJson(result = {}) {
  if (typeof result !== 'object' || result === null) {
    return { status: 200, body: result };
  }

  if (
    Object.prototype.hasOwnProperty.call(result, 'status') ||
    Object.prototype.hasOwnProperty.call(result, 'body')
  ) {
    return {
      status: result.status || 200,
      body: result.body || {},
    };
  }

  return {
    status: 200,
    body: result,
  };
}

module.exports = {
  presentRenderModel,
  presentJson,
};
