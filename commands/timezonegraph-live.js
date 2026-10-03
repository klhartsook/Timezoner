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

    // ---------- Robust preflight checks ----------
    // Only handle chat input (slash) commands here
    if (!interaction.isChatInputCommand()) {
      console.log("⚠ Ignoring non-chat-input interaction");
      return;
    }

    // If token is missing or falsy, the interaction is stale/invalid
    if (!interaction.token) {
      console.log("⚠ Ignoring stale interaction (missing token)");
      return;
    }

    // If already deferred or replied, nothing to do
    if (interaction.deferred || interaction.replied) {
      console.log("⚠ Interaction already handled, ignoring");
      return;
    }

    // ---------- Defensive defer with explicit error handling ----------
    try {
      await interaction.deferReply();
    } catch (err) {
      // Known Discord API failure: Unknown interaction
      if (err && err.code === 10062) {
        console.log("⚠ deferReply failed: Unknown interaction (10062). Ignoring.");
        return;
      }

      // Known Discord API failure: Interaction already acknowledged
      if (err && err.code === 40060) {
        console.log("⚠ deferReply failed: Interaction already acknowledged (40060). Ignoring.");
        return;
      }

      // Unexpected error — log and attempt a safe ephemeral reply if possible
      console.error("Unexpected error during deferReply:", err);
      try {
        if (!interaction.replied && !interaction.deferred && interaction.token) {
          await interaction.reply({ content: "❌ There was an error executing this command.", ephemeral: true });
        }
      } catch (replyErr) {
        console.error("Failed to send error reply after deferReply failure:", replyErr);
      }
      return;
    }

    // ---------- Command main logic ----------
    const guild = interaction.guild;
    try {
      await guild.members.fetch();
    } catch (err) {
      console.warn("Failed to fetch guild members (continuing):", err);
    }

    // Load timezone DB (use a robust relative path)
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

    // Build graph (keep original engine usage)
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

    // Send initial message
    let message;
    try {
      message = await interaction.editReply({ embeds });
    } catch (err) {
      // If editing the deferred reply fails because the interaction became invalid,
      // handle known error codes gracefully and stop.
      if (err && err.code === 10062) {
        console.log("⚠ editReply failed: Unknown interaction (10062). Aborting.");
        return;
      }
      if (err && err.code === 40060) {
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
