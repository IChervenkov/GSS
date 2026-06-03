// @ts-nocheck
const { withClient, withTransaction } = require('../../../../../infrastructure/db/transaction');
const { AppError } = require('../../../../../shared/errors/app-error');

function sameId(left, right) {
  return String(left || '') === String(right || '');
}

function isAccommodationBuildingType(value) {
  return String(value || '').trim().toLowerCase() === 'accommodation';
}

function isKeyEligibleForAccommodation(key) {
  return isAccommodationBuildingType(key?.building_type) && Boolean(key?.has_bed_asset);
}

function staleSelectionError(code, message) {
  return new AppError({
    status: 409,
    code,
    message,
  });
}

const KEY_HAS_BED_ASSET_SQL = `EXISTS (
  SELECT 1
    FROM app.assets a
    JOIN app.asset_types at ON at.id = a.type_id
   WHERE a.location_key = k.id
     AND LOWER(at.name) = 'bed'
)`;

function padDatePart(value) {
  return String(value).padStart(2, '0');
}

function mapDateOnly(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return [
      value.getFullYear(),
      padDatePart(value.getMonth() + 1),
      padDatePart(value.getDate()),
    ].join('-');
  }
  return String(value).slice(0, 10);
}

function mapUpcomingActionRowToEntity(row) {
  return {
    id: row.id,
    soldierName: row.name,
    upcomingAccommodation: mapDateOnly(row.upcoming_accommodation),
    upcomingRelease: mapDateOnly(row.upcoming_release),
    dateAccommodation: row.date_accommodation,
    dateFree: row.date_free,
    upcomingAccommodationKey: row.upcoming_accommodation_key || null,
    upcomingAccommodationKeyName: row.upcoming_accommodation_key_name || null,
    keyId: row.key_id || row.used_key || null,
    keyName: row.key_name || null,
  };
}

function mapBuildingRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    type: row.type || null,
    roomCount: Number(row.room_count) || 0,
  };
}

function mapRoomRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    buildingId: row.building_id || null,
    buildingName: row.building_name || null,
    keyCount: Number(row.key_count) || 0,
  };
}

function mapKeyRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    nfcCode: row.nfc_code || null,
    roomId: row.room_id || null,
    roomName: row.room_name || null,
    buildingId: row.building_id || null,
    buildingName: row.building_name || null,
    buildingType: row.building_type || null,
    soldierId: row.soldier_id || null,
    soldierName: row.soldier_name || null,
    hasBedAsset:
      row.has_bed_asset === null || row.has_bed_asset === undefined
        ? null
        : Boolean(row.has_bed_asset),
  };
}

function mapSoldierRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    country: row.country || '',
    mealCard: row.meal_card || '',
    dateAccommodation: row.date_accommodation || null,
    dateFree: row.date_free || null,
    laundryBagId: row.laundry_bag_id || null,
    laundryBagCode: row.laundry_bag_code || null,
    usedKey: row.used_key || null,
    keyId: row.key_id || row.used_key || null,
    keyName: row.key_name || null,
    roomId: row.room_id || null,
    roomName: row.room_name || null,
    buildingId: row.building_id || null,
    buildingName: row.building_name || null,
    upcomingAccommodation: mapDateOnly(row.upcoming_accommodation),
    upcomingRelease: mapDateOnly(row.upcoming_release),
    upcomingAccommodationKey: row.upcoming_accommodation_key || null,
    upcomingAccommodationKeyName: row.upcoming_accommodation_key_name || null,
    activeBikeRentalCount: Number(row.active_bike_rental_count) || 0,
  };
}

function mapLaundryBagRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    rfidCode: row.rfid_code || null,
    type: row.type || '',
    status: row.status || 'pick_up',
    soldierId: row.soldier_id || null,
    soldierName: row.soldier_name || null,
  };
}

function mapAdditionalItemRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    soldierId: row.soldier_id || null,
    soldierName: row.soldier_name || null,
    description: row.description || '',
    quantity: row.quantity || '',
    laundryBagId: row.laundry_bag_id || null,
    laundryBagCode: row.laundry_bag_code || null,
  };
}

async function occupyLaundryBagForSoldier(
  client,
  { campId, soldierId, laundryBagId, currentAdditionalItemId = null },
) {
  if (!laundryBagId) return;

  const params = [soldierId, laundryBagId, campId];
  const additionalItemExclusionSql = currentAdditionalItemId ? 'AND ai.id <> $4' : '';
  if (currentAdditionalItemId) params.push(currentAdditionalItemId);

  const assigned = await client.query(
    `UPDATE app.laundry_bags lb
        SET soldier_id = $1,
            updated_at = NOW()
      WHERE lb.id = $2
        AND lb.camp_id = $3
        AND NOT EXISTS (
          SELECT 1
            FROM app.soldiers s
               WHERE s.laundry_bag_id = lb.id
                 AND s.id <> $1
         )
        AND NOT EXISTS (
          SELECT 1
            FROM app.additional_items ai
           WHERE ai.laundry_bag_id = lb.id
             ${additionalItemExclusionSql}
        )
        AND (
          (
            COALESCE(NULLIF(lb.status, ''), 'pick_up') = 'pick_up'
            AND (lb.soldier_id IS NULL OR lb.soldier_id = $1)
          )
          OR lb.soldier_id = $1
          OR EXISTS (
            SELECT 1
              FROM app.soldiers s
            WHERE s.id = $1
               AND s.laundry_bag_id = lb.id
          )
        )`,
    params,
  );

  if (assigned.rowCount !== 1) {
    throw staleSelectionError(
      'ACCOMMODATION_LAUNDRY_BAG_NOT_AVAILABLE',
      'Only Available laundry bags that are not already linked to another item can be assigned.',
    );
  }
}

async function releaseAdditionalLaundryBagIfUnused(client, { bagId, soldierId }) {
  if (!bagId) return;

  await client.query(
    `UPDATE app.laundry_bags lb
        SET soldier_id = NULL,
            updated_at = NOW()
      WHERE lb.id = $1
        AND lb.soldier_id = $2
        AND NOT EXISTS (
          SELECT 1
            FROM app.soldiers s
           WHERE s.laundry_bag_id = lb.id
        )
        AND NOT EXISTS (
          SELECT 1
            FROM app.additional_items ai
           WHERE ai.laundry_bag_id = lb.id
        )`,
    [bagId, soldierId],
  );
}

function mapAccommodationMovementReportRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    eventType: row.event_type || 'move',
    happenedAt: row.happened_at || null,
    soldierId: row.soldier_id || null,
    soldierName: row.soldier_name || '',
    soldierMealCard: row.soldier_meal_card || '',
    laundryBagCode: row.laundry_bag_code || '',
    previousKeyId: row.previous_key_id || null,
    previousKeyName: row.previous_key_name || null,
    newKeyId: row.new_key_id || null,
    newKeyName: row.new_key_name || null,
  };
}

function mapAdditionalItemReportRow(row) {
  const item = mapAdditionalItemRow(row);
  if (!item) return null;
  return {
    ...item,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

async function listUserPermissions({ userId }) {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT p.name AS name
         FROM app.user_permissions up
         JOIN app.permissions p ON p.id = up.permission_id
        WHERE up.user_id = $1
        ORDER BY p.name ASC`,
      [userId],
    );

    return result.rows;
  });
}

async function userHasPermission(userId, permissionName) {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT 1
         FROM app.user_permissions up
         JOIN app.permissions p ON p.id = up.permission_id
        WHERE up.user_id = $1
          AND p.name = $2
        LIMIT 1`,
      [userId, permissionName],
    );

    return result.rowCount > 0;
  });
}

async function findBuildingById({ buildingId, campId }) {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT b.id,
              b.name,
              b.type,
              COUNT(br.room_id)::int AS room_count
         FROM app.buildings b
         LEFT JOIN app.building_rooms br ON br.build_id = b.id
        WHERE b.id = $1
          AND b.camp_id = $2
        GROUP BY b.id, b.name, b.type
        LIMIT 1`,
      [buildingId, campId],
    );

    return mapBuildingRow(result.rows[0]);
  });
}

async function findBuildingByName({ name, campId }) {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT id, name, type
         FROM app.buildings
        WHERE LOWER(name) = LOWER($1)
          AND camp_id = $2
        LIMIT 1`,
      [name, campId],
    );

    return mapBuildingRow(result.rows[0]);
  });
}

