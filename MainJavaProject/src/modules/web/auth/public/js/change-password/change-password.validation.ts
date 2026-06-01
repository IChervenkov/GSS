export const usernamePattern = /^(?=.{3,64}$)[\p{L}\p{N}][\p{L}\p{N}_.@+\- ]*[\p{L}\p{N}]$/u;
export const passwordPattern =
  /^(?=.{8,128}$)(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])[ -~]+$/;

export function validateChangePassword({
  username,
  currentPassword,
  newPassword,
  confirmPassword,
}) {
  return {
    validUsername: usernamePattern.test(username),
    validCurrent: passwordPattern.test(currentPassword.trim()),
    validNew: passwordPattern.test(newPassword) && newPassword !== currentPassword,
    validConfirm: confirmPassword === newPassword && confirmPassword.length > 0,
  };
}

export function getPasswordChecks(currentPassword, newPassword) {
  return {
    len: newPassword.length >= 8,
    upper: /[A-Z]/.test(newPassword),
    lower: /[a-z]/.test(newPassword),
    num: /\d/.test(newPassword),
    sym: /[^A-Za-z0-9]/.test(newPassword),
    diff: newPassword.length > 0 && newPassword !== currentPassword,
  };
}
