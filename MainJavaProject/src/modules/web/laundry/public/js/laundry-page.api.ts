import { createRequestClient } from '/assets/shared/js/core/request-client.ts';

type UploadTemplateOptions = {
  onUploadProgress?: (progress: number) => void;
};

export function createLaundryPageApi({ csrfToken = '' } = {}) {
  const client = createRequestClient();

  return {
    getTemplateUrl() {
      return '/web/laundry/template';
    },
    getOverview(query = {}, signal) {
      return client.getJson('/web/laundry/data', { signal, query });
    },
    getLaundryReport(query = {}, signal) {
      return client.getJson('/web/laundry/report', { signal, query });
    },
    getLaundryReportDownloadUrl(query = {}) {
      const params = new URLSearchParams(query);
      return `/web/laundry/report/download?${params.toString()}`;
    },
    searchAvailableBags(query = {}, signal) {
      return client.getJson('/web/laundry/available-bags', { signal, query });
    },
    addBag(payload, signal) {
      return client.postJson('/web/laundry/bags', { csrfToken, signal, body: payload });
    },
    editBag(payload, signal) {
      return client.postJson('/web/laundry/bags/edit', { csrfToken, signal, body: payload });
    },
    deleteBag(bagId, signal) {
      return client.deleteJson('/web/laundry/bags', {
        csrfToken,
        signal,
        body: { bagId },
      });
    },
    addBagToStatus(payload, signal) {
      return client.postJson('/web/laundry/bags/add-to-status', {
        csrfToken,
        signal,
        body: payload,
      });
    },
    moveBag(payload, signal) {
      return client.postJson('/web/laundry/bags/move', { csrfToken, signal, body: payload });
    },
    recordLinenExchange(bagId, signal) {
      return client.postJson('/web/laundry/bags/linen-exchange', {
        csrfToken,
        signal,
        body: { bagId },
      });
    },
    removeBagFromStatus(bagId, signal) {
      return client.postJson('/web/laundry/bags/remove-from-status', {
        csrfToken,
        signal,
        body: { bagId },
      });
    },
    bulkUpdateBags(payload, signal) {
      return client.postJson('/web/laundry/bags/bulk', { csrfToken, signal, body: payload });
    },
    importBagTemplate(file, { onUploadProgress }: UploadTemplateOptions = {}) {
      return new Promise((resolve) => {
        const xhr = new XMLHttpRequest();
        const formData = new FormData();
        formData.append('file', file);

        xhr.open('POST', '/web/laundry/bags/import', true);
        xhr.withCredentials = true;
        if (csrfToken) xhr.setRequestHeader('CSRF-Token', csrfToken);

        xhr.upload.onprogress = (event) => {
          if (!event.lengthComputable || typeof onUploadProgress !== 'function') return;
          onUploadProgress(Math.round((event.loaded / event.total) * 100));
        };

        xhr.onload = () => {
          let body = null;
          try {
            body = xhr.responseText ? JSON.parse(xhr.responseText) : null;
          } catch {
            body = null;
          }

          resolve({
            ok: xhr.status >= 200 && xhr.status < 300,
            status: xhr.status,
            data: body,
            body,
            message: body?.message || 'The laundry template request could not be completed.',
          });
        };

        xhr.onerror = () => {
          resolve({
            ok: false,
            status: xhr.status || 0,
            data: null,
            body: null,
            message: 'The laundry template request could not be completed.',
          });
        };

        xhr.send(formData);
      });
    },
  };
}