async function findRoomById({ roomId, campId }) {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT r.id,
              r.name,
              b.id AS building_id,
              b.name AS building_name,
              COUNT(rk.key_id)::int AS key_count
         FROM app.rooms r
         LEFT JOIN app.building_rooms br ON br.room_id = r.id
         LEFT JOIN app.buildings b ON b.id = br.build_id
         LEFT JOIN app.room_keys rk ON rk.room_id = r.id
        WHERE r.id = $1
          AND r.camp_id = $2
        GROUP BY r.id, r.name, b.id, b.name
        LIMIT 1`,
      [roomId, campId],
    );

    return mapRoomRow(result.rows[0]);
  });
}

async function findRoomByName({ name, campId }) {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT id, name
         FROM app.rooms
        WHERE LOWER(name) = LOWER($1)
          AND camp_id = $2
        LIMIT 1`,
      [name, campId],
    );

    return mapRoomRow(result.rows[0]);
  });
}

async function findKeyById({ keyId, campId }) {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT k.id,
              k.name,
              k.nfc_code,
              rk.room_id,
              r.name AS room_name,
              b.id AS building_id,
              b.name AS building_name,
              b.type AS building_type,
              k.soldier_id,
              s.name AS soldier_name,
              ${KEY_HAS_BED_ASSET_SQL} AS has_bed_asset
         FROM app.keys k
         LEFT JOIN app.room_keys rk ON rk.key_id = k.id
         LEFT JOIN app.rooms r ON r.id = rk.room_id
         LEFT JOIN app.building_rooms br ON br.room_id = r.id
         LEFT JOIN app.buildings b ON b.id = br.build_id
         LEFT JOIN app.soldiers s ON s.id = k.soldier_id
        WHERE k.id = $1
          AND k.camp_id = $2
        LIMIT 1`,
      [keyId, campId],
    );

    return mapKeyRow(result.rows[0]);
  });
}

async function findKeyByName({ name, campId }) {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT k.id,
              k.name,
              k.nfc_code,
              rk.room_id,
              r.name AS room_name,
              b.id AS building_id,
              b.name AS building_name,
              b.type AS building_type,
              k.soldier_id,
              s.name AS soldier_name,
              ${KEY_HAS_BED_ASSET_SQL} AS has_bed_asset
         FROM app.keys k
         LEFT JOIN app.room_keys rk ON rk.key_id = k.id
         LEFT JOIN app.rooms r ON r.id = rk.room_id
         LEFT JOIN app.building_rooms br ON br.room_id = r.id
         LEFT JOIN app.buildings b ON b.id = br.build_id
         LEFT JOIN app.soldiers s ON s.id = k.soldier_id
        WHERE LOWER(k.name) = LOWER($1)
          AND k.camp_id = $2
        LIMIT 1`,
      [name, campId],
    );

    return mapKeyRow(result.rows[0]);
  });
}

async function findKeyByNfcCode({ nfcCode }) {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT id, name, nfc_code, soldier_id
         FROM app.keys
        WHERE LOWER(nfc_code) = LOWER($1)
        LIMIT 1`,
      [nfcCode],
    );

    return mapKeyRow(result.rows[0]);
  });
}

async function findSoldierById({ soldierId, campId }) {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT s.id,
              s.name,
              s.country,
              s.meal_card,
              s.date_accommodation,
              s.date_free,
              s.laundry_bag_id,
              lb.code AS laundry_bag_code,
              s.used_key,
              k.id AS key_id,
              k.name AS key_name,
              r.id AS room_id,
              r.name AS room_name,
              b.id AS building_id,
              b.name AS building_name,
              s.upcoming_accommodation,
              s.upcoming_release,
              s.upcoming_accommodation_key,
              uk.name AS upcoming_accommodation_key_name
         FROM app.soldiers s
         LEFT JOIN app.laundry_bags lb ON lb.id = s.laundry_bag_id
         LEFT JOIN app.keys k ON k.id = s.used_key
         LEFT JOIN app.room_keys rk ON rk.key_id = k.id
         LEFT JOIN app.rooms r ON r.id = rk.room_id
         LEFT JOIN app.building_rooms br ON br.room_id = r.id
         LEFT JOIN app.buildings b ON b.id = br.build_id
         LEFT JOIN app.keys uk ON uk.id = s.upcoming_accommodation_key
        WHERE s.id = $1
          AND s.camp_id = $2
        LIMIT 1`,
      [soldierId, campId],
    );

    return mapSoldierRow(result.rows[0]);
  });
}

async function findSoldierDeletionBlockers({ soldierId, campId }) {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT
          (
            SELECT COUNT(*)::int
              FROM app.keys k
             WHERE k.soldier_id = $1
               AND k.camp_id = $2
          ) AS key_assignment_count,
          (
            SELECT COUNT(*)::int
              FROM app.additional_items ai
             WHERE ai.soldier_id = $1
          ) AS additional_item_count,
          (
            SELECT COUNT(*)::int
              FROM app.bicycle_assignments ba
              JOIN app.bicycles b ON b.id = ba.bike_id
             WHERE ba.soldier_id = $1
               AND b.camp_id = $2
               AND ba.date_to IS NULL
          ) AS active_bicycle_assignment_count`,
      [soldierId, campId],
    );
    const row = result.rows[0] || {};
    return {
      keyAssignmentCount: Number(row.key_assignment_count) || 0,
      additionalItemCount: Number(row.additional_item_count) || 0,
      activeBicycleAssignmentCount: Number(row.active_bicycle_assignment_count) || 0,
    };
  });
}

async function findSoldierByName({ name, campId }) {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT id, name, country, meal_card, date_accommodation, date_free, used_key
         FROM app.soldiers
        WHERE LOWER(name) = LOWER($1)
          AND camp_id = $2
        LIMIT 1`,
      [name, campId],
    );

    return mapSoldierRow(result.rows[0]);
  });
}

async function findLaundryBagById({ laundryBagId, campId }) {
  if (!laundryBagId) return null;
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT lb.id,
              lb.code,
              lb.rfid_code,
              lb.type,
              COALESCE(NULLIF(lb.status, ''), 'pick_up') AS status,
              COALESCE(lb.soldier_id, s_by_bag.id) AS soldier_id,
              COALESCE(s_direct.name, s_by_bag.name) AS soldier_name
         FROM app.laundry_bags lb
         LEFT JOIN app.soldiers s_direct ON s_direct.id = lb.soldier_id
         LEFT JOIN app.soldiers s_by_bag ON s_by_bag.laundry_bag_id = lb.id
        WHERE lb.id = $1
          AND lb.camp_id = $2
        LIMIT 1`,
      [laundryBagId, campId],
    );

    return mapLaundryBagRow(result.rows[0]);
  });
}

async function findLaundryBagByCode({ code, campId }) {
  const normalizedCode = String(code || '').trim();
  if (!normalizedCode) return null;
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT lb.id,
              lb.code,
              lb.rfid_code,
              lb.type,
              COALESCE(NULLIF(lb.status, ''), 'pick_up') AS status,
              COALESCE(lb.soldier_id, s_by_bag.id) AS soldier_id,
              COALESCE(s_direct.name, s_by_bag.name) AS soldier_name
         FROM app.laundry_bags lb
         LEFT JOIN app.soldiers s_direct ON s_direct.id = lb.soldier_id
         LEFT JOIN app.soldiers s_by_bag ON s_by_bag.laundry_bag_id = lb.id
        WHERE LOWER(lb.code) = LOWER($1)
          AND lb.camp_id = $2
        LIMIT 1`,
      [normalizedCode, campId],
    );

    return mapLaundryBagRow(result.rows[0]);
  });
}

