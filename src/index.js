const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  ModalBuilder,
  Partials,
  PermissionFlagsBits,
  REST,
  Routes,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const { listSignups, getSignup, createSignup, updateSignup, addPlayers, removePlayers } = require('./signups');

const fs = require('node:fs');
const path = require('node:path');

function loadDotEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function loadConfig() {
  loadDotEnv();
  const config = {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.DISCORD_CLIENT_ID,
    guildId: process.env.DISCORD_GUILD_ID,
    adminRoleId: process.env.ADMIN_ROLE_ID || '',
    defaultImageUrl: process.env.DEFAULT_IMAGE_URL || 'https://i.imgur.com/PfIm2sY.jpeg',
  };

  for (const [key, value] of Object.entries({
    DISCORD_TOKEN: config.token,
    DISCORD_CLIENT_ID: config.clientId,
    DISCORD_GUILD_ID: config.guildId,
  })) {
    if (!value) throw new Error(`Saknar miljövariabel: ${key}`);
  }
  return config;
}

const config = loadConfig();

const commands = [
  new SlashCommandBuilder().setName('ping').setDescription('Kontrollera att botten svarar.'),
  new SlashCommandBuilder().setName('show-list').setDescription('Visa aktiva spelanmälningar.'),
  new SlashCommandBuilder().setName('starta-spelanmälning').setDescription('Skapa en ny spelanmälan.'),
];

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
  partials: [Partials.Channel],
});

function isAdmin(member) {
  if (!member) return false;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  return !!(config.adminRoleId && member.roles.cache.has(config.adminRoleId));
}

function sanitizePrice(value) {
  return String(value || '').replace(/[^0-9]/g, '');
}

function escapeFieldText(value) {
  return String(value || '-').trim() || '-';
}

function buildSignupEmbed(signup) {
  const embed = new EmbedBuilder()
    .setTitle('Anmälning till airsoft spel')
    .setDescription(escapeFieldText(signup.description))
    .setColor(0xffa500)
    .setTimestamp(new Date(signup.updatedAt || signup.createdAt || Date.now()))
    .addFields(
      {
        name: 'Plats',
        value: signup.location ? (signup.locationUrl ? `[${signup.location}](${signup.locationUrl})` : signup.location) : '-',
        inline: true,
      },
      { name: 'Pris', value: signup.price ? `${signup.price} kr` : '-', inline: true },
      { name: 'Datum', value: signup.date || '-', inline: true },
      { name: 'Antal anmälda spelare', value: String(signup.players.length) }
    );

  const imageUrl = signup.imageUrl || config.defaultImageUrl;
  if (imageUrl) embed.setImage(imageUrl);
  if (signup.closed) embed.addFields({ name: 'Status', value: 'Stängd' });
  if (signup.eventUrl) embed.addFields({ name: 'Discord Event', value: `[Öppna event](${signup.eventUrl})`, inline: true });
  return embed;
}

function buildMainButtons(signupId, closed = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`view:${signupId}:1`).setLabel('Anmälda spelare').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`add:${signupId}`).setLabel('Anmäl').setStyle(ButtonStyle.Success).setDisabled(closed),
    new ButtonBuilder().setCustomId(`remove:${signupId}`).setLabel('Avanmäl').setStyle(ButtonStyle.Danger).setDisabled(closed),
    new ButtonBuilder().setCustomId(`admin:${signupId}`).setLabel('Admin').setStyle(ButtonStyle.Primary)
  );
}

function buildPlayersEmbed(signup, page = 1) {
  const perPage = 15;
  const totalPages = Math.max(1, Math.ceil(signup.players.length / perPage));
  const currentPage = Math.min(Math.max(page, 1), totalPages);
  const start = (currentPage - 1) * perPage;
  const chunk = signup.players.slice(start, start + perPage);
  const description = chunk.length ? chunk.map((player, index) => `${start + index + 1}. ${player.name}`).join('\n') : 'Inga spelare anmälda ännu.';
  return new EmbedBuilder().setTitle('Anmälda spelare').setDescription(description).setColor(0xffa500).setFooter({ text: `Sida ${currentPage} av ${totalPages}` });
}

