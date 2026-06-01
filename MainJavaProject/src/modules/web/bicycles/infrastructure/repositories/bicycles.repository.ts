const { withClient, withTransaction } = require('../../../../../infrastructure/db/transaction');

function mapBicycleRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    campId: row.camp_id || null,
    name: row.name,
    nfcCode: row.nfc_code,
    status: row.status,
    assignedSoldierId: row.assigned_soldier_id || null,
    assignedSoldier: row.assigned_soldier || null,
    helmetId: row.helmet_id || null,
    helmetCode: row.helmet_code || null,
    assignmentId: row.assignment_id || null,
    rentedAt: row.rented_at || null,
    returnedAt: row.returned_at || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

function mapSoldierRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    country: row.country || null,
    mealCard: row.meal_card || null,
    activeAssignmentCount: Number(row.active_assignment_count || 0),
  };
}

function mapHelmetRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    campId: row.camp_id || null,
    code: row.code,
    nfcCode: row.nfc_code || null,
    identifier: row.bicycle_id || null,
    bicycleName: row.bicycle_name || null,
    assignedSoldierId: row.assigned_soldier_id || null,
    assignedSoldier: row.assigned_soldier || null,
    assignmentId: row.assignment_id || null,
    status: row.status || null,
    rentedAt: row.rented_at || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

function mapAssignmentRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    identifier: row.bike_id,
    soldierId: row.soldier_id,
    soldierName: row.soldier_name || null,
    helmetId: row.helmet_id || null,
    helmetCode: row.helmet_code || null,
    rentedAt: row.date_from,
    returnedAt: row.date_to || null,
    status: row.status_bike || null,
  };
}

function mapRentalReportRow(row) {
  if (!row) return null;
  return {
    assignmentId: row.assignment_id,
    identifier: row.bicycle_id,
    bicycleName: row.bicycle_name || null,
    bicycleNfcCode: row.bicycle_nfc_code || null,
    soldierId: row.soldier_id || null,
    soldierName: row.soldier_name || null,
    soldierCountry: row.soldier_country || null,
    soldierMealCard: row.soldier_meal_card || null,
    helmetId: row.helmet_id || null,
    helmetCode: row.helmet_code || null,
    helmetNfcCode: row.helmet_nfc_code || null,
    rentedAt: row.rented_at || null,
    returnedAt: row.returned_at || null,
    status: row.status || null,
    rentalDate: row.rental_date || null,
  };
}

function mapRentalDailyTotalRow(row) {
  if (!row) return null;
  return {
    date: row.rental_date,
    rentalCount: Number(row.rental_count) || 0,
  };
}

async function findOverviewByCamp({ campId }) {
  return withClient(async (client) => {
    const result = await client.query(
      `
        WITH active_assignments AS (
          SELECT
            ba.id,
            ba.bike_id,
            ba.soldier_id,
            ba.helmet_id,
            ba.date_from,
            ba.date_to,
            ba.status_bike,
            ROW_NUMBER() OVER (
              PARTITION BY ba.bike_id
              ORDER BY COALESCE(ba.date_from, NOW()) DESC, ba.id DESC
            ) AS row_number
          FROM app.bicycle_assignments ba
          JOIN app.bicycles active_b
            ON active_b.id = ba.bike_id
           AND active_b.camp_id = $1
          WHERE ba.date_to IS NULL
        )
        SELECT
          b.id,
          b.name,
          b.nfc_code,
          COALESCE(NULLIF(b.status, ''), 'available') AS status,
          b.created_at,
          b.updated_at,
          aa.id AS assignment_id,
          aa.soldier_id AS assigned_soldier_id,
          aa.helmet_id,
          aa.date_from AS rented_at,
          aa.date_to AS returned_at,
          s.name AS assigned_soldier,
          h.code AS helmet_code
        FROM app.bicycles b
        LEFT JOIN active_assignments aa
          ON aa.bike_id = b.id
         AND aa.row_number = 1
        LEFT JOIN app.soldiers s
          ON s.id = aa.soldier_id
        LEFT JOIN app.helmets h
          ON h.id = aa.helmet_id
        WHERE b.camp_id = $1
        ORDER BY b.name ASC
      `,
      [campId],
    );

    return result.rows.map(mapBicycleRow);
  });
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

async function findBicycleById({ identifier, campId }) {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT id, camp_id, name, nfc_code, COALESCE(NULLIF(status, ''), 'available') AS status,
              created_at, updated_at
         FROM app.bicycles
        WHERE id = $1
          AND ($2::uuid IS NULL OR camp_id = $2::uuid)
        LIMIT 1`,
      [identifier, campId || null],
    );

    return mapBicycleRow(result.rows[0]);
  });
}

async function findBicycleByName({ name, campId }) {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT id, camp_id, name, nfc_code, COALESCE(NULLIF(status, ''), 'available') AS status,
              created_at, updated_at
         FROM app.bicycles
        WHERE LOWER(name) = LOWER($1)
          AND camp_id = $2
        LIMIT 1`,
      [name, campId],
    );

    return mapBicycleRow(result.rows[0]);
  });
}