async function findLaundryBagByRfid({ rfidCode }) {
  const normalizedRfidCode = String(rfidCode || '').trim();
  if (!normalizedRfidCode) return null;
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT lb.id,
              lb.code,
              lb.rfid_code,
              lb.type,
              COALESCE(NULLIF(lb.status, ''), 'pick_up') AS status,
              COALESCE(lb.soldier_id, s_by_bag.id) AS soldier_id,
              COALESCE(s_direct.name, s_by_bag.name) AS soldier_name
         FROM app.laundry_bags lb
         LEFT JOIN app.soldiers s_direct ON s_direct.id = lb.soldier_id
         LEFT JOIN app.soldiers s_by_bag ON s_by_bag.laundry_bag_id = lb.id
        WHERE LOWER(lb.rfid_code) = LOWER($1)
        LIMIT 1`,
      [normalizedRfidCode],
    );

    return mapLaundryBagRow(result.rows[0]);
  });
}

async function findAdditionalItemById({ itemId, campId }) {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT ai.id,
              ai.soldier_id,
              s.name AS soldier_name,
              ai.description,
              ai.quantity,
              ai.laundry_bag_id,
              lb.code AS laundry_bag_code
         FROM app.additional_items ai
         JOIN app.soldiers s ON s.id = ai.soldier_id
         LEFT JOIN app.laundry_bags lb ON lb.id = ai.laundry_bag_id
        WHERE ai.id = $1
          AND s.camp_id = $2
        LIMIT 1`,
      [itemId, campId],
    );

    return mapAdditionalItemRow(result.rows[0]);
  });
}

async function addBuilding({ actorUserId, campId, name, type = null }) {
  return withTransaction(async (client) => {
    const result = await client.query(
      `INSERT INTO app.buildings (name, type, camp_id)
        VALUES ($1, NULLIF($2, ''), $3)
        RETURNING id, name, type`,
      [name, type || '', campId],
    );

    await client.query(
      `INSERT INTO app.user_monitoring_events (username, location)
        VALUES ((SELECT username FROM app.users WHERE id = $1), $2)`,
      [actorUserId, `Building ${name} added`],
    );

    return mapBuildingRow(result.rows[0]);
  });
}

async function editBuilding({ actorUserId, buildingId, campId, name, type = null }) {
  return withTransaction(async (client) => {
    const result = await client.query(
      `UPDATE app.buildings
          SET name = $3,
              type = NULLIF($4, ''),
              updated_at = NOW()
        WHERE id = $1
          AND camp_id = $2
        RETURNING id, name, type`,
      [buildingId, campId, name, type || ''],
    );

    if (result.rows[0]) {
      await client.query(
        `INSERT INTO app.user_monitoring_events (username, location)
          VALUES ((SELECT username FROM app.users WHERE id = $1), $2)`,
        [actorUserId, `Building ${buildingId} updated`],
      );
    }

    return mapBuildingRow(result.rows[0]);
  });
}

async function deleteBuilding({ actorUserId, buildingId, campId }) {
  return withTransaction(async (client) => {
    const building = await client.query(
      `SELECT id, name
         FROM app.buildings
        WHERE id = $1
          AND camp_id = $2
        LIMIT 1`,
      [buildingId, campId],
    );
    if (!building.rows[0]) return null;

    const deleted = await client.query(
      `DELETE FROM app.buildings b
        WHERE b.id = $1
          AND b.camp_id = $2
          AND NOT EXISTS (
            SELECT 1
              FROM app.building_rooms br
             WHERE br.build_id = b.id
          )
        RETURNING b.id`,
      [buildingId, campId],
    );

    if (deleted.rows[0]) {
      await client.query(
        `INSERT INTO app.user_monitoring_events (username, location)
          VALUES ((SELECT username FROM app.users WHERE id = $1), $2)`,
        [actorUserId, `Building ${building.rows[0].name} deleted`],
      );
    }

    return deleted.rows[0] ? { id: deleted.rows[0].id, name: building.rows[0].name } : null;
  });
}

async function addRoom({ actorUserId, campId, name, buildingId }) {
  return withTransaction(async (client) => {
    const result = await client.query(
      `INSERT INTO app.rooms (name, camp_id)
        VALUES ($1, $2)
        RETURNING id, name`,
      [name, campId],
    );

    await client.query(
      `INSERT INTO app.building_rooms (build_id, room_id)
        VALUES ($1, $2)`,
      [buildingId, result.rows[0].id],
    );

    await client.query(
      `INSERT INTO app.user_monitoring_events (username, location)
        VALUES ((SELECT username FROM app.users WHERE id = $1), $2)`,
      [actorUserId, `Room ${name} added`],
    );

    return result.rows[0] ? mapRoomRow({ ...result.rows[0], building_id: buildingId }) : null;
  });
}

async function editRoom({ actorUserId, roomId, campId, name, buildingId }) {
  return withTransaction(async (client) => {
    const result = await client.query(
      `UPDATE app.rooms
          SET name = $3,
              updated_at = NOW()
        WHERE id = $1
          AND camp_id = $2
        RETURNING id, name`,
      [roomId, campId, name],
    );

    if (result.rows[0]) {
      await client.query('DELETE FROM app.building_rooms WHERE room_id = $1', [roomId]);
      await client.query(
        `INSERT INTO app.building_rooms (build_id, room_id)
          VALUES ($1, $2)`,
        [buildingId, roomId],
      );
      await client.query(
        `INSERT INTO app.user_monitoring_events (username, location)
          VALUES ((SELECT username FROM app.users WHERE id = $1), $2)`,
        [actorUserId, `Room ${roomId} updated`],
      );
    }

    return result.rows[0] ? mapRoomRow({ ...result.rows[0], building_id: buildingId }) : null;
  });
}

async function deleteRoom({ actorUserId, roomId, campId }) {
  return withTransaction(async (client) => {
    const room = await client.query(
      `SELECT id, name
         FROM app.rooms
        WHERE id = $1
          AND camp_id = $2
        LIMIT 1`,
      [roomId, campId],
    );
    if (!room.rows[0]) return null;

    const deleted = await client.query(
      `DELETE FROM app.rooms r
        WHERE r.id = $1
          AND r.camp_id = $2
          AND NOT EXISTS (
            SELECT 1
              FROM app.room_keys rk
             WHERE rk.room_id = r.id
          )
        RETURNING r.id`,
      [roomId, campId],
    );

    if (deleted.rows[0]) {
      await client.query(
        `INSERT INTO app.user_monitoring_events (username, location)
          VALUES ((SELECT username FROM app.users WHERE id = $1), $2)`,
        [actorUserId, `Room ${room.rows[0].name} deleted`],
      );
    }

    return deleted.rows[0] ? { id: deleted.rows[0].id, name: room.rows[0].name } : null;
  });
}

async function addKey({ actorUserId, campId, name, nfcCode, roomId }) {
  return withTransaction(async (client) => {
    const result = await client.query(
      `INSERT INTO app.keys (name, nfc_code, camp_id)
        VALUES ($1, $2, $3)
        RETURNING id, name, nfc_code, soldier_id`,
      [name, nfcCode, campId],
    );

    await client.query(
      `INSERT INTO app.room_keys (room_id, key_id)
        VALUES ($1, $2)`,
      [roomId, result.rows[0].id],
    );

    await client.query(
      `INSERT INTO app.user_monitoring_events (username, location)
        VALUES ((SELECT username FROM app.users WHERE id = $1), $2)`,
      [actorUserId, `Key ${name} added`],
    );

    return result.rows[0] ? mapKeyRow({ ...result.rows[0], room_id: roomId }) : null;
  });
}

async function editKey({ actorUserId, keyId, campId, name, nfcCode, roomId }) {
  return withTransaction(async (client) => {
    const result = await client.query(
      `UPDATE app.keys
          SET name = $3,
              nfc_code = $4,
              updated_at = NOW()
        WHERE id = $1
          AND camp_id = $2
        RETURNING id, name, nfc_code, soldier_id`,
      [keyId, campId, name, nfcCode],
    );

    if (result.rows[0]) {
      await client.query('DELETE FROM app.room_keys WHERE key_id = $1', [keyId]);
      await client.query(
        `INSERT INTO app.room_keys (room_id, key_id)
          VALUES ($1, $2)`,
        [roomId, keyId],
      );
      await client.query(
        `INSERT INTO app.user_monitoring_events (username, location)
          VALUES ((SELECT username FROM app.users WHERE id = $1), $2)`,
        [actorUserId, `Key ${keyId} updated`],
      );
    }

    return result.rows[0] ? mapKeyRow({ ...result.rows[0], room_id: roomId }) : null;
  });
}

