const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require("discord.js");
const moment = require("moment-timezone");
const fs = require("fs");

// IMPORTANT: Use Railway Volume path
const tzPath = "/data/timezones.json";

// Ensure the file exists in Railway persistent storage
fs.mkdirSync("/data", { recursive: true });
if (!fs.existsSync(tzPath)) {
  fs.writeFileSync(tzPath, "{}");
}

function buildTimezoneGroups(guild, db) {
  const groups = new Map();

  for (const [userId, tz] of Object.entries(db)) {
    const member = guild.members.cache.get(userId);
    if (!member) continue;

    // Get current local time for this timezone
    const localTime = moment().tz(tz);
    const timeLabel = localTime.format("h:mm A"); // e.g. "3:12 PM"

    // Group by exact local time (hour + minute)
    if (!groups.has(timeLabel)) {
      groups.set(timeLabel, {
        timeLabel,
        members: []
      });
    }

    groups.get(timeLabel).members.push(member);
  }

  // Sort chronologically by actual time
  const ordered = [...groups.values()].sort((a, b) => {
    const aTime = moment(a.timeLabel, "h:mm A");
    const bTime = moment(b.timeLabel, "h:mm A");
    return aTime - bTime;
  });

  return ordered;
}

function buildEmbeds(guild, groups) {
  const embeds = [];
  let current = new EmbedBuilder()
    .setTitle(`🕒 Local Time Graph for ${guild.name}`)
    .setColor("#00AEEF")
    .setDescription("Members grouped by their exact current local time.");
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
          ? `${group.timeLabel} (${group.members.length})`
          : `${group.timeLabel} (continued)`;
      const value = memberChunks[i];
      const fieldSize = name.length + value.length;

      if (current.data.fields?.length >= 25 || currentSize + fieldSize > 5500) {
        embeds.push(current);
        current = new EmbedBuilder()
          .setTitle(`🕒 Local Time Graph for ${guild.name}`)
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
    .setDescription("Show members grouped by their exact current local time."),

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
