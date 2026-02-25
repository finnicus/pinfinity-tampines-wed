const fs = require('fs');
const path = require('path');

const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

const now = new Date();
const year = now.getFullYear();
const month = String(now.getMonth() + 1).padStart(2, '0');
const day = String(now.getDate()).padStart(2, '0');
const todayPrefix = `${year}.${month}${day}`;

const currentVersion = packageJson.version || '';
const match = currentVersion.match(/^(\d{4}\.\d{4})\.(\d+)$/);

let minor = 1;
if (match && match[1] === todayPrefix) {
  minor = Number.parseInt(match[2], 10) + 1;
}

const newVersion = `${todayPrefix}.${minor}`;
packageJson.version = newVersion;

fs.writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
console.log(`Version updated: ${currentVersion} -> ${newVersion}`);