async function deleteKey({ actorUserId, keyId, campId }) {
  return withTransaction(async (client) => {
    const key = await client.query(
      `SELECT id, name, soldier_id
         FROM app.keys
        WHERE id = $1
          AND camp_id = $2
        LIMIT 1`,
      [keyId, campId],
    );
    if (!key.rows[0]) return null;

    const deleted = await client.query(
      `DELETE FROM app.keys k
        WHERE k.id = $1
          AND k.camp_id = $2
          AND k.soldier_id IS NULL
        RETURNING k.id`,
      [keyId, campId],
    );

    if (deleted.rows[0]) {
      await client.query(
        `INSERT INTO app.user_monitoring_events (username, location)
          VALUES ((SELECT username FROM app.users WHERE id = $1), $2)`,
        [actorUserId, `Key ${key.rows[0].name} deleted`],
      );
    }

    return deleted.rows[0] ? { id: deleted.rows[0].id, name: key.rows[0].name } : null;
  });
}

async function issueKeyToSoldier({ actorUserId, campId, keyId, soldierId }) {
  return withTransaction(async (client) => {
    const [keyResult, soldierResult] = await Promise.all([
      client.query(
        `SELECT id, name, soldier_id
           FROM app.keys
          WHERE id = $1
            AND camp_id = $2
          LIMIT 1
          FOR UPDATE`,
        [keyId, campId],
      ),
      client.query(
        `SELECT id, name
           FROM app.soldiers
          WHERE id = $1
            AND camp_id = $2
          LIMIT 1`,
        [soldierId, campId],
      ),
    ]);
    const key = keyResult.rows[0];
    const soldier = soldierResult.rows[0];
    if (!key || !soldier || key.soldier_id) return null;

    const assigned = await client.query(
      `UPDATE app.keys
          SET soldier_id = $3,
              updated_at = NOW()
        WHERE id = $1
          AND camp_id = $2
          AND soldier_id IS NULL
        RETURNING id`,
      [keyId, campId, soldierId],
    );
    if (assigned.rowCount !== 1) return null;

    await client.query(
      `INSERT INTO app.user_monitoring_events (username, location)
        VALUES ((SELECT username FROM app.users WHERE id = $1), $2)`,
      [actorUserId, `Key ${key.name} issued to ${soldier.name}`],
    );

    return { keyId, soldierId };
  });
}

async function releaseKeyFromSoldier({ actorUserId, campId, keyId }) {
  return withTransaction(async (client) => {
    const keyResult = await client.query(
      `SELECT k.id, k.name, k.soldier_id, s.name AS soldier_name, s.used_key
         FROM app.keys k
         LEFT JOIN app.soldiers s
           ON s.id = k.soldier_id
          AND s.camp_id = k.camp_id
        WHERE k.id = $1
          AND k.camp_id = $2
        LIMIT 1
        FOR UPDATE OF k`,
      [keyId, campId],
    );
    const key = keyResult.rows[0];
    if (!key || !key.soldier_id || sameId(key.used_key, key.id)) return null;

    const released = await client.query(
      `UPDATE app.keys
          SET soldier_id = NULL,
              updated_at = NOW()
        WHERE id = $1
          AND camp_id = $2
          AND soldier_id = $3
        RETURNING id`,
      [keyId, campId, key.soldier_id],
    );
    if (released.rowCount !== 1) return null;

    await client.query(
      `INSERT INTO app.user_monitoring_events (username, location)
        VALUES ((SELECT username FROM app.users WHERE id = $1), $2)`,
      [actorUserId, `Key ${key.name} released from ${key.soldier_name || key.soldier_id}`],
    );

    return { keyId, soldierId: key.soldier_id };
  });
}

async function addSoldier({
  actorUserId,
  campId,
  name,
  country = null,
  mealCard = null,
  laundryBagId = null,
  upcomingAccommodation = null,
  upcomingRelease = null,
  upcomingAccommodationKey = null,
}) {
  return withTransaction(async (client) => {
    const result = await client.query(
      `INSERT INTO app.soldiers (
          name,
          country,
          meal_card,
          laundry_bag_id,
          upcoming_accommodation,
          upcoming_release,
          upcoming_accommodation_key,
          camp_id
        )
        VALUES ($1, NULLIF($2, ''), NULLIF($3, ''), $4, $5, $6, $7, $8)
        RETURNING id, name, country, meal_card, laundry_bag_id, upcoming_accommodation,
                  upcoming_release, upcoming_accommodation_key, date_accommodation, date_free, used_key`,
      [
        name,
        country || '',
        mealCard || '',
        laundryBagId || null,
        upcomingAccommodation || null,
        upcomingRelease || null,
        upcomingAccommodationKey || null,
        campId,
      ],
    );

    if (laundryBagId) {
      const bagAssignment = await client.query(
        `UPDATE app.laundry_bags lb
            SET soldier_id = $1,
                updated_at = NOW()
          WHERE lb.id = $2
            AND lb.camp_id = $3
            AND COALESCE(NULLIF(lb.status, ''), 'pick_up') = 'pick_up'
            AND lb.soldier_id IS NULL
            AND NOT EXISTS (
              SELECT 1
                FROM app.soldiers s
               WHERE s.laundry_bag_id = lb.id
                 AND s.id <> $1
            )`,
        [result.rows[0].id, laundryBagId, campId],
      );
      if (bagAssignment.rowCount !== 1) {
        throw staleSelectionError(
          'ACCOMMODATION_LAUNDRY_BAG_NOT_AVAILABLE',
          'Only Available laundry bags can be assigned.',
        );
      }
    }

    await client.query(
      `INSERT INTO app.user_monitoring_events (username, location)
        VALUES ((SELECT username FROM app.users WHERE id = $1), $2)`,
      [actorUserId, `Soldier ${name} added`],
    );

    return mapSoldierRow(result.rows[0]);
  });
}

async function editSoldier({
  actorUserId,
  soldierId,
  campId,
  name,
  country = null,
  mealCard = null,
  laundryBagId = null,
  upcomingAccommodation = null,
  upcomingRelease = null,
  upcomingAccommodationKey = null,
}) {
  return withTransaction(async (client) => {
    const existing = await client.query(
      `SELECT id, laundry_bag_id
         FROM app.soldiers
        WHERE id = $1
          AND camp_id = $2
        LIMIT 1`,
      [soldierId, campId],
    );
    if (!existing.rows[0]) return null;

    const result = await client.query(
      `UPDATE app.soldiers
          SET name = $3,
              country = NULLIF($4, ''),
              meal_card = NULLIF($5, ''),
              laundry_bag_id = $6,
              upcoming_accommodation = $7,
              upcoming_release = $8,
              upcoming_accommodation_key = $9,
              updated_at = NOW()
        WHERE id = $1
          AND camp_id = $2
        RETURNING id, name, country, meal_card, laundry_bag_id, upcoming_accommodation,
                  upcoming_release, upcoming_accommodation_key, date_accommodation, date_free, used_key`,
      [
        soldierId,
        campId,
        name,
        country || '',
        mealCard || '',
        laundryBagId || null,
        upcomingAccommodation || null,
        upcomingRelease || null,
        upcomingAccommodationKey || null,
      ],
    );

    const previousBagId = existing.rows[0].laundry_bag_id;
    if (previousBagId && String(previousBagId) !== String(laundryBagId || '')) {
      await client.query(
        `UPDATE app.laundry_bags
            SET soldier_id = NULL,
                updated_at = NOW()
          WHERE id = $1
            AND soldier_id = $2`,
        [previousBagId, soldierId],
      );
    }
    if (laundryBagId) {
      const reassigningBag = String(previousBagId || '') !== String(laundryBagId);
      const bagAssignment = await client.query(
        `UPDATE app.laundry_bags lb
            SET soldier_id = $1,
                updated_at = NOW()
          WHERE lb.id = $2
            AND lb.camp_id = $3
            AND (lb.soldier_id IS NULL OR lb.soldier_id = $1)
            ${
              reassigningBag
                ? `AND COALESCE(NULLIF(lb.status, ''), 'pick_up') = 'pick_up'
            AND NOT EXISTS (
              SELECT 1
                FROM app.soldiers s
               WHERE s.laundry_bag_id = lb.id
                 AND s.id <> $1
            )`
                : ''
            }`,
        [soldierId, laundryBagId, campId],
      );
      if (bagAssignment.rowCount !== 1) {
        throw staleSelectionError(
          'ACCOMMODATION_LAUNDRY_BAG_NOT_AVAILABLE',
          'Only Available laundry bags can be assigned.',
        );
      }
    }

    await client.query(
      `INSERT INTO app.user_monitoring_events (username, location)
        VALUES ((SELECT username FROM app.users WHERE id = $1), $2)`,
      [actorUserId, `Soldier ${soldierId} updated`],
    );

    return mapSoldierRow(result.rows[0]);
  });
}

