const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { buildTimezoneGroups, buildEmbeds } = require("../utils/timezonegraph-engine");
const fs = require("fs");
const path = require("path");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("timezonegraph-live")
    .setDescription("Post a live-updating timezone graph that refreshes every 1 minute.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!interaction.isChatInputCommand() || !interaction.token) return;

    try {
      await interaction.deferReply();
    } catch (err) {
      console.error("deferReply failed:", err);
      return;
    }

    const guild = interaction.guild;
    await guild.members.fetch();

    const tzPath = path.join(__dirname, "..", "data", "timezones.json");
    let db = {};
    if (fs.existsSync(tzPath)) {
      db = JSON.parse(fs.readFileSync(tzPath, "utf8"));
    }

    let groups, embeds;
    try {
      groups = buildTimezoneGroups(guild, db);
      embeds = buildEmbeds(guild, groups);
    } catch (err) {
      console.error("Failed to build timezone graph embeds:", err);
      return interaction.editReply({ content: "❌ Failed to build timezone graph." });
    }

    let message;
    try {
      message = await interaction.editReply({ embeds });
    } catch (err) {
      console.error("Failed to send initial timezone graph message:", err);
      return;
    }

    // Store liveGraph in memory
    interaction.client.liveGraph = {
      channelId: message.channel.id,
      messageId: message.id,
      guildId: guild.id
    };

    // Persist liveGraph to file
    const livePath = path.join(__dirname, "..", "data", "livegraph.json");
    fs.writeFileSync(livePath, JSON.stringify(interaction.client.liveGraph, null, 2));
    console.log("✅ Posted live timezone graph:", interaction.client.liveGraph);
  }
};
