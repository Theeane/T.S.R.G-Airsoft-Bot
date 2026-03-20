const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('starta-spelanmälning')
    .setDescription('Initiera en ny spelanmälning.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder()
    .setName('show-list')
    .setDescription('Visa aktiva spelanmälningar i servern.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Kontrollera att botten svarar.'),
];

module.exports = commands;