async function deleteSoldier({ actorUserId, soldierId, campId }) {
  return withTransaction(async (client) => {
    const soldier = await client.query(
      `SELECT id, name, used_key, laundry_bag_id
         FROM app.soldiers
        WHERE id = $1
          AND camp_id = $2
        LIMIT 1`,
      [soldierId, campId],
    );
    if (!soldier.rows[0]) return null;

    const deleted = await client.query(
      `DELETE FROM app.soldiers s
        WHERE s.id = $1
          AND s.camp_id = $2
          AND s.used_key IS NULL
          AND NOT EXISTS (
            SELECT 1
              FROM app.keys k
             WHERE k.soldier_id = s.id
               AND k.camp_id = s.camp_id
          )
          AND NOT EXISTS (
            SELECT 1
              FROM app.additional_items ai
             WHERE ai.soldier_id = s.id
          )
          AND NOT EXISTS (
            SELECT 1
              FROM app.bicycle_assignments ba
              JOIN app.bicycles b ON b.id = ba.bike_id
             WHERE ba.soldier_id = s.id
               AND b.camp_id = s.camp_id
               AND ba.date_to IS NULL
          )
        RETURNING s.id`,
      [soldierId, campId],
    );

    if (deleted.rows[0]) {
      if (soldier.rows[0].laundry_bag_id) {
        await client.query(
          `UPDATE app.laundry_bags
              SET soldier_id = NULL,
                  updated_at = NOW()
            WHERE id = $1
              AND soldier_id = $2`,
          [soldier.rows[0].laundry_bag_id, soldierId],
        );
      }
      await client.query(
        `INSERT INTO app.user_monitoring_events (username, location)
          VALUES ((SELECT username FROM app.users WHERE id = $1), $2)`,
        [actorUserId, `Soldier ${soldier.rows[0].name} deleted`],
      );
    }

    return deleted.rows[0] ? { id: deleted.rows[0].id, name: soldier.rows[0].name } : null;
  });
}

async function accommodateSoldier({ actorUserId, campId, soldierId, keyId }) {
  return withTransaction(async (client) => {
    const [soldierResult, keyResult] = await Promise.all([
      client.query(
        `SELECT id, name, used_key
           FROM app.soldiers
          WHERE id = $1
            AND camp_id = $2
          LIMIT 1
          FOR UPDATE`,
        [soldierId, campId],
      ),
      client.query(
        `SELECT k.id,
                k.name,
                k.soldier_id,
                b.type AS building_type,
                ${KEY_HAS_BED_ASSET_SQL} AS has_bed_asset
           FROM app.keys k
           LEFT JOIN app.room_keys rk ON rk.key_id = k.id
           LEFT JOIN app.rooms r ON r.id = rk.room_id
           LEFT JOIN app.building_rooms br ON br.room_id = r.id
           LEFT JOIN app.buildings b ON b.id = br.build_id
          WHERE k.id = $1
            AND k.camp_id = $2
          LIMIT 1
          FOR UPDATE OF k`,
        [keyId, campId],
      ),
    ]);
    const soldier = soldierResult.rows[0];
    const key = keyResult.rows[0];
    if (!soldier || !key || soldier.used_key || key.soldier_id) return null;
    if (!isKeyEligibleForAccommodation(key)) return null;

    const soldierUpdate = await client.query(
      `UPDATE app.soldiers
          SET used_key = $3,
              date_accommodation = COALESCE(date_accommodation, NOW()),
              date_free = NULL,
              updated_at = NOW()
        WHERE id = $1
          AND camp_id = $2
          AND used_key IS NULL
        RETURNING id`,
      [soldierId, campId, keyId],
    );
    if (soldierUpdate.rowCount !== 1) return null;

    const keyUpdate = await client.query(
      `UPDATE app.keys
          SET soldier_id = $3,
              updated_at = NOW()
        WHERE id = $1
          AND camp_id = $2
          AND soldier_id IS NULL
        RETURNING id`,
      [keyId, campId, soldierId],
    );
    if (keyUpdate.rowCount !== 1) {
      throw staleSelectionError(
        'ACCOMMODATION_ACCOMMODATION_CONFLICT',
        'The selected key is no longer free. Refresh and try again.',
      );
    }
    await client.query(
      `INSERT INTO app.soldier_moves (id_new_key, id_prev_key, id_soldier, moved_at)
        VALUES ($1, NULL, $2, NOW())`,
      [keyId, soldierId],
    );
    await client.query(
      `INSERT INTO app.user_monitoring_events (username, location)
        VALUES ((SELECT username FROM app.users WHERE id = $1), $2)`,
      [actorUserId, `Soldier ${soldier.name} accommodated to ${key.name}`],
    );

    return { soldierId, keyId };
  });
}

async function dischargeSoldier({ actorUserId, campId, soldierId }) {
  return withTransaction(async (client) => {
    const soldierResult = await client.query(
      `SELECT id, name, used_key
         FROM app.soldiers
        WHERE id = $1
          AND camp_id = $2
        LIMIT 1
        FOR UPDATE`,
      [soldierId, campId],
    );
    const soldier = soldierResult.rows[0];
    if (!soldier || !soldier.used_key) return null;

    const keyUpdate = await client.query(
      `UPDATE app.keys
          SET soldier_id = NULL,
              updated_at = NOW()
        WHERE id = $1
          AND camp_id = $2
          AND soldier_id = $3
        RETURNING id`,
      [soldier.used_key, campId, soldierId],
    );
    if (keyUpdate.rowCount !== 1) return null;

    const soldierUpdate = await client.query(
      `UPDATE app.soldiers
          SET used_key = NULL,
              date_free = NOW(),
              updated_at = NOW()
        WHERE id = $1
          AND camp_id = $2
          AND used_key = $3
        RETURNING id`,
      [soldierId, campId, soldier.used_key],
    );
    if (soldierUpdate.rowCount !== 1) {
      throw staleSelectionError(
        'ACCOMMODATION_DISCHARGE_CONFLICT',
        'The soldier accommodation changed before it could be discharged.',
      );
    }
    await client.query(
      `INSERT INTO app.soldier_moves (id_new_key, id_prev_key, id_soldier, moved_at)
        VALUES (NULL, $1, $2, NOW())`,
      [soldier.used_key, soldierId],
    );
    await client.query(
      `INSERT INTO app.user_monitoring_events (username, location)
        VALUES ((SELECT username FROM app.users WHERE id = $1), $2)`,
      [actorUserId, `Soldier ${soldier.name} discharged`],
    );

    return { soldierId, previousKeyId: soldier.used_key };
  });
}

