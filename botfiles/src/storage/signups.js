const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const dataPath = path.join(__dirname, '..', '..', 'data', 'signups.json');

function ensureFile() {
  if (!fs.existsSync(dataPath)) {
    fs.mkdirSync(path.dirname(dataPath), { recursive: true });
    fs.writeFileSync(dataPath, JSON.stringify({ signups: [] }, null, 2));
  }
}

function readData() {
  ensureFile();
  const raw = fs.readFileSync(dataPath, 'utf8');
  const parsed = JSON.parse(raw || '{"signups":[]}');
  if (!Array.isArray(parsed.signups)) parsed.signups = [];
  return parsed;
}

function writeData(data) {
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
}

function makeId(prefix = 'id') {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

function listSignups(guildId) {
  return readData().signups.filter((s) => s.guildId === guildId);
}

function getSignup(signupId) {
  return readData().signups.find((s) => s.id === signupId) ?? null;
}

function getSignupByMessageId(messageId) {
  return readData().signups.find((s) => s.messageId === messageId) ?? null;
}

function createSignup(data) {
  const db = readData();
  const signup = {
    id: makeId('signup'),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    closed: false,
    imageUrl: '',
    eventUrl: '',
    players: [],
    ...data,
  };
  db.signups.push(signup);
  writeData(db);
  return signup;
}

function updateSignup(signupId, updater) {
  const db = readData();
  const index = db.signups.findIndex((s) => s.id === signupId);
  if (index === -1) return null;
  const current = db.signups[index];
  const next = typeof updater === 'function' ? updater({ ...current }) : { ...current, ...updater };
  next.updatedAt = new Date().toISOString();
  db.signups[index] = next;
  writeData(db);
  return next;
}

function deleteSignup(signupId) {
  const db = readData();
  const index = db.signups.findIndex((s) => s.id === signupId);
  if (index === -1) return null;
  const [removed] = db.signups.splice(index, 1);
  writeData(db);
  return removed;
}

function normalizeName(name) {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

function addPlayers(signupId, ownerUserId, ownerTag, rawNames) {
  return updateSignup(signupId, (signup) => {
    const lines = rawNames
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const added = [];
    const duplicates = [];

    for (const name of lines) {
      const normalized = normalizeName(name);
      if (signup.players.some((player) => player.normalizedName === normalized)) {
        duplicates.push(name);
        continue;
      }

      const player = {
        id: makeId('player'),
        ownerUserId,
        ownerTag,
        name,
        normalizedName: normalized,
        createdAt: new Date().toISOString(),
      };
      signup.players.push(player);
      added.push(player);
    }

    signup.players.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    signup._result = { added, duplicates };
    return signup;
  });
}

function removePlayers(signupId, predicate) {
  return updateSignup(signupId, (signup) => {
    const before = signup.players;
    const removed = before.filter(predicate);
    signup.players = before.filter((player) => !predicate(player));
    signup._result = { removed };
    return signup;
  });
}

module.exports = {
  listSignups,
  getSignup,
  getSignupByMessageId,
  createSignup,
  updateSignup,
  deleteSignup,
  addPlayers,
  removePlayers,
};