async function findBicycleByNfcCode({ nfcCode }) {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT id, camp_id, name, nfc_code, COALESCE(NULLIF(status, ''), 'available') AS status,
              created_at, updated_at
         FROM app.bicycles
        WHERE LOWER(nfc_code) = LOWER($1)
        LIMIT 1`,
      [nfcCode],
    );

    return mapBicycleRow(result.rows[0]);
  });
}

async function addBicycle({ actorUserId, campId, name, nfcCode }) {
  return withTransaction(async (client) => {
    const result = await client.query(
      `INSERT INTO app.bicycles (name, nfc_code, status, camp_id)
        VALUES ($1, $2, 'available', $3)
        RETURNING id, name, nfc_code, status, created_at, updated_at`,
      [name, nfcCode, campId],
    );

    await client.query(
      `INSERT INTO app.user_monitoring_events (username, location)
        VALUES ((SELECT username FROM app.users WHERE id = $1), $2)`,
      [actorUserId, `Bicycle ${name} added`],
    );

    return mapBicycleRow(result.rows[0]);
  });
}

async function editBicycle({ actorUserId, identifier, campId, name, nfcCode, assignment = null }) {
  return withTransaction(async (client) => {
    const nextStatus = assignment?.status || null;
    const result = await client.query(
      `UPDATE app.bicycles
          SET name = $3,
              nfc_code = $4,
              status = COALESCE($5, status),
              updated_at = NOW()
        WHERE id = $1
          AND camp_id = $2
        RETURNING id, name, nfc_code, COALESCE(NULLIF(status, ''), 'available') AS status,
                  created_at, updated_at`,
      [identifier, campId, name, nfcCode, nextStatus],
    );

    if (result.rows[0] && assignment) {
      await client.query(
        `UPDATE app.bicycle_assignments
            SET soldier_id = $3,
                helmet_id = $4,
                date_from = $5,
                status_bike = $6
          WHERE id = $1
            AND bike_id = $2
            AND date_to IS NULL`,
        [
          assignment.assignmentId,
          identifier,
          assignment.soldierId || null,
          assignment.helmetId || null,
          assignment.rentedAt,
          assignment.status,
        ],
      );
    }

    if (result.rows[0]) {
      await client.query(
        `INSERT INTO app.user_monitoring_events (username, location)
          VALUES ((SELECT username FROM app.users WHERE id = $1), $2)`,
        [actorUserId, `Bicycle ${name} updated`],
      );
    }

    return mapBicycleRow(result.rows[0]);
  });
}

async function deleteBicycle({ actorUserId, identifier, campId }) {
  return withTransaction(async (client) => {
    const bicycle = await client.query(
      `SELECT id, name
         FROM app.bicycles
        WHERE id = $1
          AND camp_id = $2
        LIMIT 1`,
      [identifier, campId],
    );
    if (!bicycle.rows[0]) return null;

    const deleted = await client.query(
      `DELETE FROM app.bicycles b
        WHERE b.id = $1
          AND b.camp_id = $2
          AND NOT EXISTS (
            SELECT 1
              FROM app.bicycle_assignments ba
             WHERE ba.bike_id = b.id
               AND ba.date_to IS NULL
          )
        RETURNING b.id`,
      [identifier, campId],
    );

    if (deleted.rows[0]) {
      await client.query(
        `INSERT INTO app.user_monitoring_events (username, location)
          VALUES ((SELECT username FROM app.users WHERE id = $1), $2)`,
        [actorUserId, `Bicycle ${bicycle.rows[0].name} deleted`],
      );
    }

    return deleted.rows[0] ? { id: deleted.rows[0].id, name: bicycle.rows[0].name } : null;
  });
}

async function findActiveAssignment({ identifier }) {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT
          ba.id,
          ba.bike_id,
          ba.soldier_id,
          ba.helmet_id,
          ba.date_from,
          ba.date_to,
          ba.status_bike,
          s.name AS soldier_name,
          h.code AS helmet_code
        FROM app.bicycle_assignments ba
        LEFT JOIN app.soldiers s ON s.id = ba.soldier_id
        LEFT JOIN app.helmets h ON h.id = ba.helmet_id
       WHERE ba.bike_id = $1
         AND ba.date_to IS NULL
       ORDER BY ba.date_from DESC, ba.id DESC
       LIMIT 1`,
      [identifier],
    );

    return mapAssignmentRow(result.rows[0]);
  });
}

