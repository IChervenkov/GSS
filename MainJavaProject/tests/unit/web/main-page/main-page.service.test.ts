const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createMainPageService,
  getFirstCreatedCamp,
} = require('../../../../src/modules/web/main-page/application/services/main-page.service');

test('getFirstCreatedCamp returns the oldest camp by createdAt', () => {
  const result = getFirstCreatedCamp([
    { id: '2', name: 'Zulu', createdAt: '2024-06-01T10:00:00.000Z' },
    { id: '1', name: 'Alpha', createdAt: '2023-01-10T08:30:00.000Z' },
    { id: '3', name: 'Bravo', createdAt: '2025-02-14T12:00:00.000Z' },
  ]);

  assert.deepEqual(result, {
    id: '1',
    name: 'Alpha',
    createdAt: '2023-01-10T08:30:00.000Z',
  });
});

test('main page service assigns the first created camp when there is no current session camp', async () => {
  const calls = [];
  const service = createMainPageService({
    env: { ADMIN_USERNAME: 'admin@globalrts.gss' },
    repository: {
      findMainPageContext: async () => ({
        camps: [
          { id: 'camp-2', name: 'Zulu', createdAt: '2024-06-01T10:00:00.000Z' },
          { id: 'camp-1', name: 'Alpha', createdAt: '2023-01-10T08:30:00.000Z' },
        ],
        permissions: [],
        user: { id: 'user-1', username: 'operator@globalrts.gss' },
      }),
    },
  });

  const result = await service.getMainPage({
    userId: 'user-1',
    sessionState: {},
    mainSession: {
      setCurrentCamp: (campId) => calls.push(`set:${campId}`),
      clearCurrentCamp: () => calls.push('clear'),
      save: async () => calls.push('save'),
    },
  });

  assert.equal(result.campId, 'camp-1');
  assert.equal(result.currentCampName, 'Alpha');
  assert.deepEqual(calls, ['set:camp-1', 'save']);
});

test('main page service keeps a valid session camp instead of replacing it with the oldest camp', async () => {
  const calls = [];
  const service = createMainPageService({
    env: { ADMIN_USERNAME: 'admin@globalrts.gss' },
    repository: {
      findMainPageContext: async () => ({
        camps: [
          { id: 'camp-2', name: 'Zulu', createdAt: '2024-06-01T10:00:00.000Z' },
          { id: 'camp-1', name: 'Alpha', createdAt: '2023-01-10T08:30:00.000Z' },
        ],
        permissions: [],
        user: { id: 'user-1', username: 'operator@globalrts.gss' },
      }),
    },
  });

  const result = await service.getMainPage({
    userId: 'user-1',
    sessionState: { currentCampId: 'camp-2' },
    mainSession: {
      setCurrentCamp: (campId) => calls.push(`set:${campId}`),
      clearCurrentCamp: () => calls.push('clear'),
      save: async () => calls.push('save'),
    },
  });

  assert.equal(result.campId, 'camp-2');
  assert.equal(result.currentCampName, 'Zulu');
  assert.deepEqual(calls, ['set:camp-2', 'save']);
});

test('main page service keeps camp scope empty after selection was explicitly cleared', async () => {
  const calls = [];
  const service = createMainPageService({
    env: { ADMIN_USERNAME: 'admin@globalrts.gss' },
    repository: {
      findMainPageContext: async () => ({
        camps: [
          { id: 'camp-2', name: 'Zulu', createdAt: '2024-06-01T10:00:00.000Z' },
          { id: 'camp-1', name: 'Alpha', createdAt: '2023-01-10T08:30:00.000Z' },
        ],
        permissions: [],
        user: { id: 'user-1', username: 'operator@globalrts.gss' },
      }),
    },
  });

  const result = await service.getMainPage({
    userId: 'user-1',
    sessionState: { currentCampId: null, campSelectionCleared: true },
    mainSession: {
      setCurrentCamp: (campId) => calls.push(`set:${campId}`),
      clearCurrentCamp: () => calls.push('clear'),
      save: async () => calls.push('save'),
    },
  });

  assert.equal(result.campId, null);
  assert.equal(result.currentCampName, null);
  assert.deepEqual(calls, ['clear', 'save']);
});

test('camp selector data keeps inaccessible camps visible but marks them unavailable', async () => {
  const service = createMainPageService({
    env: {},
    repository: {
      listCampsAndPermissions: async () => ({
        camps: [
          { id: 'camp-1', name: 'Alpha', createdAt: '2024-01-01', canAccess: true },
          { id: 'camp-2', name: 'Bravo', createdAt: '2024-01-02', canAccess: false },
        ],
        permissions: [],
        total: 2,
      }),
    },
  });

  const result = await service.getCampSelectorData({
    userId: 'user-1',
    page: 1,
    limit: 10,
  });

  assert.equal(result.status, 200);
  assert.deepEqual(result.body.camps.map((camp) => ({ id: camp.id, canAccess: camp.canAccess })), [
    { id: 'camp-1', canAccess: true },
    { id: 'camp-2', canAccess: false },
  ]);
});

test('setCurrentCamp clears the current camp when campId is empty', async () => {
  const calls = [];
  const service = createMainPageService({
    env: {},
    repository: {
      campExists: async () => {
        throw new Error('campExists should not be called when clearing the current camp');
      },
    },
  });

  const result = await service.setCurrentCamp({
    userId: 'user-1',
    campId: '',
    mainSession: {
      clearCurrentCamp: () => calls.push('clear'),
      save: async () => calls.push('save'),
    },
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.campId, null);
  assert.deepEqual(calls, ['clear', 'save']);
});
