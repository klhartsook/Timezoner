const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require("discord.js");
const moment = require("moment-timezone");
const fs = require("fs");
const path = require("path");

const tzPath = path.join(__dirname, "../data/timezones.json");

function buildTimezoneGroups(guild, db) {
  const groups = new Map();

  for (const [userId, tz] of Object.entries(db)) {
    const member = guild.members.cache.get(userId);
    if (!member) continue;

    const offset = moment().tz(tz).format("Z"); // e.g. "-07:00"
    const label = tz;

    if (!groups.has(offset)) {
      groups.set(offset, {
        offset,
        label,
        members: []
      });
    }

    groups.get(offset).members.push(member);
  }

  return [...groups.values()].sort((a, b) =>
    a.offset.localeCompare(b.offset, undefined, { numeric: true })
  );
}

function buildEmbeds(guild, groups) {
  const embeds = [];
  let current = new EmbedBuilder()
    .setTitle(`🕒 Timezone Graph for ${guild.name}`)
    .setColor("#00AEEF")
    .setDescription("Members grouped by their saved timezone.");
  let currentSize = current.data.description.length + current.data.title.length;

  for (const group of groups) {
    const memberMentions = group.members.map(m => `<@${m.id}>`);
    const memberChunks = [];
    let chunk = "";

    for (const mention of memberMentions) {
      const nextChunk = chunk ? `${chunk}, ${mention}` : mention;
      if (nextChunk.length > 1024) {
        memberChunks.push(chunk);
        chunk = mention;
      } else {
        chunk = nextChunk;
      }
    }
    if (chunk) memberChunks.push(chunk);

    for (let i = 0; i < memberChunks.length; i++) {
      const name =
        i === 0
          ? `${group.offset} — ${group.label} (${group.members.length})`
          : `${group.offset} — ${group.label} (continued)`;
      const value = memberChunks[i];
      const fieldSize = name.length + value.length;

      if (current.data.fields?.length >= 25 || currentSize + fieldSize > 5500) {
        embeds.push(current);
        current = new EmbedBuilder()
          .setTitle(`🕒 Timezone Graph for ${guild.name}`)
          .setColor("#00AEEF");
        currentSize = current.data.title.length;
      }

      current.addFields({ name, value });
      currentSize += fieldSize;
    }
  }

  if (current.data.fields?.length) embeds.push(current);
  return embeds;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("timezonegraph")
    .setDescription("Show members grouped by their saved timezone."),

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({
        content: "❌ This command can only be used in a server.",
        flags: MessageFlags.Ephemeral
      });
    }

    await interaction.deferReply();

    await interaction.guild.members.fetch();

    let db = {};
    try {
      db = JSON.parse(fs.readFileSync(tzPath, "utf8"));
    } catch {
      db = {};
    }

    const groups = buildTimezoneGroups(interaction.guild, db);

    if (!groups.length) {
      return interaction.editReply({
        content: "No members have set a timezone yet."
      });
    }

    return interaction.editReply({ embeds: buildEmbeds(interaction.guild, groups) });
  }
};
