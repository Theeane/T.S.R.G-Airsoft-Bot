const { REST, Routes } = require('discord.js');
const config = require('./config');
const commands = require('./commands').map((command) => command.toJSON());

(async () => {
  const rest = new REST({ version: '10' }).setToken(config.token);
  await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body: commands });
  console.log('Guild commands registrerade.');
})();
