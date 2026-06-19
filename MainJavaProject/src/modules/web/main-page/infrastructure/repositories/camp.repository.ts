const { withClient, withTransaction } = require('../../../../../infrastructure/db/transaction');

function mapCampRowToEntity(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
  };
}

function mapDependencySummary(results = []) {
  const counts = Object.fromEntries(results);
  return {
    helmets: counts.helmets || 0,
    buildings: counts.buildings || 0,
    rooms: counts.rooms || 0,
    keys: counts.keys || 0,
    soldiers: counts.soldiers || 0,
    bicycles: counts.bicycles || 0,
    laundryBags: counts.laundry_bags || 0,
    assets: counts.assets || 0,
    assetActions: counts.asset_actions || 0,
    cleanItems: counts.clean_items || 0,
    cleanItemEvents: counts.clean_item_events || 0,
  };
}

async function addCamp({ actorUserId, campName }) {
  return withTransaction(async (client) => {
    const result = await client.query(
      `INSERT INTO app.camps (name)
        VALUES ($1)
        RETURNING id, name AS name, created_at`,
      [campName],
    );
    const createdCamp = mapCampRowToEntity(result.rows[0]);

    await client.query(
      `INSERT INTO app.user_camp_access (user_id, camp_id, created_by)
       SELECT id, $1, $2
         FROM app.users
       ON CONFLICT (user_id, camp_id) DO NOTHING`,
      [createdCamp.id, actorUserId],
    );

    await client.query(
      `INSERT INTO app.user_monitoring_events (username, location)
        VALUES ((SELECT username FROM app.users WHERE id = $1), $2)`,
      [actorUserId, `Camp ${campName} added`],
    );

    return createdCamp;
  });
}

async function editCamp({ actorUserId, campId, campName }) {
  return withClient(async (client) => {
    const result = await client.query(
      `UPDATE app.camps
        SET name = $2
        WHERE id = $1
        RETURNING id, name AS name, created_at`,
      [campId, campName],
    );

    await client.query(
      `INSERT INTO app.user_monitoring_events (username, location)
        VALUES ((SELECT username FROM app.users WHERE id = $1), $2)`,
      [actorUserId, `Camp with ID ${campId} was edited`],
    );

    return mapCampRowToEntity(result.rows[0]);
  });
}

async function findCampById(campId) {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT id, name AS name, created_at
         FROM app.camps
        WHERE id = $1
        LIMIT 1`,
      [campId],
    );

    return mapCampRowToEntity(result.rows[0]);
  });
}

async function findCampByName(campName) {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT id, name AS name, created_at
         FROM app.camps
        WHERE LOWER(name) = LOWER($1)
        LIMIT 1`,
      [campName],
    );

    return mapCampRowToEntity(result.rows[0]);
  });
}

async function getCampDependencySummary({ campId }) {
  return withClient(async (client) => {
    const queries = [
      ['helmets', 'SELECT COUNT(*)::int AS count FROM app.helmets WHERE camp_id = $1'],
      ['buildings', 'SELECT COUNT(*)::int AS count FROM app.buildings WHERE camp_id = $1'],
      ['rooms', 'SELECT COUNT(*)::int AS count FROM app.rooms WHERE camp_id = $1'],
      ['keys', 'SELECT COUNT(*)::int AS count FROM app.keys WHERE camp_id = $1'],
      ['soldiers', 'SELECT COUNT(*)::int AS count FROM app.soldiers WHERE camp_id = $1'],
      ['bicycles', 'SELECT COUNT(*)::int AS count FROM app.bicycles WHERE camp_id = $1'],
      ['laundry_bags', 'SELECT COUNT(*)::int AS count FROM app.laundry_bags WHERE camp_id = $1'],
      ['assets', 'SELECT COUNT(*)::int AS count FROM app.assets WHERE camp_id = $1'],
      ['asset_actions', 'SELECT COUNT(*)::int AS count FROM app.asset_actions WHERE camp_id = $1'],
      ['clean_items', 'SELECT COUNT(*)::int AS count FROM app.clean_items WHERE camp_id = $1'],
      [
        'clean_item_events',
        'SELECT COUNT(*)::int AS count FROM app.clean_item_events WHERE camp_id = $1',
      ],
    ];

    const results = await Promise.all(
      queries.map(async ([name, query]) => {
        const result = await client.query(query, [campId]);
        return [name, Number(result.rows[0]?.count || 0)];
      }),
    );

    return mapDependencySummary(results);
  });
}

async function deleteCamp({ actorUserId, campId }) {
  return withClient(async (client) => {
    const result = await client.query(
      `DELETE FROM app.camps
        WHERE id = $1
        RETURNING id`,
      [campId],
    );

    await client.query(
      `INSERT INTO app.user_monitoring_events (username, location)
        VALUES ((SELECT username FROM app.users WHERE id = $1), $2)`,
      [actorUserId, `Camp with ID ${campId} was deleted`],
    );

    return result.rows[0] ? { id: result.rows[0].id } : null;
  });
}

module.exports = {
  addCamp,
  editCamp,
  findCampById,
  findCampByName,
  getCampDependencySummary,
  deleteCamp,
};