async function moveSoldier({ actorUserId, campId, soldierId, keyId, assignments = [] }) {
  if (Array.isArray(assignments) && assignments.length) {
    return withTransaction(async (client) => {
      const previousKeyIds = assignments.map((assignment) => assignment.previousKeyId);
      const destinationKeyIds = assignments.map((assignment) => assignment.keyId);
      const soldierIds = assignments.map((assignment) => assignment.soldierId);
      const keyIds = [...new Set([...previousKeyIds, ...destinationKeyIds].map(String))];

      const [lockedSoldiersResult, lockedKeysResult] = await Promise.all([
        client.query(
          `SELECT id, used_key
             FROM app.soldiers
            WHERE id = ANY($1::uuid[])
              AND camp_id = $2
            FOR UPDATE`,
          [soldierIds, campId],
        ),
        client.query(
          `SELECT k.id,
                  k.soldier_id,
                  b.type AS building_type,
                  ${KEY_HAS_BED_ASSET_SQL} AS has_bed_asset
             FROM app.keys k
             LEFT JOIN app.room_keys rk ON rk.key_id = k.id
             LEFT JOIN app.rooms r ON r.id = rk.room_id
             LEFT JOIN app.building_rooms br ON br.room_id = r.id
             LEFT JOIN app.buildings b ON b.id = br.build_id
            WHERE k.id = ANY($1::uuid[])
              AND k.camp_id = $2
            FOR UPDATE OF k`,
          [keyIds, campId],
        ),
      ]);
      const lockedSoldiers = new Map(
        lockedSoldiersResult.rows.map((row) => [String(row.id), row]),
      );
      const lockedKeys = new Map(lockedKeysResult.rows.map((row) => [String(row.id), row]));
      const previousKeyOwners = new Map(
        assignments.map((assignment) => [String(assignment.previousKeyId), assignment.soldierId]),
      );

      for (const assignment of assignments) {
        const lockedSoldier = lockedSoldiers.get(String(assignment.soldierId));
        const previousKey = lockedKeys.get(String(assignment.previousKeyId));
        const destinationKey = lockedKeys.get(String(assignment.keyId));

        if (
          !lockedSoldier ||
          !previousKey ||
          !destinationKey ||
          !sameId(lockedSoldier.used_key, assignment.previousKeyId) ||
          !sameId(previousKey.soldier_id, assignment.soldierId) ||
          !isKeyEligibleForAccommodation(destinationKey)
        ) {
          return null;
        }

        const expectedDestinationOwner = previousKeyOwners.get(String(assignment.keyId));
        if (expectedDestinationOwner) {
          if (!sameId(destinationKey.soldier_id, expectedDestinationOwner)) return null;
        } else if (destinationKey.soldier_id) {
          return null;
        }
      }

      await client.query(
        `UPDATE app.keys
            SET soldier_id = NULL,
                updated_at = NOW()
          WHERE id = ANY($1::uuid[])
            AND camp_id = $2`,
        [previousKeyIds, campId],
      );

      const moves = [];
      for (const assignment of assignments) {
        const keyUpdate = await client.query(
          `UPDATE app.keys
              SET soldier_id = $3,
                  updated_at = NOW()
            WHERE id = $1
              AND camp_id = $2
            RETURNING id`,
          [assignment.keyId, campId, assignment.soldierId],
        );
        if (keyUpdate.rowCount !== 1) {
          throw staleSelectionError(
            'ACCOMMODATION_MOVE_CONFLICT',
            'The destination key changed before the move could be completed.',
          );
        }

        const soldierUpdate = await client.query(
          `UPDATE app.soldiers
              SET used_key = $3,
                  updated_at = NOW()
            WHERE id = $1
              AND camp_id = $2
            RETURNING id`,
          [assignment.soldierId, campId, assignment.keyId],
        );
        if (soldierUpdate.rowCount !== 1) {
          throw staleSelectionError(
            'ACCOMMODATION_MOVE_CONFLICT',
            'The soldier changed before the move could be completed.',
          );
        }
        await client.query(
          `INSERT INTO app.soldier_moves (id_new_key, id_prev_key, id_soldier, moved_at)
            VALUES ($1, $2, $3, NOW())`,
          [assignment.keyId, assignment.previousKeyId, assignment.soldierId],
        );
        moves.push({
          soldierId: assignment.soldierId,
          previousKeyId: assignment.previousKeyId,
          keyId: assignment.keyId,
        });
      }

      const firstMove = assignments[0];
      await client.query(
        `INSERT INTO app.user_monitoring_events (username, location)
          VALUES ((SELECT username FROM app.users WHERE id = $1), $2)`,
        [
          actorUserId,
          assignments.length > 1
            ? `${assignments.length} soldiers moved through accommodation keys`
            : `Soldier ${firstMove.soldierName || firstMove.soldierId} moved to ${
                firstMove.keyName || firstMove.keyId
              }`,
        ],
      );

      return { soldierId, moves };
    });
  }

  return withTransaction(async (client) => {
    const [soldierResult, keyResult] = await Promise.all([
      client.query(
        `SELECT id, name, used_key
           FROM app.soldiers
          WHERE id = $1
            AND camp_id = $2
          LIMIT 1
          FOR UPDATE`,
        [soldierId, campId],
      ),
      client.query(
        `SELECT k.id,
                k.name,
                k.soldier_id,
                b.type AS building_type,
                ${KEY_HAS_BED_ASSET_SQL} AS has_bed_asset
           FROM app.keys k
           LEFT JOIN app.room_keys rk ON rk.key_id = k.id
           LEFT JOIN app.rooms r ON r.id = rk.room_id
           LEFT JOIN app.building_rooms br ON br.room_id = r.id
           LEFT JOIN app.buildings b ON b.id = br.build_id
          WHERE k.id = $1
            AND k.camp_id = $2
          LIMIT 1
          FOR UPDATE OF k`,
        [keyId, campId],
      ),
    ]);
    const soldier = soldierResult.rows[0];
    const key = keyResult.rows[0];
    if (!soldier || !soldier.used_key || !key || key.soldier_id) return null;
    if (!isKeyEligibleForAccommodation(key)) return null;
    if (String(soldier.used_key) === String(keyId)) return { soldierId, keyId };

    const previousKeyUpdate = await client.query(
      `UPDATE app.keys
          SET soldier_id = NULL,
              updated_at = NOW()
        WHERE id = $1
          AND camp_id = $2
          AND soldier_id = $3
        RETURNING id`,
      [soldier.used_key, campId, soldierId],
    );
    if (previousKeyUpdate.rowCount !== 1) return null;

    const keyUpdate = await client.query(
      `UPDATE app.keys
          SET soldier_id = $3,
              updated_at = NOW()
        WHERE id = $1
          AND camp_id = $2
          AND soldier_id IS NULL
        RETURNING id`,
      [keyId, campId, soldierId],
    );
    if (keyUpdate.rowCount !== 1) {
      throw staleSelectionError(
        'ACCOMMODATION_MOVE_CONFLICT',
        'The destination key is no longer free.',
      );
    }

    const soldierUpdate = await client.query(
      `UPDATE app.soldiers
          SET used_key = $3,
              updated_at = NOW()
        WHERE id = $1
          AND camp_id = $2
          AND used_key = $4
        RETURNING id`,
      [soldierId, campId, keyId, soldier.used_key],
    );
    if (soldierUpdate.rowCount !== 1) {
      throw staleSelectionError(
        'ACCOMMODATION_MOVE_CONFLICT',
        'The soldier accommodation changed before the move could be completed.',
      );
    }
    await client.query(
      `INSERT INTO app.soldier_moves (id_new_key, id_prev_key, id_soldier, moved_at)
        VALUES ($1, $2, $3, NOW())`,
      [keyId, soldier.used_key, soldierId],
    );
    await client.query(
      `INSERT INTO app.user_monitoring_events (username, location)
        VALUES ((SELECT username FROM app.users WHERE id = $1), $2)`,
      [actorUserId, `Soldier ${soldier.name} moved to ${key.name}`],
    );

    return { soldierId, previousKeyId: soldier.used_key, keyId };
  });
}

