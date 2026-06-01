const fs = require('fs');
const path = require('path');

const DEFAULT_MIGRATIONS_DIR = path.join(__dirname, 'sql');

function normalizeIdentifier(value) {
  return String(value || '')
    .trim()
    .replaceAll('"', '')
    .toLowerCase();
}

function normalizeTableName(value) {
  const normalized = normalizeIdentifier(value);
  if (!normalized) return '';
  if (normalized.includes('.')) return normalized;
  return `app.${normalized}`;
}

function ensureTable(state, tableName) {
  const normalizedTableName = normalizeTableName(tableName);
  if (!normalizedTableName) return null;

  if (!state.tables.has(normalizedTableName)) {
    state.tables.set(normalizedTableName, {
      name: normalizedTableName,
      columns: [],
    });
  }

  return state.tables.get(normalizedTableName);
}

function addColumn(state, tableName, columnName) {
  const table = ensureTable(state, tableName);
  const normalizedColumnName = normalizeIdentifier(columnName);
  if (!table || !normalizedColumnName) return;
  if (!table.columns.includes(normalizedColumnName)) {
    table.columns.push(normalizedColumnName);
  }
}

function renameTable(state, fromName, toName) {
  const sourceName = normalizeTableName(fromName);
  const targetName = normalizeTableName(toName);
  if (!sourceName || !targetName || sourceName === targetName) return;

  const existing = state.tables.get(sourceName);
  if (!existing) {
    ensureTable(state, targetName);
    return;
  }

  state.tables.delete(sourceName);
  existing.name = targetName;
  state.tables.set(targetName, existing);
}

function renameColumn(state, tableName, fromName, toName) {
  const table = ensureTable(state, tableName);
  const sourceName = normalizeIdentifier(fromName);
  const targetName = normalizeIdentifier(toName);
  if (!table || !sourceName || !targetName || sourceName === targetName) return;

  const existingIndex = table.columns.indexOf(sourceName);
  if (existingIndex >= 0) {
    table.columns.splice(existingIndex, 1, targetName);
  } else if (!table.columns.includes(targetName)) {
    table.columns.push(targetName);
  }

  table.columns = [...new Set(table.columns)];
}

function copyColumns(state, fromTableName, toTableName) {
  const source = ensureTable(state, fromTableName);
  const target = ensureTable(state, toTableName);
  if (!source || !target) return;

  for (const columnName of source.columns) {
    addColumn(state, target.name, columnName);
  }
}

function countParens(value) {
  let depth = 0;
  for (const char of String(value || '')) {
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
  }
  return depth;
}

function extractCreateTableStatements(sql) {
  const lines = String(sql || '').split(/\r?\n/);
  const statements = [];

  for (let index = 0; index < lines.length; index += 1) {
    if (!/^\s*create table\b/i.test(lines[index])) continue;

    const statementLines = [lines[index]];
    let depth = countParens(lines[index]);

    while (index + 1 < lines.length && depth > 0) {
      index += 1;
      statementLines.push(lines[index]);
      depth += countParens(lines[index]);
    }

    statements.push(statementLines.join('\n'));
  }

  return statements;
}

function applyCreateTableStatement(state, statement) {
  const headerMatch = statement.match(/create table(?: if not exists)?\s+([^\s(]+)\s*\(/i);
  if (!headerMatch) return;

  const tableName = normalizeTableName(headerMatch[1]);
  const table = ensureTable(state, tableName);
  if (!table) return;

  const bodyStart = statement.indexOf('(');
  const bodyEnd = statement.lastIndexOf(')');
  const body = bodyStart >= 0 && bodyEnd > bodyStart ? statement.slice(bodyStart + 1, bodyEnd) : '';

  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.trim().replace(/,$/, '');
    if (!line) continue;

    const likeMatch = line.match(/^like\s+([^\s]+)\b/i);
    if (likeMatch) {
      copyColumns(state, likeMatch[1], tableName);
      continue;
    }

    if (/^(constraint|primary key|foreign key|unique|check|exclude|references)\b/i.test(line)) {
      continue;
    }

    const columnMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\b/);
    if (!columnMatch) continue;
    addColumn(state, tableName, columnMatch[1]);
  }
}

function applyRenameStatements(state, sql) {
  const renameTablePattern =
    /alter table(?: if exists)?\s+([a-zA-Z0-9_."]+)\s+rename to\s+([a-zA-Z0-9_."]+)/gi;
  let renameTableMatch = renameTablePattern.exec(sql);
  while (renameTableMatch) {
    renameTable(state, renameTableMatch[1], renameTableMatch[2]);
    renameTableMatch = renameTablePattern.exec(sql);
  }

  const renameColumnPattern =
    /alter table(?: if exists)?\s+([a-zA-Z0-9_."]+)\s+rename column\s+([a-zA-Z0-9_"]+)\s+to\s+([a-zA-Z0-9_"]+)/gi;
  let renameColumnMatch = renameColumnPattern.exec(sql);
  while (renameColumnMatch) {
    renameColumn(state, renameColumnMatch[1], renameColumnMatch[2], renameColumnMatch[3]);
    renameColumnMatch = renameColumnPattern.exec(sql);
  }
}

function applyAddColumnStatements(state, sql) {
  const tableStatementPattern = /alter table(?: if exists)?\s+([a-zA-Z0-9_."]+)([\s\S]*?);/gi;
  let tableStatementMatch = tableStatementPattern.exec(sql);

  while (tableStatementMatch) {
    const tableName = tableStatementMatch[1];
    const body = tableStatementMatch[2];
    const addColumnPattern = /add column(?: if not exists)?\s+([a-zA-Z0-9_"]+)/gi;
    let addColumnMatch = addColumnPattern.exec(body);

    while (addColumnMatch) {
      addColumn(state, tableName, addColumnMatch[1]);
      addColumnMatch = addColumnPattern.exec(body);
    }

    tableStatementMatch = tableStatementPattern.exec(sql);
  }
}

function getMigrationFiles(migrationsDir = DEFAULT_MIGRATIONS_DIR) {
  return fs
    .readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .sort();
}

function buildSchemaState({ migrationsDir = DEFAULT_MIGRATIONS_DIR } = {}) {
  const state = {
    tables: new Map(),
  };

  for (const fileName of getMigrationFiles(migrationsDir)) {
    const sql = fs.readFileSync(path.join(migrationsDir, fileName), 'utf8');

    for (const statement of extractCreateTableStatements(sql)) {
      applyCreateTableStatement(state, statement);
    }

    applyRenameStatements(state, sql);
    applyAddColumnStatements(state, sql);
  }

  addColumn(state, 'app.schema_migrations', 'version');
  addColumn(state, 'app.schema_migrations', 'checksum');
  addColumn(state, 'app.schema_migrations', 'applied_at');

  return {
    tables: [...state.tables.values()].sort((left, right) => left.name.localeCompare(right.name)),
  };
}

function renderSchemaMarkdown(schemaState) {
  const lines = [
    '# Database Schema',
    '',
    'Generated from `src/infrastructure/db/migrations/sql/*.sql`.',
    '',
  ];

  for (const table of schemaState.tables) {
    lines.push(`## \`${table.name}\``);
    lines.push('');

    if (!table.columns.length) {
      lines.push('- Columns inferred dynamically during migration execution.');
      lines.push('');
      continue;
    }

    for (const columnName of table.columns) {
      lines.push(`- \`${columnName}\``);
    }
    lines.push('');
  }

  return `${lines.join('\n').trim()}\n`;
}

module.exports = {
  DEFAULT_MIGRATIONS_DIR,
  buildSchemaState,
  renderSchemaMarkdown,
};
