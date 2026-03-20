const fs = require('node:fs');
const path = require('node:path');

const configPath = path.join(__dirname, '..', 'data', 'config.json');
const examplePath = path.join(__dirname, '..', 'data', 'config.example.json');

if (!fs.existsSync(configPath)) {
  throw new Error(`Saknar data/config.json. Kopiera först ${examplePath} till ${configPath} och fyll i värdena.`);
}

const config = require(configPath);

for (const key of ['token', 'clientId', 'guildId']) {
  if (!config[key] || config[key].includes('DIN_')) {
    throw new Error(`config.json saknar giltigt värde för '${key}'.`);
  }
}

module.exports = config;
