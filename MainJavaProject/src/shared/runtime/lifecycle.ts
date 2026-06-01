let shuttingDown = false;
let shutdownSignal = null;
let startedAt = new Date().toISOString();

function markShuttingDown(signal = 'unknown') {
  shuttingDown = true;
  shutdownSignal = signal;
}

function resetLifecycleState() {
  shuttingDown = false;
  shutdownSignal = null;
  startedAt = new Date().toISOString();
}

function getLifecycleState() {
  return {
    shuttingDown,
    shutdownSignal,
    startedAt,
  };
}

module.exports = {
  markShuttingDown,
  resetLifecycleState,
  getLifecycleState,
};
