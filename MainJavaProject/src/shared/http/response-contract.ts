function renderResponse(view, model = {}, status = 200) {
  return {
    type: 'render',
    status,
    view,
    model,
  };
}

function redirectResponse(location, status = 303) {
  return {
    type: 'redirect',
    status,
    location,
  };
}

function jsonResponse(body = {}, status = 200) {
  return {
    type: 'json',
    status,
    body,
  };
}

function fileResponse({ buffer, fileName, contentType, status = 200 } = {}) {
  return {
    type: 'file',
    status,
    buffer: buffer ?? Buffer.alloc(0),
    fileName: String(fileName || 'download.bin'),
    contentType: String(contentType || 'application/octet-stream'),
  };
}

function isResponseContract(value) {
  return Boolean(value) && typeof value === 'object' && typeof value.type === 'string';
}

function sendResponseContract(res, contract) {
  if (!isResponseContract(contract)) {
    return contract;
  }

  if (contract.type === 'render') {
    return res.status(contract.status).render(contract.view, contract.model);
  }

  if (contract.type === 'redirect') {
    return res.redirect(contract.status, contract.location);
  }

  if (contract.type === 'file') {
    res.setHeader('Content-Type', contract.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${contract.fileName}"`);
    return res.status(contract.status).send(contract.buffer);
  }

  if (contract.type === 'json') {
    return res.status(contract.status).json(contract.body);
  }

  throw new Error(`Unsupported response contract type: ${contract.type}`);
}

module.exports = {
  fileResponse,
  isResponseContract,
  jsonResponse,
  redirectResponse,
  renderResponse,
  sendResponseContract,
};
