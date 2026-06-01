import { createRequestClient } from '/assets/shared/js/core/request-client.ts';

export function createMainPageApi({ csrfToken = '' } = {}) {
  const client = createRequestClient();

  return {
    getCampTemplateUrl() {
      return '/web/camp/template';
    },
    getCamps(query = {}, signal) {
      return client.getJson('/web/camp/data', { signal, query });
    },
    setCamp(campId, signal) {
      return client.postJson('/web/camp/set', { csrfToken, signal, body: { campId } });
    },
    addCamp(campName, signal) {
      return client.postJson('/web/camp/add', { csrfToken, signal, body: { campName } });
    },
    importCampTemplate(file, { onUploadProgress } = {}) {
      return new Promise((resolve) => {
        const xhr = new XMLHttpRequest();
        const formData = new FormData();
        formData.append('file', file);

        xhr.open('POST', '/web/camp/import', true);
        xhr.withCredentials = true;
        if (csrfToken) {
          xhr.setRequestHeader('CSRF-Token', csrfToken);
        }

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
            message: body?.message || 'The camp template request could not be completed.',
          });
        };

        xhr.onerror = () => {
          resolve({
            ok: false,
            status: xhr.status || 0,
            data: null,
            body: null,
            message: 'The camp template request could not be completed.',
          });
        };

        xhr.send(formData);
      });
    },
    editCamp(campId, campName, signal) {
      return client.postJson('/web/camp/edit', { csrfToken, signal, body: { campId, campName } });
    },
    deleteCamp(campId, signal) {
      return client.postJson('/web/camp/delete', { csrfToken, signal, body: { campId } });
    },
    getUsers(query = {}, signal) {
      return client.getJson('/web/user/data', { signal, query });
    },
    addUser(username, signal) {
      return client.postJson('/web/user/add', { csrfToken, signal, body: { username } });
    },
    editUser(payload, signal) {
      return client.postJson('/web/user/edit', { csrfToken, signal, body: payload });
    },
    deleteUsers(codes, signal) {
      return client.deleteJson('/web/user/delete', { csrfToken, signal, body: { codes } });
    },
    deleteUser(userId, signal) {
      return client.deleteJson('/web/user/delete', {
        csrfToken,
        signal,
        body: { codes: [userId] },
      });
    },
    resolveUserRequest(requestId, decision, signal) {
      return client.postJson('/web/user/request/decision', {
        csrfToken,
        signal,
        body: { requestId, decision },
      });
    },
    submitUserMessage(payload, signal) {
      return client.postJson('/web/user/message', { csrfToken, signal, body: payload });
    },
    getAdminInbox(query = {}, signal) {
      return client.getJson('/web/admin/inbox', { signal, query });
    },
    updateUserMessageStatus(messageId, status, signal) {
      return client.postJson('/web/admin/message/status', {
        csrfToken,
        signal,
        body: { messageId, status },
      });
    },
    deleteAdminInboxItem(itemId, itemKind, signal) {
      return client.deleteJson('/web/admin/inbox', {
        csrfToken,
        signal,
        body: { itemId, itemKind },
      });
    },
    getPermissions(query = {}, signal) {
      return client.getJson('/web/permissions/data', { signal, query });
    },
    savePermissions(permissions, signal) {
      return client.postJson('/web/permissions/save', { csrfToken, signal, body: { permissions } });
    },
    getCurrentUserPermissions(signal) {
      return client.getJson('/web/permission/current-user', { signal });
    },
  };
}