function buildPageButtons(signupId, page, totalPlayers) {
  const perPage = 15;
  const totalPages = Math.max(1, Math.ceil(totalPlayers / perPage));
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`page:${signupId}:${page - 1}`).setLabel('Förra sidan').setStyle(ButtonStyle.Secondary).setDisabled(page <= 1),
    new ButtonBuilder().setCustomId(`page:${signupId}:${page + 1}`).setLabel('Nästa sida').setStyle(ButtonStyle.Secondary).setDisabled(page >= totalPages)
  );
}

function buildCreateModal() {
  return new ModalBuilder()
    .setCustomId('create')
    .setTitle('Initiera spelanmälning')
    .addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('date').setLabel('Spelets datum').setPlaceholder('DD/MM eller 2026-04-12').setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('price').setLabel('Pris').setPlaceholder('150').setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('location').setLabel('Plats').setPlaceholder('Exempelbanan').setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('locationUrl').setLabel('Google Maps / länk').setPlaceholder('https://...').setStyle(TextInputStyle.Short).setRequired(false)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('description').setLabel('Beskrivning').setPlaceholder('Kort info om spel, tider, regler osv').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(2000))
    );
}

function buildAddModal(signupId) {
  return new ModalBuilder()
    .setCustomId(`addmodal:${signupId}`)
    .setTitle('Anmäl spelare')
    .addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('names').setLabel('Ett namn per rad').setStyle(TextInputStyle.Paragraph).setPlaceholder('Johan\nKalle\nLisa').setRequired(true).setMaxLength(2000))
    );
}

function buildEditModal(signup) {
  return new ModalBuilder()
    .setCustomId(`editmodal:${signup.id}`)
    .setTitle('Redigera spelanmälning')
    .addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('date').setLabel('Spelets datum').setValue(signup.date || '').setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('price').setLabel('Pris').setValue(signup.price || '').setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('location').setLabel('Plats').setValue(signup.location || '').setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('locationUrl').setLabel('Google Maps / länk').setValue(signup.locationUrl || '').setStyle(TextInputStyle.Short).setRequired(false)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('description').setLabel('Beskrivning').setValue(signup.description || '').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(2000))
    );
}

function buildImageModal(signup) {
  return new ModalBuilder()
    .setCustomId(`imagemodal:${signup.id}`)
    .setTitle('Uppdatera bild / event')
    .addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('imageUrl').setLabel('Bildlänk').setValue(signup.imageUrl || '').setStyle(TextInputStyle.Short).setRequired(false)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('eventUrl').setLabel('Discord Event-länk').setValue(signup.eventUrl || '').setStyle(TextInputStyle.Short).setRequired(false))
    );
}

function buildAdminMenu(signupId) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`adminmenu:${signupId}`)
      .setPlaceholder('Administrativa verktyg')
      .addOptions(
        { label: 'Redigera spelanmälning', value: 'edit' },
        { label: 'Avanmäl spelare', value: 'remove_any' },
        { label: 'Uppdatera bild / event-länk', value: 'image' },
        { label: 'Avsluta spelanmälan', value: 'close' }
      )
  );
}

function buildRemoveMenu(signupId, players, prefix) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`${prefix}:${signupId}`)
      .setPlaceholder('Välj spelare att avanmäla')
      .setMinValues(1)
      .setMaxValues(Math.min(players.length, 25))
      .addOptions(
        players.slice(0, 25).map((player) => ({
          label: player.name.slice(0, 100),
          value: player.id,
          description: `Anmäld av ${player.ownerTag}`.slice(0, 100),
        }))
      )
  );
}

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(config.token);
  await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body: commands.map((command) => command.toJSON()) });
}

