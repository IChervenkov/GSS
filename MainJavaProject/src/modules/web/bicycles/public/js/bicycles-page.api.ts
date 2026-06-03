import { createRequestClient } from '/assets/shared/js/core/request-client.ts';

type UploadTemplateOptions = {
  onUploadProgress?: (progress: number) => void;
};

export function createBicyclesPageApi({ csrfToken = '' } = {}) {
  const client = createRequestClient();

  return {
    getOverview(query = {}, signal) {
      return client.getJson('/web/bicycles/data', { signal, query });
    },
    getRentalReport(query = {}, signal) {
      return client.getJson('/web/bicycles/report', { signal, query });
    },
    getRecentAssetRentals(query = {}, signal) {
      return client.getJson('/web/bicycles/report/recent-rentals', { signal, query });
    },
    getActiveSoldierAssignments(query = {}, signal) {
      return client.getJson('/web/bicycles/report/active-assignments', { signal, query });
    },
    searchReportAssets(query = {}, signal) {
      return client.getJson('/web/bicycles/report/assets', { signal, query });
    },
    searchReportSoldiers(query = {}, signal) {
      return client.getJson('/web/bicycles/report/soldiers', { signal, query });
    },
    getRentalReportDownloadUrl(query = {}) {
      const params = new URLSearchParams(query);
      return `/web/bicycles/report/download?${params.toString()}`;
    },
    getTemplateUrl() {
      return '/web/bicycles/template';
    },
    getHelmetTemplateUrl() {
      return '/web/bicycles/helmets/template';
    },
    searchSoldiers(query = {}, signal) {
      return client.getJson('/web/bicycles/soldiers', { signal, query });
    },
    searchHelmets(query = {}, signal) {
      return client.getJson('/web/bicycles/helmets', { signal, query });
    },
    addBicycle(payload, signal) {
      return client.postJson('/web/bicycles/add', { csrfToken, signal, body: payload });
    },
    addHelmet(payload, signal) {
      return client.postJson('/web/bicycles/helmets/add', { csrfToken, signal, body: payload });
    },
    editBicycle(payload, signal) {
      return client.postJson('/web/bicycles/edit', { csrfToken, signal, body: payload });
    },
    editHelmet(payload, signal) {
      return client.postJson('/web/bicycles/helmets/edit', { csrfToken, signal, body: payload });
    },
    deleteBicycle(identifier, signal) {
      return client.deleteJson('/web/bicycles/delete', {
        csrfToken,
        signal,
        body: { identifier },
      });
    },
    deleteHelmet(helmetId, signal) {
      return client.deleteJson('/web/bicycles/helmets/delete', {
        csrfToken,
        signal,
        body: { helmetId },
      });
    },
    rentBicycle(payload, signal) {
      return client.postJson('/web/bicycles/rent', { csrfToken, signal, body: payload });
    },
    returnBicycle(payload, signal) {
      return client.postJson('/web/bicycles/return', { csrfToken, signal, body: payload });
    },
    importBicycleTemplate(file, { onUploadProgress }: UploadTemplateOptions = {}) {
      return new Promise((resolve) => {
        const xhr = new XMLHttpRequest();
        const formData = new FormData();
        formData.append('file', file);

        xhr.open('POST', '/web/bicycles/import', true);
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
            message: body?.message || 'The bicycle template request could not be completed.',
          });
        };

        xhr.onerror = () => {
          resolve({
            ok: false,
            status: xhr.status || 0,
            data: null,
            body: null,
            message: 'The bicycle template request could not be completed.',
          });
        };

        xhr.send(formData);
      });
    },
    importHelmetTemplate(file, { onUploadProgress }: UploadTemplateOptions = {}) {
      return new Promise((resolve) => {
        const xhr = new XMLHttpRequest();
        const formData = new FormData();
        formData.append('file', file);

        xhr.open('POST', '/web/bicycles/helmets/import', true);
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
            message: body?.message || 'The helmet template request could not be completed.',
          });
        };

        xhr.onerror = () => {
          resolve({
            ok: false,
            status: xhr.status || 0,
            data: null,
            body: null,
            message: 'The helmet template request could not be completed.',
          });
        };

        xhr.send(formData);
      });
    },
  };
}
