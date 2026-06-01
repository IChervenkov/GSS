const test = require('node:test');
const assert = require('node:assert/strict');

const {
  presentAccommodationSummary,
} = require('../../../src/modules/web/accommodation/presentation/accommodation.presenter');
const {
  toUpcomingSummaryResponseDto,
} = require('../../../src/modules/web/accommodation/presentation/http/accommodation.response.dto');
const {
  additionalItemAddRequestDto,
  soldierAddRequestDto,
} = require('../../../src/modules/web/accommodation/presentation/http/accommodation.request.dto');

test('accommodation presenter and response DTO preserve normalized body payloads', () => {
  const result = {
    status: 206,
    body: {
      upcoming: [{ id: 'room-1', building: 'Alpha' }],
      windowDays: 7,
    },
  };

  assert.deepEqual(toUpcomingSummaryResponseDto(result), result.body);

  const presented = presentAccommodationSummary(result);
  assert.equal(presented.status, 206);
  assert.deepEqual(presented.body, result.body);
});

test('accommodation soldier request DTO preserves date-only strings', () => {
  const { error, value } = soldierAddRequestDto.validate({
    name: 'Soldier One',
    upcomingAccommodation: '2026-04-21',
    upcomingRelease: '2026-04-21',
  });

  assert.equal(error, undefined);
  assert.equal(value.upcomingAccommodation, '2026-04-21');
  assert.equal(value.upcomingRelease, '2026-04-21');
});

test('accommodation soldier request DTO rejects invalid date-only strings', () => {
  const { error } = soldierAddRequestDto.validate({
    name: 'Soldier One',
    upcomingAccommodation: '2026-02-31',
  });

  assert.equal(error?.details?.[0]?.type, 'date.format');
});

test('accommodation additional item DTO accepts positive integer quantities', () => {
  const { error, value } = additionalItemAddRequestDto.validate({
    soldierId: '11111111-1111-4111-8111-111111111111',
    description: 'Towel',
    quantity: '12',
    laundryBagId: '',
  });

  assert.equal(error, undefined);
  assert.equal(value.quantity, '12');
});

test('accommodation additional item DTO rejects zero and non-numeric quantities', () => {
  for (const quantity of ['0', '01', '2 boxes']) {
    const { error } = additionalItemAddRequestDto.validate({
      soldierId: '11111111-1111-4111-8111-111111111111',
      description: 'Towel',
      quantity,
      laundryBagId: '',
    });

    assert.equal(error?.details?.[0]?.path?.[0], 'quantity');
    assert.equal(error?.details?.[0]?.type, 'string.pattern.base');
  }
});