async function hasAssignmentHistory({ identifier }) {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT 1
         FROM app.bicycle_assignments
        WHERE bike_id = $1
        LIMIT 1`,
      [identifier],
    );

    return result.rowCount > 0;
  });
}

async function helmetHasAssignmentHistory({ helmetId }) {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT 1
         FROM app.bicycle_assignments
        WHERE helmet_id = $1
        LIMIT 1`,
      [helmetId],
    );

    return result.rowCount > 0;
  });
}

async function helmetHasActiveAssignment({ helmetId, excludeAssignmentId = null }) {
  if (!helmetId) return false;
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT 1
         FROM app.bicycle_assignments
        WHERE helmet_id = $1
          AND date_to IS NULL
          AND ($2::uuid IS NULL OR id <> $2::uuid)
        LIMIT 1`,
      [helmetId, excludeAssignmentId || null],
    );

    return result.rowCount > 0;
  });
}

async function findSoldierById({ soldierId, campId }) {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT id, name, country, meal_card
         FROM app.soldiers
        WHERE id = $1
          AND camp_id = $2
        LIMIT 1`,
      [soldierId, campId],
    );

    return mapSoldierRow(result.rows[0]);
  });
}

async function findHelmetById({ helmetId, campId }) {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT id, camp_id, code, nfc_code
         FROM app.helmets
        WHERE id = $1
          AND ($2::uuid IS NULL OR camp_id = $2::uuid)
        LIMIT 1`,
      [helmetId, campId || null],
    );

    return mapHelmetRow(result.rows[0]);
  });
}

async function findHelmetByCode({ code, campId }) {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT id, camp_id, code, nfc_code
         FROM app.helmets
        WHERE LOWER(code) = LOWER($1)
          AND camp_id = $2
        LIMIT 1`,
      [code, campId],
    );

    return mapHelmetRow(result.rows[0]);
  });
}

async function findHelmetByNfcCode({ nfcCode, campId = null }) {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT id, camp_id, code, nfc_code
         FROM app.helmets
        WHERE LOWER(nfc_code) = LOWER($1)
          AND ($2::uuid IS NULL OR camp_id = $2::uuid)
        LIMIT 1`,
      [nfcCode, campId || null],
    );

    return mapHelmetRow(result.rows[0]);
  });
}

async function findSoldierByName({ name, campId }) {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT id, name, country, meal_card
         FROM app.soldiers
        WHERE LOWER(name) = LOWER($1)
          AND camp_id = $2
        LIMIT 1`,
      [name, campId],
    );

    return mapSoldierRow(result.rows[0]);
  });
}

