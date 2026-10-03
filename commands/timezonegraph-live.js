const { SlashCommandBuilder, MessageFlags, PermissionFlagsBits } = require("discord.js");
const { buildTimezoneGroups, buildEmbeds } = require("../utils/timezonegraph-engine");
const fs = require("fs");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("timezonegraph-live")
    .setDescription("Post a live-updating timezone graph that refreshes every 1 minute.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {

    // ⭐ REAL GUARD — Ignore stale or invalid interactions
    if (!interaction.isChatInputCommand()) {
      console.log("⚠ Ignoring non-chat-input interaction");
      return;
    }

    if (!interaction.token) {
      console.log("⚠ Ignoring stale interaction (missing token)");
      return;
    }

    if (interaction.deferred || interaction.replied) {
      console.log("⚠ Interaction already handled, ignoring");
      return;
    }

    await interaction.deferReply();

    const guild = interaction.guild;
    await guild.members.fetch();

    // Load timezone DB
    const tzPath = "/data/timezones.json";
    let db = {};
    try {
      db = JSON.parse(fs.readFileSync(tzPath, "utf8"));
    } catch {
      db = {};
    }

    // Build graph
    const groups = buildTimezoneGroups(guild, db);
    const embeds = buildEmbeds(guild, groups);

    // Send initial message
    const message = await interaction.editReply({ embeds });

    // Store message ID + channel ID in memory
    interaction.client.liveGraph = {
      channelId: message.channel.id,
      messageId: message.id,
      guildId: guild.id
    };

    return;
  }
};
