const {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  PermissionFlagsBits,
  EmbedBuilder,
} = require('discord.js');
const config = require('./config');
const commands = require('./commands');
const { isAdmin } = require('./utils/permissions');
const {
  createSignup,
  getSignup,
  updateSignup,
  deleteSignup,
  addPlayers,
  removePlayers,
  listSignups,
} = require('./storage/signups');
const {
  buildSignupEmbed,
  buildMainButtons,
  buildPlayersEmbed,
  buildPlayerPageButtons,
  buildAddModal,
  buildCreateModal,
  buildEditModal,
  buildImageModal,
  buildAdminMenu,
  buildRemoveMenu,
} = require('./utils/embed');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel],
});

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(config.token);
  await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), {
    body: commands.map((command) => command.toJSON()),
  });
}

async function refreshSignupMessage(signup) {
  if (!signup?.channelId || !signup?.messageId) return;
  try {
    const channel = await client.channels.fetch(signup.channelId);
    if (!channel?.isTextBased()) return;
    const message = await channel.messages.fetch(signup.messageId);
    await message.edit({
      embeds: [buildSignupEmbed(signup, client)],
      components: [buildMainButtons(signup.id, signup.closed)],
      allowedMentions: { parse: [] },
    });
  } catch (error) {
    console.error(`Kunde inte uppdatera signup-meddelande ${signup?.id}:`, error.message);
  }
}

function sanitizePrice(value) {
  return String(value || '').replace(/[^0-9]/g, '');
}

function adminDenied(interaction) {
  return interaction.reply({ content: 'Du har inte tillgång till denna funktion.', ephemeral: true });
}

