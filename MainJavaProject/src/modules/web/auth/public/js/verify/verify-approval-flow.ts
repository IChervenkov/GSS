// @ts-nocheck
import { debounce } from '/assets/shared/js/core/dom.ts';

export function createApprovalFlow({ socket, onResolved }) {
  let approvalRequestId = '';
  let approvalStatus = null;
  let approvalExpiresAt = null;
  let approvalTimeoutTimer = null;
  let approvalPollTimer = null;
  let resolver = null;
  let rejecter = null;
  let activeCycle = 0;
  let lastResolvedVersion = 0;

  const stopTimers = () => {
    if (approvalTimeoutTimer) window.clearTimeout(approvalTimeoutTimer);
    if (approvalPollTimer) window.clearInterval(approvalPollTimer);
    approvalTimeoutTimer = null;
    approvalPollTimer = null;
  };

  const reset = ({ preserveCycle = true } = {}) => {
    approvalRequestId = '';
    approvalStatus = null;
    approvalExpiresAt = null;
    stopTimers();
    resolver = null;
    rejecter = null;
    lastResolvedVersion = 0;
    if (!preserveCycle) activeCycle = 0;
  };

  const finalize = ({ status, requestId, cycle, version = 1 } = {}) => {
    if (!approvalRequestId) return false;
    if (!requestId || String(requestId) !== String(approvalRequestId)) return false;
    if (cycle && cycle !== activeCycle) return false;
    if (version < lastResolvedVersion) return false;

    approvalStatus = status || approvalStatus || null;
    lastResolvedVersion = version;

    const resolve = resolver;
    const reject = rejecter;
    const finalStatus = approvalStatus;
    const finalRequestId = String(requestId);
    const finalCycle = activeCycle;

    reset();
    onResolved?.({ status: finalStatus, requestId: finalRequestId, cycle: finalCycle, version });

    if (!resolve && !reject) return true;
    if (!finalStatus || finalStatus === 'pending') {
      reject?.(new Error('Missing or invalid approval status.'));
      return true;
    }

    resolve?.({ status: finalStatus, requestId: finalRequestId, cycle: finalCycle, version });
    return true;
  };

  const handleResolved = debounce((payload) => {
    finalize({
      status: payload?.status,
      requestId: payload?.requestId,
      version: Number(payload?.version || 1),
    });
  }, 120);

  socket?.off('approval:resolved', handleResolved);
  socket?.off('user:request:resolved', handleResolved);
  socket?.on('approval:resolved', handleResolved);
  socket?.on('user:request:resolved', handleResolved);

  return {
    reset,
    getActiveCycle() {
      return activeCycle;
    },
    watch({ requestId, expiresAt, poll }) {
      activeCycle += 1;
      const watchCycle = activeCycle;

      return new Promise((resolve, reject) => {
        if (!requestId) {
          reject(new Error('Missing requestId.'));
          return;
        }

        approvalRequestId = String(requestId);
        approvalStatus = 'pending';
        approvalExpiresAt = expiresAt ? new Date(expiresAt).getTime() : null;
        stopTimers();
        resolver = resolve;
        rejecter = reject;
        lastResolvedVersion = 0;

        if (approvalExpiresAt && approvalExpiresAt > Date.now()) {
          approvalTimeoutTimer = window.setTimeout(() => {
            if (approvalRequestId) {
              finalize({
                status: 'expired',
                requestId: approvalRequestId,
                cycle: watchCycle,
                version: 1,
              });
            }
          }, approvalExpiresAt - Date.now());
        }

        const runPoll = async () => {
          if (!approvalRequestId || watchCycle !== activeCycle || typeof poll !== 'function')
            return;
          try {
            const result = await poll(approvalRequestId, watchCycle);
            if (result?.status) {
              finalize({
                status: result.status,
                requestId: approvalRequestId,
                cycle: watchCycle,
                version: Number(result.version || 1),
              });
            }
          } catch {
            // polling is best-effort only
          }
        };

        void runPoll();
        approvalPollTimer = window.setInterval(runPoll, 2000);
      });
    },
  };
}
