const fs = require('node:fs');
const path = require('node:path');

const dataPath = path.join(__dirname, '..', 'data', 'signups.json');

function ensureStore() {
  if (!fs.existsSync(dataPath)) {
    fs.mkdirSync(path.dirname(dataPath), { recursive: true });
    fs.writeFileSync(dataPath, JSON.stringify({ signups: [] }, null, 2));
  }
}

function readStore() {
  ensureStore();
  return JSON.parse(fs.readFileSync(dataPath, 'utf8'));
}

function writeStore(data) {
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
}

function makeId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeName(name) {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function listSignups(guildId) {
  return readStore().signups.filter((s) => s.guildId === guildId);
}

function getSignup(signupId) {
  return readStore().signups.find((s) => s.id === signupId) || null;
}

function createSignup(data) {
  const store = readStore();
  const signup = {
    id: makeId('signup'),
    guildId: data.guildId,
    channelId: data.channelId,
    messageId: data.messageId || '',
    date: data.date,
    price: data.price,
    location: data.location,
    locationUrl: data.locationUrl || '',
    description: data.description,
    imageUrl: data.imageUrl || '',
    eventUrl: data.eventUrl || '',
    closed: false,
    players: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  store.signups.push(signup);
  writeStore(store);
  return signup;
}

function updateSignup(signupId, updater) {
  const store = readStore();
  const index = store.signups.findIndex((s) => s.id === signupId);
  if (index === -1) return null;
  const next = updater(structuredClone(store.signups[index]));
  if (!next) return null;
  next.updatedAt = new Date().toISOString();
  store.signups[index] = next;
  writeStore(store);
  return next;
}

function addPlayers(signupId, ownerUserId, ownerTag, rawNames) {
  return updateSignup(signupId, (signup) => {
    const lines = rawNames.split(/\r?\n/).map((v) => v.trim()).filter(Boolean);
    const added = [];
    const duplicates = [];

    for (const name of lines) {
      const normalizedName = normalizeName(name);
      if (signup.players.some((p) => p.normalizedName === normalizedName)) {
        duplicates.push(name);
        continue;
      }
      const player = {
        id: makeId('player'),
        ownerUserId,
        ownerTag,
        name,
        normalizedName,
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
    const removed = signup.players.filter(predicate);
    signup.players = signup.players.filter((player) => !predicate(player));
    signup._result = { removed };
    return signup;
  });
}

module.exports = { listSignups, getSignup, createSignup, updateSignup, addPlayers, removePlayers };