client.once('ready', async () => {
  await registerCommands();
  console.log(`Inloggad som ${client.user.tag}`);
  client.user.setActivity('/starta-spelanmälning');
});

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'ping') {
        await interaction.reply({ content: 'Pong!', ephemeral: true });
        return;
      }

      if (interaction.commandName === 'show-list') {
        if (!isAdmin(interaction.member)) return adminDenied(interaction);
        const signups = listSignups(interaction.guildId);
        const embed = new EmbedBuilder()
          .setTitle('Aktiva spelanmälningar')
          .setColor(0xffa500)
          .setDescription(
            signups.length
              ? signups
                  .map((signup) => `• **${signup.date}** | ${signup.location} | ${signup.players.length} anmälda | \`${signup.id}\``)
                  .join('\n')
              : 'Det finns inga spelanmälningar sparade.'
          );
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      if (interaction.commandName === 'starta-spelanmälning') {
        if (!isAdmin(interaction.member)) return adminDenied(interaction);
        await interaction.showModal(buildCreateModal());
        return;
      }
    }

    if (interaction.isModalSubmit()) {
      if (interaction.customId === 'signup:create') {
        if (!isAdmin(interaction.member)) return adminDenied(interaction);

        const date = interaction.fields.getTextInputValue('date').trim();
        const price = sanitizePrice(interaction.fields.getTextInputValue('price'));
        const location = interaction.fields.getTextInputValue('location').trim();
        const locationUrl = interaction.fields.getTextInputValue('locationUrl').trim();
        const description = interaction.fields.getTextInputValue('description').trim();

        const signup = createSignup({
          guildId: interaction.guildId,
          channelId: interaction.channelId,
          date,
          price,
          location,
          locationUrl,
          description,
        });

        const message = await interaction.reply({
          content: '@everyone',
          allowedMentions: { parse: ['everyone'] },
          embeds: [buildSignupEmbed(signup, client)],
          components: [buildMainButtons(signup.id, false)],
          fetchReply: true,
        });

        const updated = updateSignup(signup.id, { messageId: message.id });
        await refreshSignupMessage(updated);
        return;
      }

      if (interaction.customId.startsWith('signup:addmodal:')) {
        const signupId = interaction.customId.split(':')[2];
        const signup = getSignup(signupId);
        if (!signup || signup.closed) {
          await interaction.reply({ content: 'Den här spelanmälan är inte längre aktiv.', ephemeral: true });
          return;
        }

        const result = addPlayers(
          signupId,
          interaction.user.id,
          interaction.user.tag,
          interaction.fields.getTextInputValue('names')
        );
        const added = result?._result?.added ?? [];
        const duplicates = result?._result?.duplicates ?? [];
        delete result._result;
        await refreshSignupMessage(result);

        let reply = added.length
          ? `Anmält: ${added.map((player) => player.name).join(', ')}`
          : 'Inga nya namn lades till.';
        if (duplicates.length) reply += `\nRedan anmälda: ${duplicates.join(', ')}`;
        await interaction.reply({ content: reply, ephemeral: true });
        return;
      }

      if (interaction.customId.startsWith('signup:editmodal:')) {
        const signupId = interaction.customId.split(':')[2];
        const signup = getSignup(signupId);
        if (!signup) return interaction.reply({ content: 'Spelanmälan hittades inte.', ephemeral: true });
        if (!isAdmin(interaction.member)) return adminDenied(interaction);

        const updated = updateSignup(signupId, {
          date: interaction.fields.getTextInputValue('date').trim(),
          price: sanitizePrice(interaction.fields.getTextInputValue('price')),
          location: interaction.fields.getTextInputValue('location').trim(),
          locationUrl: interaction.fields.getTextInputValue('locationUrl').trim(),
          description: interaction.fields.getTextInputValue('description').trim(),
        });
        await refreshSignupMessage(updated);
        await interaction.reply({ content: 'Spelanmälning uppdaterad.', ephemeral: true });
        return;
      }

      if (interaction.customId.startsWith('signup:imagemodal:')) {
        const signupId = interaction.customId.split(':')[2];
        if (!isAdmin(interaction.member)) return adminDenied(interaction);
        const updated = updateSignup(signupId, {
          imageUrl: interaction.fields.getTextInputValue('imageUrl').trim(),
          eventUrl: interaction.fields.getTextInputValue('eventUrl').trim(),
        });
        await refreshSignupMessage(updated);
        await interaction.reply({ content: 'Bild / event-länk uppdaterad.', ephemeral: true });
        return;
      }
    }

    if (interaction.isButton()) {
      const [scope, action, signupId, page] = interaction.customId.split(':');
      if (scope !== 'signup') return;

      const signup = getSignup(signupId);
      if (!signup) {
        await interaction.reply({ content: 'Spelanmälan hittades inte.', ephemeral: true });
        return;
      }

      if (action === 'add') {
        if (signup.closed) {
          await interaction.reply({ content: 'Spelanmälan är stängd.', ephemeral: true });
          return;
        }
        await interaction.showModal(buildAddModal(signupId));
        return;
      }

      if (action === 'remove') {
        const ownPlayers = signup.players.filter((player) => player.ownerUserId === interaction.user.id);
        if (!ownPlayers.length) {
          await interaction.reply({ content: 'Du har inga egna namn att avanmäla här.', ephemeral: true });
          return;
        }
        await interaction.reply({
          content: 'Välj vilka namn du vill avanmäla.',
          components: [buildRemoveMenu(signupId, ownPlayers)],
          ephemeral: true,
        });
        return;
      }

      if (action === 'view') {
        const requestedPage = Number(page || '1');
        await interaction.reply({
          embeds: [buildPlayersEmbed(signup, requestedPage)],
          components: [buildPlayerPageButtons(signup.id, requestedPage, signup.players.length)],
          ephemeral: true,
        });
        return;
      }

      if (action === 'page') {
        const requestedPage = Number(page || '1');
        await interaction.update({
          embeds: [buildPlayersEmbed(signup, requestedPage)],
          components: [buildPlayerPageButtons(signup.id, requestedPage, signup.players.length)],
        });
        return;
      }

      if (action === 'admin') {
        if (!isAdmin(interaction.member)) return adminDenied(interaction);
        await interaction.reply({
          content: 'Välj administrativt verktyg.',
          components: [buildAdminMenu(signupId)],
          ephemeral: true,
        });
        return;
      }
    }

    if (interaction.isStringSelectMenu()) {
      const [scope, action, signupId] = interaction.customId.split(':');
      if (scope !== 'signup') return;

      const signup = getSignup(signupId);
      if (!signup) {
        await interaction.reply({ content: 'Spelanmälan hittades inte.', ephemeral: true });
        return;
      }

      if (action === 'removeselect') {
        const selectedIds = new Set(interaction.values);
        const updated = removePlayers(signupId, (player) => selectedIds.has(player.id) && player.ownerUserId === interaction.user.id);
        const removed = updated?._result?.removed ?? [];
        delete updated._result;
        await refreshSignupMessage(updated);
        await interaction.update({ content: removed.length ? `Avanmält: ${removed.map((player) => player.name).join(', ')}` : 'Inga namn togs bort.', components: [] });
        return;
      }

      if (action === 'adminmenu') {
        if (!isAdmin(interaction.member)) return adminDenied(interaction);
        const choice = interaction.values[0];

        if (choice === 'edit') {
          await interaction.showModal(buildEditModal(signup));
          return;
        }

        if (choice === 'image') {
          await interaction.showModal(buildImageModal(signup));
          return;
        }

        if (choice === 'close') {
          const updated = updateSignup(signupId, { closed: true });
          await refreshSignupMessage(updated);
          await interaction.update({ content: 'Spelanmälan är nu stängd.', components: [] });
          return;
        }

        if (choice === 'remove_any') {
          if (!signup.players.length) {
            await interaction.update({ content: 'Det finns inga spelare att avanmäla.', components: [] });
            return;
          }
          await interaction.update({
            content: 'Välj spelare att avanmäla manuellt.',
            components: [buildRemoveMenu(signupId, signup.players, 'signup:adminremoveselect')],
          });
          return;
        }
      }

      if (action === 'adminremoveselect') {
        if (!isAdmin(interaction.member)) return adminDenied(interaction);
        const selectedIds = new Set(interaction.values);
        const updated = removePlayers(signupId, (player) => selectedIds.has(player.id));
        const removed = updated?._result?.removed ?? [];
        delete updated._result;
        await refreshSignupMessage(updated);
        await interaction.update({ content: removed.length ? `Admin avanmälde: ${removed.map((player) => player.name).join(', ')}` : 'Inga namn togs bort.', components: [] });
        return;
      }
    }
  } catch (error) {
    console.error(error);
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content: 'Någonting gick fel.', ephemeral: true }).catch(() => null);
    } else {
      await interaction.reply({ content: 'Någonting gick fel.', ephemeral: true }).catch(() => null);
    }
  }
});

client.on('messageDelete', async (message) => {
  if (!message.guildId) return;
  const signup = listSignups(message.guildId).find((item) => item.messageId === message.id);
  if (!signup) return;
  deleteSignup(signup.id);
  console.log(`Raderade signup-data för borttaget meddelande: ${signup.id}`);
});

client.login(config.token);