async function swapSoldiers({ actorUserId, campId, soldierId, targetSoldierId }) {
  return withTransaction(async (client) => {
    const result = await client.query(
      `SELECT id, name, used_key
         FROM app.soldiers
        WHERE id IN ($1, $2)
          AND camp_id = $3
        FOR UPDATE`,
      [soldierId, targetSoldierId, campId],
    );
    const soldiers = new Map(result.rows.map((row) => [String(row.id), row]));
    const source = soldiers.get(String(soldierId));
    const target = soldiers.get(String(targetSoldierId));
    if (!source || !target || !source.used_key || !target.used_key) return null;

    const keyResult = await client.query(
      `SELECT id, soldier_id
         FROM app.keys
        WHERE id IN ($1, $2)
          AND camp_id = $3
        FOR UPDATE`,
      [source.used_key, target.used_key, campId],
    );
    const keys = new Map(keyResult.rows.map((row) => [String(row.id), row]));
    if (
      !sameId(keys.get(String(source.used_key))?.soldier_id, soldierId) ||
      !sameId(keys.get(String(target.used_key))?.soldier_id, targetSoldierId)
    ) {
      return null;
    }

    const soldierUpdate = await client.query(
      `UPDATE app.soldiers
          SET used_key = CASE
                WHEN id = $1 THEN $4
                WHEN id = $2 THEN $3
              END,
              updated_at = NOW()
        WHERE id IN ($1, $2)
          AND camp_id = $5
        RETURNING id`,
      [soldierId, targetSoldierId, source.used_key, target.used_key, campId],
    );
    if (soldierUpdate.rowCount !== 2) return null;

    const keyUpdate = await client.query(
      `UPDATE app.keys
          SET soldier_id = CASE
                WHEN id = $1 THEN $4
                WHEN id = $2 THEN $3
              END,
              updated_at = NOW()
        WHERE id IN ($1, $2)
          AND camp_id = $5
        RETURNING id`,
      [source.used_key, target.used_key, soldierId, targetSoldierId, campId],
    );
    if (keyUpdate.rowCount !== 2) {
      throw staleSelectionError(
        'ACCOMMODATION_SWAP_CONFLICT',
        'The selected accommodation changed before the swap could be completed.',
      );
    }
    await client.query(
      `INSERT INTO app.soldier_moves (id_new_key, id_prev_key, id_soldier, moved_at)
        VALUES ($1, $2, $3, NOW()), ($2, $1, $4, NOW())`,
      [target.used_key, source.used_key, soldierId, targetSoldierId],
    );
    await client.query(
      `INSERT INTO app.user_monitoring_events (username, location)
        VALUES ((SELECT username FROM app.users WHERE id = $1), $2)`,
      [actorUserId, `Soldiers ${source.name} and ${target.name} swapped accommodations`],
    );

    return {
      soldierId,
      targetSoldierId,
      soldierKeyId: target.used_key,
      targetSoldierKeyId: source.used_key,
    };
  });
}

async function addAdditionalItem({
  actorUserId,
  campId,
  soldierId,
  description = null,
  quantity = null,
  laundryBagId = null,
}) {
  return withTransaction(async (client) => {
    const soldier = await client.query(
      `SELECT id, name, laundry_bag_id
         FROM app.soldiers
        WHERE id = $1
          AND camp_id = $2
        LIMIT 1`,
      [soldierId, campId],
    );
    if (!soldier.rows[0]) return null;

    await occupyLaundryBagForSoldier(client, {
      campId,
      soldierId,
      laundryBagId,
    });

    const result = await client.query(
      `INSERT INTO app.additional_items (soldier_id, description, quantity, laundry_bag_id)
        VALUES ($1, NULLIF($2, ''), NULLIF($3, ''), $4)
        RETURNING id, soldier_id, description, quantity, laundry_bag_id`,
      [soldierId, description || '', quantity || '', laundryBagId || null],
    );
    await client.query(
      `INSERT INTO app.user_monitoring_events (username, location)
        VALUES ((SELECT username FROM app.users WHERE id = $1), $2)`,
      [actorUserId, `Additional item added for ${soldier.rows[0].name}`],
    );

    return mapAdditionalItemRow({
      ...result.rows[0],
      soldier_name: soldier.rows[0].name,
    });
  });
}

async function editAdditionalItem({
  actorUserId,
  campId,
  itemId,
  soldierId,
  description = null,
  quantity = null,
  laundryBagId = null,
}) {
  return withTransaction(async (client) => {
    const existing = await client.query(
      `SELECT ai.id, ai.soldier_id, ai.laundry_bag_id
         FROM app.additional_items ai
         JOIN app.soldiers s ON s.id = ai.soldier_id
        WHERE ai.id = $1
          AND s.camp_id = $2
        LIMIT 1`,
      [itemId, campId],
    );
    if (!existing.rows[0]) return null;

    const soldier = await client.query(
      `SELECT id, name, laundry_bag_id
         FROM app.soldiers
        WHERE id = $1
          AND camp_id = $2
        LIMIT 1`,
      [soldierId, campId],
    );
    if (!soldier.rows[0]) return null;

    const previousBagId = existing.rows[0].laundry_bag_id;
    const previousSoldierId = existing.rows[0].soldier_id;

    await occupyLaundryBagForSoldier(client, {
      campId,
      soldierId,
      laundryBagId,
      currentAdditionalItemId: itemId,
    });

    const result = await client.query(
      `UPDATE app.additional_items
          SET soldier_id = $2,
              description = NULLIF($3, ''),
              quantity = NULLIF($4, ''),
              laundry_bag_id = $5,
              updated_at = NOW()
        WHERE id = $1
        RETURNING id, soldier_id, description, quantity, laundry_bag_id`,
      [itemId, soldierId, description || '', quantity || '', laundryBagId || null],
    );
    if (previousBagId && String(previousBagId) !== String(laundryBagId || '')) {
      await releaseAdditionalLaundryBagIfUnused(client, {
        bagId: previousBagId,
        soldierId: previousSoldierId,
      });
    }
    await client.query(
      `INSERT INTO app.user_monitoring_events (username, location)
        VALUES ((SELECT username FROM app.users WHERE id = $1), $2)`,
      [actorUserId, `Additional item ${itemId} updated`],
    );

    return mapAdditionalItemRow({
      ...result.rows[0],
      soldier_name: soldier.rows[0].name,
    });
  });
}

async function deleteAdditionalItem({ actorUserId, itemId, campId }) {
  return withTransaction(async (client) => {
    const item = await client.query(
      `SELECT ai.id, ai.description, ai.soldier_id, ai.laundry_bag_id
         FROM app.additional_items ai
         JOIN app.soldiers s ON s.id = ai.soldier_id
        WHERE ai.id = $1
          AND s.camp_id = $2
        LIMIT 1`,
      [itemId, campId],
    );
    if (!item.rows[0]) return null;

    const deleted = await client.query(
      `DELETE FROM app.additional_items
        WHERE id = $1
        RETURNING id`,
      [itemId],
    );
    await releaseAdditionalLaundryBagIfUnused(client, {
      bagId: item.rows[0].laundry_bag_id,
      soldierId: item.rows[0].soldier_id,
    });
    if (deleted.rows[0]) {
      await client.query(
        `INSERT INTO app.user_monitoring_events (username, location)
          VALUES ((SELECT username FROM app.users WHERE id = $1), $2)`,
        [actorUserId, `Additional item ${item.rows[0].description || itemId} deleted`],
      );
    }

    return deleted.rows[0]
      ? { id: deleted.rows[0].id, description: item.rows[0].description }
      : null;
  });
}

async function findUpcomingActionsByCamp(campId) {
  return withClient(async (client) => {
    const result = await client.query(
      `
        SELECT
          s.id,
          s.name,
          s.upcoming_accommodation,
          s.upcoming_release,
          s.date_accommodation,
          s.date_free,
          s.upcoming_accommodation_key,
          uk.name AS upcoming_accommodation_key_name,
          s.used_key,
          k.id AS key_id,
          k.name AS key_name
        FROM app.soldiers s
        LEFT JOIN app.keys uk ON uk.id = s.upcoming_accommodation_key
        LEFT JOIN app.keys k ON k.id = s.used_key
        WHERE s.camp_id = $1
          AND (
            (
              s.upcoming_accommodation IS NOT NULL
              AND NOT (s.date_accommodation IS NOT NULL AND s.date_free IS NULL)
              AND CURRENT_DATE BETWEEN (s.upcoming_accommodation - INTERVAL '1 day')::date AND s.upcoming_accommodation
            )
            OR
            (
              s.upcoming_release IS NOT NULL
              AND s.date_accommodation IS NOT NULL
              AND s.date_free IS NULL
              AND CURRENT_DATE BETWEEN (s.upcoming_release - INTERVAL '1 day')::date AND s.upcoming_release
            )
          )
        ORDER BY s.name ASC
      `,
      [campId],
    );

    return result.rows.map(mapUpcomingActionRowToEntity);
  });
}

