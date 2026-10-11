const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
fs.copyFileSync(path.join(root, 'matrix-rain-utility-suite.html'), path.join(root, 'index.html'));
console.log('index.html now matches the main application.');
