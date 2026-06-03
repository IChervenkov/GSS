import { createRequestClient } from '/assets/shared/js/core/request-client.ts';

type UploadTemplateOptions = {
  onUploadProgress?: (progress: number) => void;
};

export function createAccommodationPageApi({ csrfToken = '' } = {}) {
  const client = createRequestClient();

  function importTemplate(path, file, { onUploadProgress }: UploadTemplateOptions = {}) {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      formData.append('file', file);

      xhr.open('POST', path, true);
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
          message: body?.message || 'The accommodation template request could not be completed.',
        });
      };

      xhr.onerror = () => {
        resolve({
          ok: false,
          status: xhr.status || 0,
          data: null,
          body: null,
          message: 'The accommodation template request could not be completed.',
        });
      };

      xhr.send(formData);
    });
  }

  return {
    getOverview(query = {}, signal) {
      return client.getJson('/web/accommodation/data', { signal, query });
    },
    searchLookup(query = {}, signal) {
      return client.getJson('/web/accommodation/lookups', { signal, query });
    },
    addBuilding(body, signal) {
      return client.postJson('/web/accommodation/buildings', { csrfToken, signal, body });
    },
    editBuilding(body, signal) {
      return client.postJson('/web/accommodation/buildings/edit', { csrfToken, signal, body });
    },
    deleteBuilding(buildingId, signal) {
      return client.deleteJson('/web/accommodation/buildings/delete', {
        csrfToken,
        signal,
        body: { buildingId },
      });
    },
    addRoom(body, signal) {
      return client.postJson('/web/accommodation/rooms', { csrfToken, signal, body });
    },
    editRoom(body, signal) {
      return client.postJson('/web/accommodation/rooms/edit', { csrfToken, signal, body });
    },
    deleteRoom(roomId, signal) {
      return client.deleteJson('/web/accommodation/rooms/delete', {
        csrfToken,
        signal,
        body: { roomId },
      });
    },
    addKey(body, signal) {
      return client.postJson('/web/accommodation/keys', { csrfToken, signal, body });
    },
    editKey(body, signal) {
      return client.postJson('/web/accommodation/keys/edit', { csrfToken, signal, body });
    },
    deleteKey(keyId, signal) {
      return client.deleteJson('/web/accommodation/keys/delete', {
        csrfToken,
        signal,
        body: { keyId },
      });
    },
    issueKey(body, signal) {
      return client.postJson('/web/accommodation/keys/issue', { csrfToken, signal, body });
    },
    releaseKey(keyId, signal) {
      return client.postJson('/web/accommodation/keys/release', {
        csrfToken,
        signal,
        body: { keyId },
      });
    },
    addSoldier(body, signal) {
      return client.postJson('/web/accommodation/soldiers', { csrfToken, signal, body });
    },
    editSoldier(body, signal) {
      return client.postJson('/web/accommodation/soldiers/edit', { csrfToken, signal, body });
    },
    deleteSoldier(soldierId, signal) {
      return client.deleteJson('/web/accommodation/soldiers/delete', {
        csrfToken,
        signal,
        body: { soldierId },
      });
    },
    accommodateSoldier(body, signal) {
      return client.postJson('/web/accommodation/soldiers/accommodate', {
        csrfToken,
        signal,
        body,
      });
    },
    accommodateSoldiers(body, signal) {
      return client.postJson('/web/accommodation/soldiers/accommodate/multiple', {
        csrfToken,
        signal,
        body,
      });
    },
    dischargeSoldier(soldierId, signal) {
      return client.postJson('/web/accommodation/soldiers/discharge', {
        csrfToken,
        signal,
        body: { soldierId },
      });
    },
    releaseRooms(roomIds, signal) {
      return client.postJson('/web/accommodation/rooms/release', {
        csrfToken,
        signal,
        body: { roomIds },
      });
    },
    releaseBuildings(buildingIds, signal) {
      return client.postJson('/web/accommodation/buildings/release', {
        csrfToken,
        signal,
        body: { buildingIds },
      });
    },
    moveSoldier(body, signal) {
      return client.postJson('/web/accommodation/soldiers/move', { csrfToken, signal, body });
    },
    swapSoldiers(body, signal) {
      return client.postJson('/web/accommodation/soldiers/swap', { csrfToken, signal, body });
    },
    addAdditionalItem(body, signal) {
      return client.postJson('/web/accommodation/additional-items', { csrfToken, signal, body });
    },
    editAdditionalItem(body, signal) {
      return client.postJson('/web/accommodation/additional-items/edit', {
        csrfToken,
        signal,
        body,
      });
    },
    deleteAdditionalItem(itemId, signal) {
      return client.deleteJson('/web/accommodation/additional-items/delete', {
        csrfToken,
        signal,
        body: { itemId },
      });
    },
    importBuildingTemplate(file, options = {}) {
      return importTemplate('/web/accommodation/buildings/import', file, options);
    },
    importRoomTemplate(file, options = {}) {
      return importTemplate('/web/accommodation/rooms/import', file, options);
    },
    importKeyTemplate(file, options = {}) {
      return importTemplate('/web/accommodation/keys/import', file, options);
    },
    importSoldierTemplate(file, options = {}) {
      return importTemplate('/web/accommodation/soldiers/import', file, options);
    },
    importAdditionalItemTemplate(file, options = {}) {
      return importTemplate('/web/accommodation/additional-items/import', file, options);
    },
  };
}
