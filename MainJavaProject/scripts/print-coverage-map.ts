const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'tests', 'COVERAGE_MAP.md');
process.stdout.write(fs.readFileSync(file, 'utf8'));
