// commands/timezonegraph-live.js
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
    // ---------- Minimal preflight checks (no heavy awaits) ----------
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

    // ---------- Defer immediately to extend the interaction window ----------
    try {
      await interaction.deferReply();
    } catch (err) {
      if (err?.code === 10062) {
        console.log("⚠ deferReply failed: Unknown interaction (10062). Ignoring.");
        return;
      }
      if (err?.code === 40060) {
        console.log("⚠ deferReply failed: Interaction already acknowledged (40060). Ignoring.");
        return;
      }
      console.error("Unexpected error during deferReply:", err);
      return;
    }

    // ---------- Now do heavier work safely (after defer) ----------
    const guild = interaction.guild;
    try {
      // Optional: fetch members if your engine needs them (this can be slow)
      await guild.members.fetch();
    } catch (err) {
      console.warn("Failed to fetch guild members (continuing):", err);
    }

    // Load timezone DB
    const tzPath = path.join(__dirname, "..", "data", "timezones.json");
    let db = {};
    try {
      if (fs.existsSync(tzPath)) {
        db = JSON.parse(fs.readFileSync(tzPath, "utf8"));
      } else {
        db = {};
      }
    } catch (err) {
      console.error("Failed to read timezone DB, continuing with empty DB:", err);
      db = {};
    }

    // Build graph
    let groups, embeds;
    try {
      groups = buildTimezoneGroups(guild, db);
      embeds = buildEmbeds(guild, groups);
    } catch (err) {
      console.error("Failed to build timezone graph embeds:", err);
      try {
        await interaction.editReply({ content: "❌ Failed to build timezone graph.", ephemeral: true });
      } catch (editErr) {
        console.error("Failed to send failure editReply:", editErr);
      }
      return;
    }

    // Send initial message (edit the deferred reply)
    let message;
    try {
      message = await interaction.editReply({ embeds });
    } catch (err) {
      if (err?.code === 10062) {
        console.log("⚠ editReply failed: Unknown interaction (10062). Aborting.");
        return;
      }
      if (err?.code === 40060) {
        console.log("⚠ editReply failed: Interaction already acknowledged (40060). Aborting.");
        return;
      }
      console.error("Failed to send initial timezone graph message:", err);
      return;
    }

    // Store message ID + channel ID in memory for the refresh loop
    try {
      interaction.client.liveGraph = {
        channelId: message.channel.id,
        messageId: message.id,
        guildId: guild.id
      };
      console.log("✅ Posted live timezone graph:", interaction.client.liveGraph);
    } catch (err) {
      console.error("Failed to store liveGraph in memory:", err);
    }

    return;
  }
};