async function getAccommodationOverviewData({ campId }) {
  return withClient(async (client) => {
    const [
      buildingsResult,
      roomsResult,
      keysResult,
      soldiersResult,
      bagsResult,
      itemsResult,
      movementReportResult,
      additionalItemReportResult,
    ] = await Promise.all([
      client.query(
        `SELECT b.id, b.name, b.type
           FROM app.buildings b
          WHERE b.camp_id = $1
          ORDER BY b.name ASC`,
        [campId],
      ),
      client.query(
        `SELECT r.id,
                r.name,
                b.id AS building_id,
                b.name AS building_name
           FROM app.rooms r
           LEFT JOIN app.building_rooms br ON br.room_id = r.id
           LEFT JOIN app.buildings b ON b.id = br.build_id
          WHERE r.camp_id = $1
          ORDER BY COALESCE(b.name, ''), r.name ASC`,
        [campId],
      ),
      client.query(
        `SELECT k.id,
                k.name,
                k.nfc_code,
                r.id AS room_id,
                r.name AS room_name,
                b.id AS building_id,
                b.name AS building_name,
                b.type AS building_type,
                s.id AS soldier_id,
                s.name AS soldier_name,
                ${KEY_HAS_BED_ASSET_SQL} AS has_bed_asset
           FROM app.keys k
           LEFT JOIN app.room_keys rk ON rk.key_id = k.id
           LEFT JOIN app.rooms r ON r.id = rk.room_id
           LEFT JOIN app.building_rooms br ON br.room_id = r.id
           LEFT JOIN app.buildings b ON b.id = br.build_id
           LEFT JOIN app.soldiers s ON s.id = k.soldier_id
          WHERE k.camp_id = $1
          ORDER BY COALESCE(b.name, ''), COALESCE(r.name, ''), k.name ASC`,
        [campId],
      ),
      client.query(
        `SELECT s.id,
                s.name,
                s.country,
                s.meal_card,
                s.date_accommodation,
                s.date_free,
                s.laundry_bag_id,
                lb.code AS laundry_bag_code,
                s.used_key,
                k.id AS key_id,
                k.name AS key_name,
                r.id AS room_id,
                r.name AS room_name,
                b.id AS building_id,
                b.name AS building_name,
                s.upcoming_accommodation,
                s.upcoming_release,
                s.upcoming_accommodation_key,
                uk.name AS upcoming_accommodation_key_name,
                (
                  SELECT COUNT(*)::int
                    FROM app.bicycle_assignments ba
                    JOIN app.bicycles bike ON bike.id = ba.bike_id
                   WHERE ba.soldier_id = s.id
                     AND bike.camp_id = s.camp_id
                     AND ba.date_to IS NULL
                ) AS active_bike_rental_count
           FROM app.soldiers s
           LEFT JOIN app.laundry_bags lb ON lb.id = s.laundry_bag_id
           LEFT JOIN app.keys k ON k.id = s.used_key
           LEFT JOIN app.room_keys rk ON rk.key_id = k.id
           LEFT JOIN app.rooms r ON r.id = rk.room_id
           LEFT JOIN app.building_rooms br ON br.room_id = r.id
           LEFT JOIN app.buildings b ON b.id = br.build_id
           LEFT JOIN app.keys uk ON uk.id = s.upcoming_accommodation_key
          WHERE s.camp_id = $1
          ORDER BY s.name ASC`,
        [campId],
      ),
      client.query(
        `SELECT lb.id,
                lb.code,
                lb.rfid_code,
                lb.type,
                COALESCE(NULLIF(lb.status, ''), 'pick_up') AS status,
                COALESCE(lb.soldier_id, s_by_bag.id) AS soldier_id,
                COALESCE(s_direct.name, s_by_bag.name) AS soldier_name
           FROM app.laundry_bags lb
           LEFT JOIN app.soldiers s_direct ON s_direct.id = lb.soldier_id
           LEFT JOIN app.soldiers s_by_bag ON s_by_bag.laundry_bag_id = lb.id
          WHERE lb.camp_id = $1
          ORDER BY lb.code ASC`,
        [campId],
      ),
      client.query(
        `SELECT ai.id,
                ai.soldier_id,
                s.name AS soldier_name,
                ai.description,
                ai.quantity,
                ai.laundry_bag_id,
                lb.code AS laundry_bag_code
           FROM app.additional_items ai
           JOIN app.soldiers s ON s.id = ai.soldier_id
           LEFT JOIN app.laundry_bags lb ON lb.id = ai.laundry_bag_id
          WHERE s.camp_id = $1
          ORDER BY s.name ASC, ai.description ASC`,
        [campId],
      ),
      client.query(
        `SELECT sm.id,
                sm.moved_at AS happened_at,
                sm.id_soldier AS soldier_id,
                s.name AS soldier_name,
                s.meal_card AS soldier_meal_card,
                lb.code AS laundry_bag_code,
                sm.id_prev_key AS previous_key_id,
                prev_key.name AS previous_key_name,
                sm.id_new_key AS new_key_id,
                new_key.name AS new_key_name,
                CASE
                  WHEN sm.id_prev_key IS NULL AND sm.id_new_key IS NOT NULL THEN 'check-in'
                  WHEN sm.id_prev_key IS NOT NULL AND sm.id_new_key IS NULL THEN 'check-out'
                  ELSE 'move'
                END AS event_type
           FROM app.soldier_moves sm
           JOIN app.soldiers s ON s.id = sm.id_soldier
           LEFT JOIN app.laundry_bags lb ON lb.id = s.laundry_bag_id
           LEFT JOIN app.keys prev_key ON prev_key.id = sm.id_prev_key
           LEFT JOIN app.keys new_key ON new_key.id = sm.id_new_key
          WHERE s.camp_id = $1
          ORDER BY sm.moved_at DESC, sm.id DESC`,
        [campId],
      ),
      client.query(
        `SELECT ai.id,
                ai.soldier_id,
                s.name AS soldier_name,
                ai.description,
                ai.quantity,
                ai.laundry_bag_id,
                lb.code AS laundry_bag_code,
                ai.created_at,
                ai.updated_at
           FROM app.additional_items ai
           JOIN app.soldiers s ON s.id = ai.soldier_id
           LEFT JOIN app.laundry_bags lb ON lb.id = ai.laundry_bag_id
          WHERE s.camp_id = $1
          ORDER BY ai.created_at DESC, ai.id DESC`,
        [campId],
      ),
    ]);

    return {
      buildings: buildingsResult.rows.map((row) => ({
        id: row.id,
        name: row.name,
        type: row.type,
      })),
      rooms: roomsResult.rows.map((row) => ({
        id: row.id,
        name: row.name,
        buildingId: row.building_id,
        buildingName: row.building_name,
      })),
      keys: keysResult.rows.map((row) => ({
        id: row.id,
        name: row.name,
        nfcCode: row.nfc_code,
        roomId: row.room_id,
        roomName: row.room_name,
        buildingId: row.building_id,
        buildingName: row.building_name,
        buildingType: row.building_type,
        soldierId: row.soldier_id,
        soldierName: row.soldier_name,
        hasBedAsset: row.has_bed_asset,
      })),
      soldiers: soldiersResult.rows.map(mapSoldierRow),
      laundryBags: bagsResult.rows.map(mapLaundryBagRow),
      additionalItems: itemsResult.rows.map(mapAdditionalItemRow),
      movementReport: movementReportResult.rows.map(mapAccommodationMovementReportRow),
      additionalItemReport: additionalItemReportResult.rows.map(mapAdditionalItemReportRow),
    };
  });
}

module.exports = {
  accommodateSoldier,
  addAdditionalItem,
  addBuilding,
  addKey,
  addRoom,
  addSoldier,
  deleteAdditionalItem,
  deleteBuilding,
  deleteKey,
  deleteRoom,
  deleteSoldier,
  dischargeSoldier,
  editAdditionalItem,
  editBuilding,
  editKey,
  editRoom,
  editSoldier,
  findBuildingById,
  findBuildingByName,
  findAdditionalItemById,
  findKeyById,
  findKeyByName,
  findKeyByNfcCode,
  findLaundryBagByCode,
  findLaundryBagById,
  findLaundryBagByRfid,
  findRoomById,
  findRoomByName,
  findSoldierDeletionBlockers,
  findSoldierById,
  findSoldierByName,
  findUpcomingActionsByCamp,
  getAccommodationOverviewData,
  issueKeyToSoldier,
  listUserPermissions,
  moveSoldier,
  releaseKeyFromSoldier,
  swapSoldiers,
  userHasPermission,
};