async function refreshSignupMessage(signup) {
  if (!signup?.channelId || !signup?.messageId) return;
  try {
    const channel = await client.channels.fetch(signup.channelId);
    if (!channel?.isTextBased()) return;
    const message = await channel.messages.fetch(signup.messageId);
    await message.edit({ embeds: [buildSignupEmbed(signup)], components: [buildMainButtons(signup.id, signup.closed)], allowedMentions: { parse: [] } });
  } catch (error) {
    console.error(`Kunde inte uppdatera signup-meddelande ${signup?.id}:`, error.message);
  }
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
      if (interaction.commandName === 'ping') return void await interaction.reply({ content: 'Pong!', ephemeral: true });
      if (interaction.commandName === 'show-list') {
        if (!isAdmin(interaction.member)) return adminDenied(interaction);
        const signups = listSignups(interaction.guildId);
        const embed = new EmbedBuilder()
          .setTitle('Aktiva spelanmälningar')
          .setColor(0xffa500)
          .setDescription(signups.length ? signups.map((s) => `• **${s.date}** | ${s.location} | ${s.players.length} anmälda | \`${s.id}\``).join('\n') : 'Det finns inga spelanmälningar sparade.');
        return void await interaction.reply({ embeds: [embed], ephemeral: true });
      }
      if (interaction.commandName === 'starta-spelanmälning') {
        if (!isAdmin(interaction.member)) return adminDenied(interaction);
        return void await interaction.showModal(buildCreateModal());
      }
    }

    if (interaction.isModalSubmit()) {
      if (interaction.customId === 'create') {
        if (!isAdmin(interaction.member)) return adminDenied(interaction);
        const signup = createSignup({
          guildId: interaction.guildId,
          channelId: interaction.channelId,
          date: interaction.fields.getTextInputValue('date').trim(),
          price: sanitizePrice(interaction.fields.getTextInputValue('price')),
          location: interaction.fields.getTextInputValue('location').trim(),
          locationUrl: interaction.fields.getTextInputValue('locationUrl').trim(),
          description: interaction.fields.getTextInputValue('description').trim(),
        });
        await interaction.reply({ content: 'Spelanmälningen skapas...', ephemeral: true });
        const message = await interaction.channel.send({ embeds: [buildSignupEmbed(signup)], components: [buildMainButtons(signup.id, false)] });
        const saved = updateSignup(signup.id, (current) => ({ ...current, messageId: message.id }));
        if (saved) await refreshSignupMessage(saved);
        return;
      }

      if (interaction.customId.startsWith('addmodal:')) {
        const signupId = interaction.customId.split(':')[1];
        const signup = addPlayers(signupId, interaction.user.id, interaction.user.tag, interaction.fields.getTextInputValue('names'));
        if (!signup) return void await interaction.reply({ content: 'Kunde inte hitta spelanmälningen.', ephemeral: true });
        await refreshSignupMessage(signup);
        const added = signup._result?.added || [];
        const duplicates = signup._result?.duplicates || [];
        const parts = [];
        if (added.length) parts.push(`Anmälda: ${added.map((p) => `**${p.name}**`).join(', ')}`);
        if (duplicates.length) parts.push(`Redan anmälda: ${duplicates.map((p) => `**${p}**`).join(', ')}`);
        return void await interaction.reply({ content: parts.join('\n') || 'Inget att lägga till.', ephemeral: true });
      }

      if (interaction.customId.startsWith('editmodal:')) {
        const signupId = interaction.customId.split(':')[1];
        if (!isAdmin(interaction.member)) return adminDenied(interaction);
        const signup = updateSignup(signupId, (current) => ({
          ...current,
          date: interaction.fields.getTextInputValue('date').trim(),
          price: sanitizePrice(interaction.fields.getTextInputValue('price')),
          location: interaction.fields.getTextInputValue('location').trim(),
          locationUrl: interaction.fields.getTextInputValue('locationUrl').trim(),
          description: interaction.fields.getTextInputValue('description').trim(),
        }));
        if (!signup) return void await interaction.reply({ content: 'Kunde inte hitta spelanmälningen.', ephemeral: true });
        await refreshSignupMessage(signup);
        return void await interaction.reply({ content: 'Spelanmälningen uppdaterades.', ephemeral: true });
      }

      if (interaction.customId.startsWith('imagemodal:')) {
        const signupId = interaction.customId.split(':')[1];
        if (!isAdmin(interaction.member)) return adminDenied(interaction);
        const signup = updateSignup(signupId, (current) => ({
          ...current,
          imageUrl: interaction.fields.getTextInputValue('imageUrl').trim(),
          eventUrl: interaction.fields.getTextInputValue('eventUrl').trim(),
        }));
        if (!signup) return void await interaction.reply({ content: 'Kunde inte hitta spelanmälningen.', ephemeral: true });
        await refreshSignupMessage(signup);
        return void await interaction.reply({ content: 'Bild / event-länk uppdaterad.', ephemeral: true });
      }
    }

    if (interaction.isButton()) {
      const [action, signupId, extra] = interaction.customId.split(':');
      const signup = getSignup(signupId);
      if (!signup) return void await interaction.reply({ content: 'Kunde inte hitta spelanmälningen.', ephemeral: true });

      if (action === 'add') return void await interaction.showModal(buildAddModal(signupId));
      if (action === 'view' || action === 'page') {
        const page = Number(extra || 1);
        return void await interaction.reply({ embeds: [buildPlayersEmbed(signup, page)], components: [buildPageButtons(signup.id, page, signup.players.length)], ephemeral: true });
      }
      if (action === 'remove') {
        const ownPlayers = signup.players.filter((player) => player.ownerUserId === interaction.user.id);
        if (!ownPlayers.length) return void await interaction.reply({ content: 'Du har inte anmält några spelare i detta spel.', ephemeral: true });
        return void await interaction.reply({ content: 'Välj vilka av dina spelare som ska avanmäls.', components: [buildRemoveMenu(signup.id, ownPlayers, 'removeown')], ephemeral: true });
      }
      if (action === 'admin') {
        if (!isAdmin(interaction.member)) return adminDenied(interaction);
        return void await interaction.reply({ content: `Adminverktyg för **${signup.date}** på **${signup.location}**`, components: [buildAdminMenu(signup.id)], ephemeral: true });
      }
    }

    if (interaction.isStringSelectMenu()) {
      const [action, signupId] = interaction.customId.split(':');
      const signup = getSignup(signupId);
      if (!signup) return void await interaction.reply({ content: 'Kunde inte hitta spelanmälningen.', ephemeral: true });

      if (action === 'adminmenu') {
        if (!isAdmin(interaction.member)) return adminDenied(interaction);
        const selected = interaction.values[0];
        if (selected === 'edit') return void await interaction.showModal(buildEditModal(signup));
        if (selected === 'image') return void await interaction.showModal(buildImageModal(signup));
        if (selected === 'close') {
          const updated = updateSignup(signup.id, (current) => ({ ...current, closed: true }));
          await refreshSignupMessage(updated);
          return void await interaction.reply({ content: 'Spelanmälningen är nu stängd.', ephemeral: true });
        }
        if (selected === 'remove_any') {
          if (!signup.players.length) return void await interaction.reply({ content: 'Det finns inga spelare att avanmäla.', ephemeral: true });
          return void await interaction.reply({ content: 'Välj spelare att ta bort.', components: [buildRemoveMenu(signup.id, signup.players, 'removeany')], ephemeral: true });
        }
      }

      if (action === 'removeown') {
        const selectedIds = new Set(interaction.values);
        const updated = removePlayers(signup.id, (player) => player.ownerUserId === interaction.user.id && selectedIds.has(player.id));
        await refreshSignupMessage(updated);
        const removed = updated._result?.removed || [];
        return void await interaction.update({ content: removed.length ? `Avanmälda: ${removed.map((p) => `**${p.name}**`).join(', ')}` : 'Inga spelare togs bort.', components: [] });
      }

      if (action === 'removeany') {
        if (!isAdmin(interaction.member)) return adminDenied(interaction);
        const selectedIds = new Set(interaction.values);
        const updated = removePlayers(signup.id, (player) => selectedIds.has(player.id));
        await refreshSignupMessage(updated);
        const removed = updated._result?.removed || [];
        return void await interaction.update({ content: removed.length ? `Borttagna spelare: ${removed.map((p) => `**${p.name}**`).join(', ')}` : 'Inga spelare togs bort.', components: [] });
      }
    }
  } catch (error) {
    console.error(error);
    const payload = { content: 'Något gick fel. Kontrollera bot-loggen.', ephemeral: true };
    if (interaction.deferred || interaction.replied) await interaction.followUp(payload).catch(() => {});
    else await interaction.reply(payload).catch(() => {});
  }
});

client.login(config.token);
