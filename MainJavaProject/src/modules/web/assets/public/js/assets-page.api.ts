import { createRequestClient } from '/assets/shared/js/core/request-client.ts';

export function createAssetsPageApi({ csrfToken = '' } = {}) {
  const client = createRequestClient();

  return {
    getTemplateUrl() {
      return '/web/assets/template';
    },
    getAssetTypeTemplateUrl() {
      return '/web/assets/types/template';
    },
    getCleanItemTemplateUrl() {
      return '/web/assets/clean-items/template';
    },
    getAssetsData(query = {}, signal) {
      return client.getJson('/web/assets/data', { signal, query });
    },
    addAsset(payload, signal) {
      return client.postJson('/web/assets', { csrfToken, signal, body: payload });
    },
    editAsset(payload, signal) {
      return client.postJson('/web/assets/edit', { csrfToken, signal, body: payload });
    },
    deleteAsset(assetId, signal) {
      return client.deleteJson('/web/assets', {
        csrfToken,
        signal,
        body: { assetId },
      });
    },
    addAssetType(payload, signal) {
      return client.postJson('/web/assets/types', { csrfToken, signal, body: payload });
    },
    editAssetType(payload, signal) {
      return client.postJson('/web/assets/types/edit', { csrfToken, signal, body: payload });
    },
    deleteAssetType(typeId, signal) {
      return client.deleteJson('/web/assets/types', {
        csrfToken,
        signal,
        body: { typeId },
      });
    },
    bulkUpdateAssetTypes(payload, signal) {
      return client.postJson('/web/assets/types/bulk', { csrfToken, signal, body: payload });
    },
    addCleanItem(payload, signal) {
      return client.postJson('/web/assets/clean-items', { csrfToken, signal, body: payload });
    },
    editCleanItem(payload, signal) {
      return client.postJson('/web/assets/clean-items/edit', { csrfToken, signal, body: payload });
    },
    moveCleanItem(payload, signal) {
      return client.postJson('/web/assets/clean-items/move', { csrfToken, signal, body: payload });
    },
    deleteCleanItem(itemId, signal) {
      return client.deleteJson('/web/assets/clean-items', {
        csrfToken,
        signal,
        body: { itemId },
      });
    },
    bulkUpdateCleanItems(payload, signal) {
      return client.postJson('/web/assets/clean-items/bulk', { csrfToken, signal, body: payload });
    },
    restartInventory(signal) {
      return client.postJson('/web/assets/inventory/restart', { csrfToken, signal, body: {} });
    },
    bulkUpdateAssets(payload, signal) {
      return client.postJson('/web/assets/bulk', { csrfToken, signal, body: payload });
    },
    uploadTemplate(url, file, { onUploadProgress, errorMessage } = {}) {
      return new Promise((resolve) => {
        const xhr = new XMLHttpRequest();
        const formData = new FormData();
        formData.append('file', file);

        xhr.open('POST', url, true);
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
            message: body?.message || errorMessage || 'The template request could not be completed.',
          });
        };

        xhr.onerror = () => {
          resolve({
            ok: false,
            status: xhr.status || 0,
            data: null,
            body: null,
            message: errorMessage || 'The template request could not be completed.',
          });
        };

        xhr.send(formData);
      });
    },
    importAssetTemplate(file, options = {}) {
      return this.uploadTemplate('/web/assets/import', file, {
        ...options,
        errorMessage: 'The asset template request could not be completed.',
      });
    },
    importAssetTypeTemplate(file, options = {}) {
      return this.uploadTemplate('/web/assets/types/import', file, {
        ...options,
        errorMessage: 'The asset type template request could not be completed.',
      });
    },
    importCleanItemTemplate(file, options = {}) {
      return this.uploadTemplate('/web/assets/clean-items/import', file, {
        ...options,
        errorMessage: 'The clean item template request could not be completed.',
      });
    },
  };
}
