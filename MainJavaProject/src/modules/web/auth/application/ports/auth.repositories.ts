function assertMethods(name, repository, methods) {
  for (const method of methods) {
    if (typeof repository?.[method] !== 'function') {
      throw new Error(`${name} is missing required method: ${method}`);
    }
  }
  return repository;
}

function createUserAuthPort(repository) {
  return assertMethods('userAuthRepository', repository, [
    'findUserByUsername',
    'findUserTotpSecretById',
    'updateUserTotpSecret',
    'userHasPermission',
  ]);
}

function createUserRequestPort(repository) {
  const normalizedRepository = repository || {};
  normalizedRepository.createUserRequest =
    normalizedRepository.createUserRequest || normalizedRepository.createApprovalRequest;
  normalizedRepository.findUserRequest =
    normalizedRepository.findUserRequest || normalizedRepository.findApprovalRequest;
  normalizedRepository.resolveUserRequest =
    normalizedRepository.resolveUserRequest || normalizedRepository.resolveApprovalRequest;
  return assertMethods('userRequestRepository', normalizedRepository, [
    'createUserRequest',
    'findUserRequest',
    'resolveUserRequest',
  ]);
}

function createPasswordChangePort(repository) {
  return assertMethods('passwordChangeRepository', repository, [
    'findPasswordChangeRequest',
    'completePasswordChange',
  ]);
}

module.exports = {
  createUserAuthPort,
  createUserRequestPort,
  createPasswordChangePort,
};