async function findSoldierByKeyNfcCode({ nfcCode, campId }) {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT s.id, s.name, s.country, s.meal_card
         FROM app.keys k
         JOIN app.soldiers s
           ON s.camp_id = k.camp_id
          AND (
            s.used_key = k.id
            OR s.upcoming_accommodation_key = k.id
            OR s.id = k.soldier_id
          )
        WHERE LOWER(k.nfc_code) = LOWER($1)
          AND k.camp_id = $2
        ORDER BY
          CASE
            WHEN s.used_key = k.id THEN 0
            WHEN s.id = k.soldier_id THEN 1
            WHEN s.upcoming_accommodation_key = k.id THEN 2
            ELSE 3
          END,
          s.name ASC
        LIMIT 1`,
      [nfcCode, campId],
    );

    return mapSoldierRow(result.rows[0]);
  });
}

async function listHelmetsByCamp({ campId }) {
  return withClient(async (client) => {
    const result = await client.query(
      `
        WITH active_assignments AS (
          SELECT
            ba.id,
            ba.bike_id,
            ba.soldier_id,
            ba.helmet_id,
            ba.date_from,
            ba.status_bike,
            ROW_NUMBER() OVER (
              PARTITION BY ba.helmet_id
              ORDER BY COALESCE(ba.date_from, NOW()) DESC, ba.id DESC
            ) AS row_number
          FROM app.bicycle_assignments ba
          JOIN app.helmets active_h
            ON active_h.id = ba.helmet_id
           AND active_h.camp_id = $1
          WHERE ba.date_to IS NULL
            AND ba.helmet_id IS NOT NULL
        )
        SELECT
          h.id,
          h.code,
          h.nfc_code,
          aa.id AS assignment_id,
          aa.bike_id AS bicycle_id,
          b.name AS bicycle_name,
          aa.soldier_id AS assigned_soldier_id,
          s.name AS assigned_soldier,
          COALESCE(NULLIF(aa.status_bike, ''), NULLIF(b.status, ''), 'available') AS status,
          aa.date_from AS rented_at
        FROM app.helmets h
        LEFT JOIN active_assignments aa
          ON aa.helmet_id = h.id
         AND aa.row_number = 1
        LEFT JOIN app.bicycles b
          ON b.id = aa.bike_id
        LEFT JOIN app.soldiers s
          ON s.id = aa.soldier_id
        WHERE h.camp_id = $1
        ORDER BY h.code ASC
      `,
      [campId],
    );

    return result.rows.map(mapHelmetRow);
  });
}

async function addHelmet({ actorUserId, campId, code, nfcCode }) {
  return withTransaction(async (client) => {
    const result = await client.query(
      `INSERT INTO app.helmets (code, nfc_code, camp_id)
        VALUES ($1, $2, $3)
        RETURNING id, code, nfc_code`,
      [code, nfcCode, campId],
    );

    await client.query(
      `INSERT INTO app.user_monitoring_events (username, location)
        VALUES ((SELECT username FROM app.users WHERE id = $1), $2)`,
      [actorUserId, `Helmet ${code} added`],
    );

    return mapHelmetRow(result.rows[0]);
  });
}

async function editHelmet({ actorUserId, helmetId, campId, code, nfcCode }) {
  return withTransaction(async (client) => {
    const result = await client.query(
      `UPDATE app.helmets
          SET code = $3,
              nfc_code = $4
        WHERE id = $1
          AND camp_id = $2
        RETURNING id, code, nfc_code`,
      [helmetId, campId, code, nfcCode],
    );

    if (result.rows[0]) {
      await client.query(
        `INSERT INTO app.user_monitoring_events (username, location)
          VALUES ((SELECT username FROM app.users WHERE id = $1), $2)`,
        [actorUserId, `Helmet ${code} updated`],
      );
    }

    return mapHelmetRow(result.rows[0]);
  });
}

async function deleteHelmet({ actorUserId, helmetId, campId }) {
  return withTransaction(async (client) => {
    const helmet = await client.query(
      `SELECT id, code
         FROM app.helmets
        WHERE id = $1
          AND camp_id = $2
        LIMIT 1`,
      [helmetId, campId],
    );
    if (!helmet.rows[0]) return null;

    const deleted = await client.query(
      `DELETE FROM app.helmets h
        WHERE h.id = $1
          AND h.camp_id = $2
          AND NOT EXISTS (
            SELECT 1
              FROM app.bicycle_assignments ba
             WHERE ba.helmet_id = h.id
               AND ba.date_to IS NULL
          )
        RETURNING h.id`,
      [helmetId, campId],
    );

    if (deleted.rows[0]) {
      await client.query(
        `INSERT INTO app.user_monitoring_events (username, location)
          VALUES ((SELECT username FROM app.users WHERE id = $1), $2)`,
        [actorUserId, `Helmet ${helmet.rows[0].code} deleted`],
      );
    }

    return deleted.rows[0] ? { id: deleted.rows[0].id, code: helmet.rows[0].code } : null;
  });
}

async function listSoldiers({ campId, search = '', limit = 20 }) {
  return withClient(async (client) => {
    const params = [campId, Math.min(Math.max(Number(limit) || 20, 1), 50)];
    let searchSql = '';
    if (String(search || '').trim()) {
      params.push(`%${String(search).trim()}%`);
      searchSql = `AND (s.id::text ILIKE $3 OR s.name ILIKE $3 OR COALESCE(s.country, '') ILIKE $3 OR COALESCE(s.meal_card, '') ILIKE $3)`;
    }

    const result = await client.query(
      `SELECT s.id,
              s.name,
              s.country,
              s.meal_card,
              COALESCE(active_assignments.assignment_count, 0)::int AS active_assignment_count
         FROM app.soldiers s
        LEFT JOIN LATERAL (
          SELECT COUNT(*)::int AS assignment_count
            FROM app.bicycle_assignments ba
            JOIN app.bicycles b
              ON b.id = ba.bike_id
             AND b.camp_id = s.camp_id
           WHERE ba.soldier_id = s.id
             AND ba.date_to IS NULL
             AND COALESCE(NULLIF(ba.status_bike, ''), NULLIF(b.status, ''), 'rented') IN ('rented', 'late', 'long_term')
        ) active_assignments ON TRUE
        WHERE s.camp_id = $1
          ${searchSql}
        ORDER BY s.name ASC
        LIMIT $2`,
      params,
    );

    return result.rows.map(mapSoldierRow);
  });
}

async function listActiveAssignmentCountsBySoldierIds({ campId, soldierIds = [] }) {
  const ids = [...new Set((soldierIds || []).map((id) => String(id || '')).filter(Boolean))];
  if (!ids.length) return new Map();

  return withClient(async (client) => {
    const result = await client.query(
      `SELECT ba.soldier_id, COUNT(*)::int AS active_assignment_count
         FROM app.bicycle_assignments ba
         JOIN app.bicycles b
           ON b.id = ba.bike_id
          AND b.camp_id = $1
        WHERE ba.soldier_id = ANY($2::uuid[])
          AND ba.date_to IS NULL
          AND COALESCE(NULLIF(ba.status_bike, ''), NULLIF(b.status, ''), 'rented') IN ('rented', 'late', 'long_term')
        GROUP BY ba.soldier_id`,
      [campId, ids],
    );

    return new Map(
      result.rows.map((row) => [
        String(row.soldier_id),
        Number(row.active_assignment_count || 0),
      ]),
    );
  });
}

async function listAvailableHelmets({ campId, search = '', limit = 20, identifier = null }) {
  return withClient(async (client) => {
    const params = [
      campId,
      Math.min(Math.max(Number(limit) || 20, 1), 50),
      identifier || null,
    ];
    let searchSql = '';
    if (String(search || '').trim()) {
      params.push(`%${String(search).trim()}%`);
      searchSql = `AND (h.id::text ILIKE $4 OR h.code ILIKE $4 OR h.nfc_code ILIKE $4)`;
    }

    const result = await client.query(
      `SELECT h.id, h.code, h.nfc_code
         FROM app.helmets h
        WHERE h.camp_id = $1
          ${searchSql}
          AND NOT EXISTS (
            SELECT 1
              FROM app.bicycle_assignments ba
             WHERE ba.helmet_id = h.id
               AND ba.date_to IS NULL
               AND ($3::uuid IS NULL OR ba.bike_id <> $3::uuid)
          )
        ORDER BY h.code ASC
        LIMIT $2`,
      params,
    );

    return result.rows.map(mapHelmetRow);
  });
}

async function listRentalReport({ campId, from, to }) {
  return withClient(async (client) => {
    const params = [campId, from, to];
    const rowsResult = await client.query(
      `
        SELECT
          ba.id AS assignment_id,
          b.id AS bicycle_id,
          b.name AS bicycle_name,
          b.nfc_code AS bicycle_nfc_code,
          ba.soldier_id,
          s.name AS soldier_name,
          s.country AS soldier_country,
          s.meal_card AS soldier_meal_card,
          ba.helmet_id,
          h.code AS helmet_code,
          h.nfc_code AS helmet_nfc_code,
          ba.date_from AS rented_at,
          ba.date_to AS returned_at,
          COALESCE(NULLIF(ba.status_bike, ''), 'rented') AS status,
          TO_CHAR(ba.date_from AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS rental_date
        FROM app.bicycle_assignments ba
        JOIN app.bicycles b
          ON b.id = ba.bike_id
        LEFT JOIN app.soldiers s
          ON s.id = ba.soldier_id
        LEFT JOIN app.helmets h
          ON h.id = ba.helmet_id
        WHERE b.camp_id = $1
          AND ba.date_from >= $2
          AND ba.date_from < $3
        ORDER BY ba.date_from ASC, b.name ASC, ba.id ASC
      `,
      params,
    );

    const totalsResult = await client.query(
      `
        SELECT
          TO_CHAR(ba.date_from AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS rental_date,
          COUNT(*)::int AS rental_count
        FROM app.bicycle_assignments ba
        JOIN app.bicycles b
          ON b.id = ba.bike_id
        WHERE b.camp_id = $1
          AND ba.date_from >= $2
          AND ba.date_from < $3
        GROUP BY TO_CHAR(ba.date_from AT TIME ZONE 'UTC', 'YYYY-MM-DD')
        ORDER BY rental_date ASC
      `,
      params,
    );

    return {
      rows: rowsResult.rows.map(mapRentalReportRow),
      dailyTotals: totalsResult.rows.map(mapRentalDailyTotalRow),
    };
  });
}

async function listRecentRentalsByAsset({ campId, assetType, assetId, limit = 2 }) {
  return withClient(async (client) => {
    const result = await client.query(
      `
        SELECT
          ba.id AS assignment_id,
          b.id AS bicycle_id,
          b.name AS bicycle_name,
          b.nfc_code AS bicycle_nfc_code,
          ba.soldier_id,
          s.name AS soldier_name,
          s.country AS soldier_country,
          s.meal_card AS soldier_meal_card,
          ba.helmet_id,
          h.code AS helmet_code,
          h.nfc_code AS helmet_nfc_code,
          ba.date_from AS rented_at,
          ba.date_to AS returned_at,
          COALESCE(NULLIF(ba.status_bike, ''), 'rented') AS status,
          TO_CHAR(ba.date_from AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS rental_date
        FROM app.bicycle_assignments ba
        JOIN app.bicycles b
          ON b.id = ba.bike_id
        LEFT JOIN app.soldiers s
          ON s.id = ba.soldier_id
        LEFT JOIN app.helmets h
          ON h.id = ba.helmet_id
        WHERE b.camp_id = $1
          AND (
            ($2 = 'bicycle' AND ba.bike_id = $3)
            OR ($2 = 'helmet' AND ba.helmet_id = $3)
          )
        ORDER BY ba.date_from DESC, ba.id DESC
        LIMIT $4
      `,
      [campId, assetType, assetId, Math.min(Math.max(Number(limit) || 2, 1), 10)],
    );

    return result.rows.map(mapRentalReportRow);
  });
}

async function listActiveAssignmentsBySoldier({ campId, soldierId }) {
  return withClient(async (client) => {
    const result = await client.query(
      `
        SELECT
          ba.id AS assignment_id,
          b.id AS bicycle_id,
          b.name AS bicycle_name,
          b.nfc_code AS bicycle_nfc_code,
          ba.soldier_id,
          s.name AS soldier_name,
          s.country AS soldier_country,
          s.meal_card AS soldier_meal_card,
          ba.helmet_id,
          h.code AS helmet_code,
          h.nfc_code AS helmet_nfc_code,
          ba.date_from AS rented_at,
          ba.date_to AS returned_at,
          COALESCE(NULLIF(ba.status_bike, ''), NULLIF(b.status, ''), 'rented') AS status,
          TO_CHAR(ba.date_from AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS rental_date
        FROM app.bicycle_assignments ba
        JOIN app.bicycles b
          ON b.id = ba.bike_id
        JOIN app.soldiers s
          ON s.id = ba.soldier_id
        LEFT JOIN app.helmets h
          ON h.id = ba.helmet_id
        WHERE b.camp_id = $1
          AND ba.soldier_id = $2
          AND ba.date_to IS NULL
          AND COALESCE(NULLIF(ba.status_bike, ''), NULLIF(b.status, ''), 'rented') IN ('rented', 'late', 'long_term')
        ORDER BY ba.date_from DESC, b.name ASC, ba.id DESC
      `,
      [campId, soldierId],
    );

    return result.rows.map(mapRentalReportRow);
  });
}

async function markOverdueRentalsLate({ campId } = {}) {
  return withTransaction(async (client) => {
    const params = [];
    const campFilter = campId ? 'AND b.camp_id = $1' : '';
    if (campId) params.push(campId);

    const result = await client.query(
      `
        WITH overdue AS (
          SELECT DISTINCT ba.bike_id
            FROM app.bicycle_assignments ba
            JOIN app.bicycles b
              ON b.id = ba.bike_id
           WHERE ba.date_to IS NULL
             AND ba.date_from < NOW() - INTERVAL '24 hours'
             AND COALESCE(NULLIF(b.status, ''), 'available') = 'rented'
             ${campFilter}
        ),
        assignment_updates AS (
          UPDATE app.bicycle_assignments ba
             SET status_bike = 'late'
            FROM overdue o
           WHERE ba.bike_id = o.bike_id
             AND ba.date_to IS NULL
             AND COALESCE(NULLIF(ba.status_bike, ''), 'rented') = 'rented'
          RETURNING ba.bike_id
        ),
        bike_updates AS (
          UPDATE app.bicycles b
             SET status = 'late',
                 updated_at = NOW()
            FROM overdue o
           WHERE b.id = o.bike_id
             AND COALESCE(NULLIF(b.status, ''), 'available') = 'rented'
          RETURNING b.id, b.camp_id, b.name
        )
        SELECT bu.id,
               bu.camp_id,
               bu.name,
               s.name AS soldier_name,
               ba.date_from AS rented_at
          FROM bike_updates bu
          LEFT JOIN app.bicycle_assignments ba
            ON ba.bike_id = bu.id
           AND ba.date_to IS NULL
          LEFT JOIN app.soldiers s
            ON s.id = ba.soldier_id
         ORDER BY bu.id
      `,
      params,
    );

    return result.rows.map((row) => ({
      identifier: row.id,
      campId: row.camp_id,
      bicycleName: row.name,
      previousStatus: 'rented',
      status: 'late',
      soldierName: row.soldier_name || null,
      rentedAt: row.rented_at || null,
    }));
  });
}

async function rentBicycle({
  actorUserId,
  campId,
  identifier,
  soldierId,
  helmetId = null,
  rentedAt,
  longTerm = false,
}) {
  return withTransaction(async (client) => {
    const status = longTerm ? 'long_term' : 'rented';
    await client.query(
      `UPDATE app.bicycles
          SET status = $3,
              updated_at = NOW()
        WHERE id = $1
          AND camp_id = $2`,
      [identifier, campId, status],
    );

    const assignment = await client.query(
      `INSERT INTO app.bicycle_assignments
          (bike_id, soldier_id, helmet_id, date_from, status_bike)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, bike_id, soldier_id, helmet_id, date_from, date_to, status_bike`,
      [identifier, soldierId, helmetId || null, rentedAt, status],
    );

    await client.query(
      `INSERT INTO app.user_monitoring_events (username, location)
        VALUES ((SELECT username FROM app.users WHERE id = $1), $2)`,
      [actorUserId, `Bicycle ${identifier} rented`],
    );

    return mapAssignmentRow(assignment.rows[0]);
  });
}

async function markBicycleRepair({ actorUserId, campId, identifier, markedAt }) {
  return withTransaction(async (client) => {
    const result = await client.query(
      `UPDATE app.bicycles
          SET status = 'repair',
              updated_at = NOW()
        WHERE id = $1
          AND camp_id = $2
        RETURNING id, name, nfc_code, COALESCE(NULLIF(status, ''), 'available') AS status,
                  created_at, updated_at`,
      [identifier, campId],
    );

    if (result.rows[0]) {
      await client.query(
        `INSERT INTO app.bicycle_assignments
            (bike_id, soldier_id, helmet_id, date_from, status_bike)
          VALUES ($1, NULL, NULL, $2, 'repair')`,
        [identifier, markedAt],
      );

      await client.query(
        `INSERT INTO app.user_monitoring_events (username, location)
          VALUES ((SELECT username FROM app.users WHERE id = $1), $2)`,
        [
          actorUserId,
          `Bicycle ${identifier} marked for repair at ${markedAt.toISOString()}`,
        ],
      );
    }

    return mapBicycleRow(result.rows[0]);
  });
}

async function returnBicycle({ actorUserId, campId, identifier, returnedAt }) {
  return withTransaction(async (client) => {
    const assignment = await client.query(
      `UPDATE app.bicycle_assignments
          SET date_to = $2
        WHERE bike_id = $1
          AND date_to IS NULL
        RETURNING id, bike_id, soldier_id, helmet_id, date_from, date_to, status_bike`,
      [identifier, returnedAt],
    );

    await client.query(
      `UPDATE app.bicycles
          SET status = 'available',
              updated_at = NOW()
        WHERE id = $1
          AND camp_id = $2`,
      [identifier, campId],
    );

    await client.query(
      `INSERT INTO app.user_monitoring_events (username, location)
        VALUES ((SELECT username FROM app.users WHERE id = $1), $2)`,
      [actorUserId, `Bicycle ${identifier} returned`],
    );

    return mapAssignmentRow(assignment.rows[0]);
  });
}

module.exports = {
  addBicycle,
  addHelmet,
  deleteBicycle,
  deleteHelmet,
  editBicycle,
  editHelmet,
  findActiveAssignment,
  findBicycleById,
  findBicycleByName,
  findBicycleByNfcCode,
  findHelmetByCode,
  findHelmetById,
  findHelmetByNfcCode,
  findOverviewByCamp,
  findSoldierById,
  findSoldierByKeyNfcCode,
  findSoldierByName,
  hasAssignmentHistory,
  helmetHasAssignmentHistory,
  helmetHasActiveAssignment,
  listHelmetsByCamp,
  listActiveAssignmentCountsBySoldierIds,
  listActiveAssignmentsBySoldier,
  listAvailableHelmets,
  listRecentRentalsByAsset,
  listRentalReport,
  listSoldiers,
  listUserPermissions,
  markOverdueRentalsLate,
  markBicycleRepair,
  rentBicycle,
  returnBicycle,
  userHasPermission,
};
