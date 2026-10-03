const { SlashCommandBuilder, MessageFlags, PermissionFlagsBits } = require("discord.js");
const { buildTimezoneGroups, buildEmbeds } = require("../utils/timezonegraph-engine");
const fs = require("fs");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("timezonegraph-live")
    .setDescription("Post a live-updating timezone graph that refreshes every 5 minutes.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator), // ⭐ ADMIN ONLY

  async execute(interaction) {
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
