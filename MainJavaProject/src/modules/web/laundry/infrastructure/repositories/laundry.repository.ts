const { withClient, withTransaction } = require('../../../../../infrastructure/db/transaction');

function bagStatusSql(alias = '') {
  const column = alias ? `${alias}.status` : 'status';
  const normalized = `LOWER(REGEXP_REPLACE(TRIM(${column}), '[^[:alnum:]]+', '_', 'g'))`;
  return `CASE
            WHEN NULLIF(TRIM(${column}), '') IS NULL THEN 'pick_up'
            WHEN ${normalized} IN ('pick_up', 'available', 'none') THEN 'pick_up'
            WHEN ${normalized} = 'drop_off' THEN 'drop_off'
            WHEN ${normalized} IN ('laundry_facility', 'transportation_to_laundry_facility') THEN 'laundry_facility'
            WHEN ${normalized} IN ('ready_to_pick_up', 'transportation_to_pick_up') THEN 'ready_to_pick_up'
            ELSE COALESCE(NULLIF(TRIM(${column}), ''), 'pick_up')
          END`;
}

function mapBagRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    rfidCode: row.rfid_code || null,
    type: row.type || null,
    status: row.status || 'pick_up',
    laundryCount: Number(row.laundry_count) || 0,
    maxCountLaundry: Number(row.max_count_laundry) || 1,
    soldierId: row.soldier_id || null,
    soldierName: row.soldier_name || null,
    campId: row.camp_id || null,
    hasLaundryReportHistory: Boolean(row.has_laundry_report_history),
    dateDropOff: row.date_drop_off || null,
    isOverdue: false,
    overdueSince: null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

function mapLaundryReportRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    bagId: row.bag_id || null,
    bagCode: row.bag_code || null,
    rfidCode: row.rfid_code || null,
    type: row.type || null,
    soldierId: row.soldier_id || null,
    soldierName: row.soldier_name || null,
    soldierCountry: row.soldier_country || null,
    soldierMealCard: row.soldier_meal_card || null,
    dateDropOff: row.date_drop_off || null,
    dateReadyToPickUp: row.date_ready_to_pick_up || null,
    reportDate: row.report_date || null,
    isLinenExchange: Boolean(row.is_linen_exchange),
  };
}

function monitoringMessage(action, code) {
  return `Laundry bag ${code} ${action}`;
}

