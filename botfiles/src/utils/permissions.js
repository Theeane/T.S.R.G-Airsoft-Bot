const { PermissionFlagsBits } = require('discord.js');
const config = require('../config');

function isAdmin(member) {
  if (!member) return false;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  if (config.adminRoleId && member.roles.cache.has(config.adminRoleId)) return true;
  return false;
}

module.exports = { isAdmin };
