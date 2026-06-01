const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const {
  buildSchemaState,
  renderSchemaMarkdown,
} = require('../../../src/infrastructure/db/migrations/schema-state');

const projectRoot = path.resolve(__dirname, '..', '..', '..');
const schemaDocPath = path.join(projectRoot, 'docs', 'database', 'schema.md');

const LEGACY_IDENTIFIERS = [
  'camp_name',
  'name_building',
  'name_room',
  'name_key',
  'name_soldier',
  'name_bike',
  'type_name',
  'name_assets',
  'create_date',
  'date_change',
  'date_move',
  'accept_date',
  'permission_name',
  'perm_id',
  'users_sessions',
  'users_requests',
  'users_permission',
  'security_audit_log',
  'bike_soldier',
  'move_soldier',
  'users_monitoring',
  'laundry_report',
  'assets_type',
  'additional_item',
  'clear_item',
  'clean_item_traceability',
  'build_rooms',
  'rooms_keys',
];

function listSourceFiles(rootDir) {
  const files = [];

  function walk(currentDir) {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(absolutePath);
        continue;
      }
      if (entry.isFile() && absolutePath.endsWith('.ts')) {
        files.push(absolutePath);
      }
    }
  }

  walk(rootDir);
  return files;
}

test('generated schema doc stays in sync with migrations', async () => {
  const schemaState = buildSchemaState();
  const expectedMarkdown = renderSchemaMarkdown(schemaState);
  const actualMarkdown = fs.readFileSync(schemaDocPath, 'utf8');

  assert.equal(actualMarkdown, expectedMarkdown);
});

test('repository and maintenance queries do not reference renamed legacy identifiers', async () => {
  const sourceFiles = [
    ...listSourceFiles(path.join(projectRoot, 'src', 'modules')),
    ...listSourceFiles(path.join(projectRoot, 'src', 'infrastructure', 'maintenance')),
  ];

  for (const filePath of sourceFiles) {
    const content = fs.readFileSync(filePath, 'utf8');

    for (const identifier of LEGACY_IDENTIFIERS) {
      const pattern = new RegExp(`\\b${identifier}\\b`, 'i');
      assert.equal(
        pattern.test(content),
        false,
        `Legacy identifier "${identifier}" found in ${path.relative(projectRoot, filePath)}`,
      );
    }
  }
});