async function insertMonitoringEvent(client, actorUserId, location) {
  if (!actorUserId) return;

  await client.query(
    `INSERT INTO app.user_monitoring_events (username, location)
      SELECT username, $2
        FROM app.users
       WHERE id = $1`,
    [actorUserId, location],
  );
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

async function listBagsByCamp({ campId }) {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT
          lb.id,
          lb.code,
          lb.rfid_code,
          lb.type,
          ${bagStatusSql('lb')} AS status,
          lb.laundry_count,
          lb.max_count_laundry,
          COALESCE(lb.soldier_id, s_by_bag.id) AS soldier_id,
          COALESCE(s_direct.name, s_by_bag.name) AS soldier_name,
          lb.camp_id,
          EXISTS (
            SELECT 1
              FROM app.laundry_reports lr
             WHERE lr.bag_id = lb.id
          ) AS has_laundry_report_history,
          active_report.date_drop_off,
          lb.created_at,
          lb.updated_at
        FROM app.laundry_bags lb
        LEFT JOIN app.soldiers s_direct
          ON s_direct.id = lb.soldier_id
        LEFT JOIN app.soldiers s_by_bag
          ON s_by_bag.laundry_bag_id = lb.id
        LEFT JOIN LATERAL (
          SELECT lr.date_drop_off
            FROM app.laundry_reports lr
           WHERE lr.bag_id = lb.id
             AND lr.date_drop_off IS NOT NULL
             AND lr.date_ready_to_pick_up IS NULL
           ORDER BY lr.date_drop_off DESC, lr.id DESC
           LIMIT 1
        ) active_report ON TRUE
        WHERE lb.camp_id = $1
        ORDER BY lb.code ASC, lb.id ASC`,
      [campId],
    );

    return result.rows.map(mapBagRow);
  });
}

async function listAvailableBags({ campId, search = '', limit = 20 }) {
  return withClient(async (client) => {
    const params = [campId, Math.min(Math.max(Number(limit) || 20, 1), 50)];
    let searchSql = '';
    if (String(search || '').trim()) {
      params.push(`%${String(search).trim()}%`);
      searchSql = `AND (
        lb.code ILIKE $3
        OR COALESCE(lb.rfid_code, '') ILIKE $3
        OR COALESCE(lb.type, '') ILIKE $3
        OR lb.id::text ILIKE $3
      )`;
    }

    const result = await client.query(
      `SELECT
          lb.id,
          lb.code,
          lb.rfid_code,
          lb.type,
          ${bagStatusSql('lb')} AS status,
          lb.laundry_count,
          lb.max_count_laundry,
          COALESCE(lb.soldier_id, s_by_bag.id) AS soldier_id,
          COALESCE(s_direct.name, s_by_bag.name) AS soldier_name,
          lb.camp_id,
          EXISTS (
            SELECT 1
              FROM app.laundry_reports lr
             WHERE lr.bag_id = lb.id
          ) AS has_laundry_report_history,
          lb.created_at,
          lb.updated_at
        FROM app.laundry_bags lb
        LEFT JOIN app.soldiers s_direct
          ON s_direct.id = lb.soldier_id
        LEFT JOIN app.soldiers s_by_bag
          ON s_by_bag.laundry_bag_id = lb.id
        WHERE lb.camp_id = $1
          AND ${bagStatusSql('lb')} = 'pick_up'
          AND lb.soldier_id IS NULL
          AND s_by_bag.id IS NULL
          ${searchSql}
        ORDER BY lb.code ASC, lb.id ASC
        LIMIT $2`,
      params,
    );

    return result.rows.map(mapBagRow);
  });
}

async function listLaundryReport({ campId, from, to }) {
  return withClient(async (client) => {
    const result = await client.query(
      `
        SELECT
          lr.id,
          lr.bag_id,
          lb.code AS bag_code,
          lb.rfid_code,
          lb.type,
          lr.soldier_id,
          s.name AS soldier_name,
          s.country AS soldier_country,
          s.meal_card AS soldier_meal_card,
          lr.date_drop_off,
          lr.date_ready_to_pick_up,
          TO_CHAR(lr.date_drop_off AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS report_date,
          (
            lr.date_drop_off IS NOT NULL
            AND lr.date_ready_to_pick_up IS NOT NULL
            AND lr.date_drop_off = lr.date_ready_to_pick_up
          ) AS is_linen_exchange
        FROM app.laundry_reports lr
        JOIN app.laundry_bags lb
          ON lb.id = lr.bag_id
        LEFT JOIN app.soldiers s
          ON s.id = lr.soldier_id
        WHERE lb.camp_id = $1
          AND lr.date_drop_off >= $2
          AND lr.date_drop_off < $3
        ORDER BY lr.date_drop_off ASC, lb.code ASC, lr.id ASC
      `,
      [campId, from, to],
    );

    return result.rows.map(mapLaundryReportRow);
  });
}

async function findBagById({ bagId, campId }) {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT
          lb.id,
          lb.code,
          lb.rfid_code,
          lb.type,
          ${bagStatusSql('lb')} AS status,
          lb.laundry_count,
          lb.max_count_laundry,
          COALESCE(lb.soldier_id, s_by_bag.id) AS soldier_id,
          COALESCE(s_direct.name, s_by_bag.name) AS soldier_name,
          lb.camp_id,
          EXISTS (
            SELECT 1
              FROM app.laundry_reports lr
             WHERE lr.bag_id = lb.id
          ) AS has_laundry_report_history,
          lb.created_at,
          lb.updated_at
        FROM app.laundry_bags lb
        LEFT JOIN app.soldiers s_direct
          ON s_direct.id = lb.soldier_id
        LEFT JOIN app.soldiers s_by_bag
          ON s_by_bag.laundry_bag_id = lb.id
        WHERE lb.id = $1
          AND lb.camp_id = $2
        LIMIT 1`,
      [bagId, campId],
    );

    return mapBagRow(result.rows[0]);
  });
}

async function getBagDeletionBlockers({ bagId, campId }) {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT
          EXISTS (
            SELECT 1
              FROM app.laundry_bags lb
             WHERE lb.id = $1
               AND lb.camp_id = $2
               AND lb.soldier_id IS NOT NULL
          )
          OR EXISTS (
            SELECT 1
              FROM app.soldiers s
             WHERE s.laundry_bag_id = $1
               AND s.camp_id = $2
          ) AS has_soldier_assignment,
          EXISTS (
            SELECT 1
              FROM app.laundry_reports lr
             WHERE lr.bag_id = $1
             LIMIT 1
          ) AS has_laundry_report_history,
          EXISTS (
            SELECT 1
              FROM app.additional_items ai
              JOIN app.soldiers s ON s.id = ai.soldier_id
             WHERE ai.laundry_bag_id = $1
               AND s.camp_id = $2
             LIMIT 1
          ) AS has_additional_item_references`,
      [bagId, campId],
    );
    const row = result.rows[0] || {};
    return {
      hasSoldierAssignment: Boolean(row.has_soldier_assignment),
      hasLaundryReportHistory: Boolean(row.has_laundry_report_history),
      hasAdditionalItemReferences: Boolean(row.has_additional_item_references),
    };
  });
}

async function findBagByCode({ code, campId }) {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT id, code, rfid_code, type, ${bagStatusSql()} AS status,
              laundry_count, max_count_laundry, soldier_id, camp_id, created_at, updated_at
         FROM app.laundry_bags
        WHERE LOWER(code) = LOWER($1)
          AND camp_id = $2
        LIMIT 1`,
      [code, campId],
    );

    return mapBagRow(result.rows[0]);
  });
}

