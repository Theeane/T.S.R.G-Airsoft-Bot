const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const config = require('../config');

function buildSignupEmbed(signup, client) {
  const embed = new EmbedBuilder()
    .setTitle('Anmälning till airsoft spel')
    .setDescription(signup.description || '-')
    .setColor(0xffa500)
    .setTimestamp(new Date(signup.updatedAt || signup.createdAt || Date.now()))
    .setFooter({
      text: `${client.user.username} | id: ${signup.id}`,
      iconURL: client.user.displayAvatarURL(),
    })
    .addFields(
      {
        name: 'Plats',
        value: signup.location ? (signup.locationUrl ? `[${signup.location}](${signup.locationUrl})` : signup.location) : '-',
        inline: true,
      },
      {
        name: 'Pris',
        value: signup.price ? `${signup.price} kr` : '-',
        inline: true,
      },
      {
        name: 'Datum',
        value: signup.date || '-',
        inline: true,
      },
      {
        name: 'Antal anmälda spelare',
        value: String(signup.players.length),
      }
    );

  const imageUrl = signup.imageUrl || config.defaultImageUrl;
  if (imageUrl) embed.setImage(imageUrl);
  if (signup.closed) {
    embed.addFields({ name: 'Status', value: 'Stängd' });
  }
  if (signup.eventUrl) {
    embed.addFields({ name: 'Discord Event', value: `[Öppna event](${signup.eventUrl})`, inline: true });
  }
  return embed;
}

function buildMainButtons(signupId, closed = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`signup:view:${signupId}:1`)
      .setLabel('Anmälda spelare')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`signup:add:${signupId}`)
      .setLabel('Anmäl')
      .setStyle(ButtonStyle.Success)
      .setDisabled(closed),
    new ButtonBuilder()
      .setCustomId(`signup:remove:${signupId}`)
      .setLabel('Avanmäl')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(closed),
    new ButtonBuilder()
      .setCustomId(`signup:admin:${signupId}`)
      .setLabel('Admin')
      .setStyle(ButtonStyle.Primary)
  );
}

function buildPlayersEmbed(signup, page = 1) {
  const perPage = 15;
  const totalPages = Math.max(1, Math.ceil(signup.players.length / perPage));
  const currentPage = Math.min(Math.max(page, 1), totalPages);
  const start = (currentPage - 1) * perPage;
  const chunk = signup.players.slice(start, start + perPage);
  const description = chunk.length
    ? chunk.map((player, index) => `${start + index + 1}. ${player.name}`).join('\n')
    : 'Inga spelare anmälda ännu.';

  return new EmbedBuilder()
    .setTitle('Anmälda spelare')
    .setDescription(description)
    .setColor(0xffa500)
    .setFooter({ text: `Sida ${currentPage} av ${totalPages}` })
    .setTimestamp(new Date());
}

function buildPlayerPageButtons(signupId, page, totalPlayers) {
  const perPage = 15;
  const totalPages = Math.max(1, Math.ceil(totalPlayers / perPage));
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`signup:page:${signupId}:${page - 1}`)
      .setLabel('Förra sidan')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page <= 1),
    new ButtonBuilder()
      .setCustomId(`signup:page:${signupId}:${page + 1}`)
      .setLabel('Nästa sida')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages)
  );
}

function buildAddModal(signupId) {
  const modal = new ModalBuilder().setCustomId(`signup:addmodal:${signupId}`).setTitle('Anmäl spelare');
  const input = new TextInputBuilder()
    .setCustomId('names')
    .setLabel('Ett namn per rad')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Johan\nKalle\nLisa')
    .setRequired(true)
    .setMaxLength(2000);
  modal.addComponents(new ActionRowBuilder().addComponents(input));
  return modal;
}

function buildCreateModal() {
  const modal = new ModalBuilder().setCustomId('signup:create').setTitle('Initiera spelanmälning');
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('date').setLabel('Spelets datum').setPlaceholder('DD/MM eller 2026-04-12').setStyle(TextInputStyle.Short).setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('price').setLabel('Pris').setPlaceholder('150').setStyle(TextInputStyle.Short).setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('location').setLabel('Plats').setPlaceholder('Exempelbanan').setStyle(TextInputStyle.Short).setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('locationUrl').setLabel('Google Maps / länk').setPlaceholder('https://...').setStyle(TextInputStyle.Short).setRequired(false)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('description').setLabel('Beskrivning').setPlaceholder('Kort info om spel, tider, regler osv').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(2000)
    )
  );
  return modal;
}

function buildEditModal(signup) {
  const modal = new ModalBuilder().setCustomId(`signup:editmodal:${signup.id}`).setTitle('Redigera spelanmälning');
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('date').setLabel('Spelets datum').setValue(signup.date || '').setStyle(TextInputStyle.Short).setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('price').setLabel('Pris').setValue(signup.price || '').setStyle(TextInputStyle.Short).setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('location').setLabel('Plats').setValue(signup.location || '').setStyle(TextInputStyle.Short).setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('locationUrl').setLabel('Google Maps / länk').setValue(signup.locationUrl || '').setStyle(TextInputStyle.Short).setRequired(false)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('description').setLabel('Beskrivning').setValue(signup.description || '').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(2000)
    )
  );
  return modal;
}

function buildImageModal(signup) {
  const modal = new ModalBuilder().setCustomId(`signup:imagemodal:${signup.id}`).setTitle('Uppdatera bild / event');
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('imageUrl').setLabel('Bildlänk').setValue(signup.imageUrl || '').setStyle(TextInputStyle.Short).setRequired(false)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('eventUrl').setLabel('Discord Event-länk').setValue(signup.eventUrl || '').setStyle(TextInputStyle.Short).setRequired(false)
    )
  );
  return modal;
}

function buildAdminMenu(signupId) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`signup:adminmenu:${signupId}`)
      .setPlaceholder('Administrativa verktyg')
      .addOptions(
        { label: 'Redigera spelanmälning', value: 'edit' },
        { label: 'Avanmäl spelare', value: 'remove_any' },
        { label: 'Uppdatera bild / event-länk', value: 'image' },
        { label: 'Avsluta spelanmälan', value: 'close' }
      )
  );
}

function buildRemoveMenu(signupId, players, customPrefix = 'signup:removeselect') {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`${customPrefix}:${signupId}`)
      .setPlaceholder('Välj spelare att avanmäla')
      .setMinValues(1)
      .setMaxValues(Math.min(players.length, 25))
      .addOptions(players.slice(0, 25).map((player) => ({
        label: player.name.slice(0, 100),
        value: player.id,
        description: `Anmäld av ${player.ownerTag}`.slice(0, 100),
      })))
  );
}

module.exports = {
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
};
