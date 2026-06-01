require('./register-typescript');

const fs = require('fs');
const path = require('path');
const {
  buildSchemaState,
  renderSchemaMarkdown,
} = require('../src/infrastructure/db/migrations/schema-state');

const outputPath = path.join(__dirname, '..', 'docs', 'database', 'schema.md');
const schemaState = buildSchemaState();
const markdown = renderSchemaMarkdown(schemaState);

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, markdown, 'utf8');
process.stdout.write(`Wrote schema documentation to ${outputPath}\n`);