async function findBagByRfid({ rfidCode }) {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT id, code, rfid_code, type, ${bagStatusSql()} AS status,
              laundry_count, max_count_laundry, soldier_id, camp_id, created_at, updated_at
         FROM app.laundry_bags
        WHERE LOWER(rfid_code) = LOWER($1)
        LIMIT 1`,
      [rfidCode],
    );

    return mapBagRow(result.rows[0]);
  });
}

async function addBag({
  actorUserId,
  campId,
  code,
  rfidCode,
  type = null,
  status = 'pick_up',
  maxCountLaundry = 1,
}) {
  return withTransaction(async (client) => {
    const result = await client.query(
      `INSERT INTO app.laundry_bags (code, rfid_code, type, status, max_count_laundry, camp_id)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, code, rfid_code, type, ${bagStatusSql()} AS status,
                  laundry_count, max_count_laundry, soldier_id, camp_id, created_at, updated_at`,
      [code, rfidCode, type || null, status, maxCountLaundry, campId],
    );

    await insertMonitoringEvent(client, actorUserId, monitoringMessage('added', code));
    return mapBagRow(result.rows[0]);
  });
}

async function editBag({ actorUserId, campId, bagId, code, rfidCode, type = null, maxCountLaundry = 1 }) {
  return withTransaction(async (client) => {
    const result = await client.query(
      `UPDATE app.laundry_bags
          SET code = $3,
              rfid_code = $4,
              type = $5,
              max_count_laundry = $6,
              updated_at = NOW()
        WHERE id = $1
          AND camp_id = $2
        RETURNING id, code, rfid_code, type, ${bagStatusSql()} AS status,
                  laundry_count, max_count_laundry, soldier_id, camp_id, created_at, updated_at`,
      [bagId, campId, code, rfidCode, type || null, maxCountLaundry],
    );

    if (result.rows[0]) {
      await insertMonitoringEvent(client, actorUserId, monitoringMessage('updated', code));
    }

    return mapBagRow(result.rows[0]);
  });
}

async function deleteBag({ actorUserId, campId, bagId }) {
  return withTransaction(async (client) => {
    const current = await client.query(
      `SELECT id, code
         FROM app.laundry_bags
        WHERE id = $1
          AND camp_id = $2
        LIMIT 1`,
      [bagId, campId],
    );

    if (!current.rows[0]) return null;

    const deleted = await client.query(
      `DELETE FROM app.laundry_bags lb
        WHERE lb.id = $1
          AND lb.camp_id = $2
          AND ${bagStatusSql('lb')} = 'pick_up'
          AND lb.soldier_id IS NULL
          AND NOT EXISTS (
            SELECT 1
              FROM app.soldiers s
             WHERE s.laundry_bag_id = lb.id
               AND s.camp_id = lb.camp_id
          )
          AND NOT EXISTS (
            SELECT 1
              FROM app.additional_items ai
              JOIN app.soldiers s ON s.id = ai.soldier_id
             WHERE ai.laundry_bag_id = lb.id
               AND s.camp_id = lb.camp_id
          )
        RETURNING lb.id`,
      [bagId, campId],
    );

    if (deleted.rows[0]) {
      await insertMonitoringEvent(
        client,
        actorUserId,
        monitoringMessage('removed', current.rows[0].code),
      );
    }

    return deleted.rows[0] ? { id: deleted.rows[0].id, code: current.rows[0].code } : null;
  });
}

async function setBagStatus({ actorUserId, campId, bagId, status, expectedStatus = null }) {
  return withTransaction(async (client) => {
    const params = [bagId, campId, status];
    const expectedStatusSql = expectedStatus
      ? `AND ${bagStatusSql()} = $4`
      : '';
    if (expectedStatus) params.push(expectedStatus);

    const result = await client.query(
      `UPDATE app.laundry_bags
          SET status = $3,
              updated_at = NOW()
        WHERE id = $1
          AND camp_id = $2
          ${expectedStatusSql}
        RETURNING id, code, rfid_code, type, ${bagStatusSql()} AS status,
                  laundry_count, max_count_laundry, soldier_id, camp_id, created_at, updated_at`,
      params,
    );

    const bag = mapBagRow(result.rows[0]);
    if (!bag) return null;

    if (status === 'drop_off' || status === 'laundry_facility') {
      await client.query(
        `INSERT INTO app.laundry_reports (bag_id, date_drop_off, soldier_id)
          SELECT $1, NOW(), $2
          WHERE NOT EXISTS (
            SELECT 1
              FROM app.laundry_reports
             WHERE bag_id = $1
               AND date_drop_off IS NOT NULL
               AND date_ready_to_pick_up IS NULL
          )`,
        [bagId, bag.soldierId || null],
      );
    }

    if (status === 'ready_to_pick_up' || status === 'pick_up') {
      await client.query(
        `UPDATE app.laundry_reports
            SET date_ready_to_pick_up = COALESCE(date_ready_to_pick_up, NOW())
          WHERE id = (
            SELECT id
              FROM app.laundry_reports
             WHERE bag_id = $1
               AND date_ready_to_pick_up IS NULL
             ORDER BY date_drop_off DESC NULLS LAST, id DESC
             LIMIT 1
          )`,
        [bagId],
      );
    }

    await insertMonitoringEvent(
      client,
      actorUserId,
      `Laundry bag ${bag.code} moved to ${status}`,
    );
    return bag;
  });
}

async function recordLinenExchange({ actorUserId, campId, bagId }) {
  return withTransaction(async (client) => {
    const current = await client.query(
      `SELECT
          lb.id,
          lb.code,
          lb.rfid_code,
          lb.type,
          ${bagStatusSql('lb')} AS status,
          lb.laundry_count,
          lb.max_count_laundry,
          COALESCE(lb.soldier_id, s_by_bag.id) AS soldier_id,
          COALESCE(s_direct.name, s_by_bag.name) AS soldier_name,
          lb.camp_id,
          lb.created_at,
          lb.updated_at
        FROM app.laundry_bags lb
        LEFT JOIN app.soldiers s_direct
          ON s_direct.id = lb.soldier_id
        LEFT JOIN app.soldiers s_by_bag
          ON s_by_bag.laundry_bag_id = lb.id
        WHERE lb.id = $1
          AND lb.camp_id = $2
        LIMIT 1`,
      [bagId, campId],
    );

    const bag = mapBagRow(current.rows[0]);
    if (!bag) return null;

    await client.query(
      `INSERT INTO app.laundry_reports (bag_id, date_drop_off, date_ready_to_pick_up, soldier_id)
        SELECT $1, exchange_date, exchange_date, $2
          FROM (SELECT NOW() AS exchange_date) timestamp_source`,
      [bagId, bag.soldierId || null],
    );

    await insertMonitoringEvent(
      client,
      actorUserId,
      `Laundry bag ${bag.code} linen exchange recorded`,
    );
    return bag;
  });
}

async function bulkUpsertBags({ actorUserId, campId, rows = [] }) {
  return withTransaction(async (client) => {
    const results = [];

    for (const row of rows) {
      if (row.id) {
        const updated = await client.query(
          `UPDATE app.laundry_bags
              SET code = $3,
                  rfid_code = $4,
                  type = $5,
                  max_count_laundry = $6,
                  updated_at = NOW()
            WHERE id = $1
              AND camp_id = $2
            RETURNING id, code, rfid_code, type, ${bagStatusSql()} AS status,
                      laundry_count, max_count_laundry, soldier_id, camp_id, created_at, updated_at`,
          [row.id, campId, row.code, row.rfidCode, row.type || null, row.maxCountLaundry],
        );
        results.push({ action: updated.rows[0] ? 'updated' : 'missing', bag: mapBagRow(updated.rows[0]) });
      } else {
        const inserted = await client.query(
          `INSERT INTO app.laundry_bags (code, rfid_code, type, status, max_count_laundry, camp_id)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, code, rfid_code, type, ${bagStatusSql()} AS status,
                      laundry_count, max_count_laundry, soldier_id, camp_id, created_at, updated_at`,
          [row.code, row.rfidCode, row.type || null, 'pick_up', row.maxCountLaundry, campId],
        );
        results.push({ action: 'added', bag: mapBagRow(inserted.rows[0]) });
      }
    }

    await insertMonitoringEvent(
      client,
      actorUserId,
      `Laundry bags bulk updated (${results.length} rows)`,
    );

    return results;
  });
}

module.exports = {
  addBag,
  bulkUpsertBags,
  deleteBag,
  editBag,
  findBagByCode,
  findBagById,
  findBagByRfid,
  getBagDeletionBlockers,
  listAvailableBags,
  listBagsByCamp,
  listLaundryReport,
  listUserPermissions,
  recordLinenExchange,
  setBagStatus,
  userHasPermission,
};
