const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createAccommodationService,
} = require('../../../../src/modules/web/accommodation/application/services/upcoming-accommodation.service');
const { AppError } = require('../../../../src/shared/errors/app-error');

test('getUpcomingSummary groups accommodation and release names for current and previous day window', async () => {
  const service = createAccommodationService({
    repository: {
      findUpcomingActionsByCamp: async (campId) => {
        assert.equal(campId, 'camp-1');
        return [
          {
            soldierName: 'Alice',
            upcomingAccommodation: '2030-06-10',
            upcomingRelease: null,
            upcomingAccommodationKeyName: 'A-101-1',
          },
          {
            soldierName: 'Bob',
            upcomingAccommodation: '2030-06-09',
            upcomingRelease: null,
            upcomingAccommodationKeyName: 'B-202-2',
          },
          {
            soldierName: 'Carol',
            upcomingAccommodation: null,
            upcomingRelease: '2030-06-10',
            keyId: 'key-3',
            keyName: 'C-303-3',
          },
          {
            soldierName: 'Dave',
            upcomingAccommodation: null,
            upcomingRelease: '2030-06-09',
            keyId: 'key-4',
            keyName: 'D-404-4',
          },
          {
            soldierName: 'Eve',
            upcomingAccommodation: '2030-06-08',
            upcomingRelease: '2030-06-08',
          },
          {
            soldierName: 'Frank',
            upcomingAccommodation: '2030-06-10',
            upcomingRelease: null,
            keyId: 'key-6',
            keyName: 'F-606-6',
          },
          {
            soldierName: 'Grace',
            upcomingAccommodation: null,
            upcomingRelease: '2030-06-10',
            keyId: null,
            keyName: null,
            dateFree: '2030-06-10T09:00:00.000Z',
          },
          {
            soldierName: 'Heidi',
            upcomingAccommodation: '2030-06-10',
            upcomingRelease: '2030-06-10',
            dateAccommodation: '2030-06-10T08:00:00.000Z',
            dateFree: '2030-06-10T10:00:00.000Z',
          },
        ];
      },
    },
    now: () => new Date('2030-06-10T08:00:00.000Z'),
  });

  const result = await service.getUpcomingSummary({ campId: 'camp-1' });
  assert.deepEqual(result, {
    isAccommodation: true,
    isRelease: true,
    accommodationList: ['Alice - Upcoming key: A-101-1', 'Bob - Upcoming key: B-202-2'],
    releaseList: ['Carol - Key: C-303-3', 'Dave - Key: D-404-4'],
  });
});

test('getUpcomingSummary rejects when camp context is missing', async () => {
  const service = createAccommodationService({
    repository: {
      findUpcomingActionsByCamp: async () => [],
    },
  });

  await assert.rejects(
    () => service.getUpcomingSummary({ campId: '' }),
    (error) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.status, 400);
      assert.equal(error.code, 'CAMP_CONTEXT_REQUIRED');
      return true;
    },
  );
});
