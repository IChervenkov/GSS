export const usernamePattern = /^(?=.{3,64}$)[\p{L}\p{N}][\p{L}\p{N}_.@+\- ]*[\p{L}\p{N}]$/u;
export const passwordPattern =
  /^(?=.{8,128}$)(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])[ -~]+$/;

export function validateLoginFields({ username, password }) {
  return {
    validUsername: username ? usernamePattern.test(username) : '',
    validPassword: password ? passwordPattern.test(password.trim()) : '',
  };
}
