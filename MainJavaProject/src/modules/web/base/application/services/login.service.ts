function createLoginService() {
  async function createLoginView({ authContext }) {
    await authContext.regenerateSession();
    const csrfToken = authContext.generateToken();
    await authContext.saveSession();
    return { title: 'LogIn', csrfToken };
  }

  return {
    createLoginView,
  };
}

module.exports = { createLoginService };
