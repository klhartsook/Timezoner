const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require("discord.js");
const moment = require("moment-timezone");
const { timezoneEmojis, timezoneData, timezoneSections } = require("../timezone-definitions");

// Helper: get local time using moment-timezone
function getTimeInZone(iana) {
  try {
    return moment().tz(iana).format("h:mm A");
  } catch {
    return "Invalid TZ";
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setup-timezone-message")
    .setDescription("Creates the timezone reaction message for your server.")
    .addChannelOption(option =>
      option
        .setName("target")
        .setDescription("Channel where the timezone panel should be posted")
        .setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const db = interaction.client.db;
    const targetChannel = interaction.options.getChannel("target");

    if (!targetChannel.isTextBased()) {
      return interaction.editReply({
        content: "❌ The selected channel must be a text channel."
      });
    }

    // Permission check
    const botMember = interaction.guild.members.me;
    const perms = targetChannel.permissionsFor(botMember);

    const missing = [];
    if (!perms.has(PermissionFlagsBits.ViewChannel)) missing.push("View Channel");
    if (!perms.has(PermissionFlagsBits.SendMessages)) missing.push("Send Messages");
    if (!perms.has(PermissionFlagsBits.AddReactions)) missing.push("Add Reactions");
    if (!perms.has(PermissionFlagsBits.ManageMessages)) missing.push("Manage Messages");
    if (!perms.has(PermissionFlagsBits.ManageRoles)) missing.push("Manage Roles");

    if (missing.length > 0) {
      return interaction.editReply({
        content:
          `❌ **Missing Required Permissions in <#${targetChannel.id}>**\n\n` +
          missing.map(p => `• ${p}`).join("\n") +
          "\n\nFix permissions and run the command again."
      });
    }

    // Check allowed users
    try {
      const rows = await new Promise((resolve, reject) => {
        db.all("SELECT role_id FROM allowed_roles", (err, r) => {
          if (err) return reject(err);
          resolve(r || []);
        });
      });

      const allowedRoleIds = rows
        .filter(r => !r.role_id.startsWith("user:"))
        .map(r => r.role_id);

      const allowedUserIds = rows
        .filter(r => r.role_id.startsWith("user:"))
        .map(r => r.role_id.replace("user:", ""));

      const member = interaction.member;
      const userIsAllowed =
        allowedUserIds.includes(member.id) ||
        member.roles.cache.some(role => allowedRoleIds.includes(role.id));

      if (!userIsAllowed) {
        return interaction.editReply({
          content:
            "❌ You are not allowed to run this command.\nUse `/timezoneadmin` to manage permissions."
        });
      }
    } catch (err) {
      console.error("DB error:", err);
      return interaction.editReply({
        content: "❌ Database error while checking permissions."
      });
    }

    // ⭐ Automatically create timezone roles
    for (const emoji of Object.keys(timezoneData)) {
      const tz = timezoneData[emoji];
      if (!tz) continue;

      const roleName = tz.offset;

      let role = interaction.guild.roles.cache.find(r => r.name === roleName);

      if (!role) {
        try {
          role = await interaction.guild.roles.create({
            name: roleName,
            color: "Grey",
            reason: "Timezone role created automatically"
          });
        } catch (err) {
          console.error(`Failed to create role ${roleName}:`, err);
        }
      }
    }

    // ⭐ Build panels — FIXED SPLITTING LOGIC
    const panels = [];
    let currentPanel = [];
    let emojiCount = 0;

    for (const sectionName of Object.keys(timezoneSections)) {
      const sectionEmojis = timezoneSections[sectionName];

      let sectionBlock = { sectionName, emojis: [] };

      for (const emoji of sectionEmojis) {
        if (emojiCount >= 20) {
          panels.push(currentPanel);
          currentPanel = [];
          emojiCount = 0;
        }

        sectionBlock.emojis.push(emoji);
        emojiCount++;
      }

      currentPanel.push(sectionBlock);
    }

    if (currentPanel.length > 0) {
      panels.push(currentPanel);
    }

    function buildMessageText(panel) {
      let messageText = `
🕒 **Choose Your Timezone**
React below to select your timezone.
Current local times are shown for each option.
You may only choose **one** — reacting with a new timezone will automatically remove your old one.
`;

      for (const section of panel) {
        messageText += `\n**${section.sectionName}**\n`;

        for (const emoji of section.emojis) {
          const tz = timezoneData[emoji];
          if (!tz) continue;

          const localTime = getTimeInZone(tz.iana);
          messageText += `${emoji} — ${tz.offset} — ${tz.label} — **${localTime}**\n`;
        }
      }

      return messageText;
    }

    const panelMessages = [];

    // Clear old panel records
    try {
      const oldPanelRows = await new Promise((resolve, reject) => {
        db.all("SELECT id, channel FROM timezone_message", (e, rows) => (e ? reject(e) : resolve(rows || [])));
      });

      for (const row of oldPanelRows) {
        try {
          const oldChannel = await interaction.guild.channels.fetch(row.channel).catch(() => null);
          if (!oldChannel || !oldChannel.isTextBased?.()) continue;
          const oldMsg = await oldChannel.messages.fetch(row.id).catch(() => null);
          if (oldMsg) await oldMsg.delete().catch(() => {});
        } catch {}
      }

      await new Promise((resolve, reject) => {
        db.run("DELETE FROM timezone_message", (e) => (e ? reject(e) : resolve()));
      });
    } catch (err) {
      console.warn("Could not clear previous timezone panel records:", err);
    }

    // Send panels
    for (const panel of panels) {
      const messageText = buildMessageText(panel);
      let panelMsg;

      try {
        panelMsg = await targetChannel.send({ content: messageText });
      } catch (err) {
        console.error("Failed to send timezone panel message:", err);
        return interaction.editReply({
          content: `❌ Failed to post the timezone panel in <#${targetChannel.id}>.`
        });
      }

      // React with emojis
      for (const section of panel) {
        for (const emoji of section.emojis) {
          try {
            await panelMsg.react(emoji);
          } catch (err) {
            console.error(`Failed to react with ${emoji}:`, err);
          }
        }
      }

      panelMessages.push(panelMsg);
    }

    // Save panel messages
    for (const panelMsg of panelMessages) {
      await new Promise(resolve => {
        db.run(
          "INSERT INTO timezone_message (id, channel) VALUES (?, ?)",
          [panelMsg.id, targetChannel.id],
          () => resolve()
        );
      });
    }

    return interaction.editReply({
      content: `✅ Timezone message created in <#${targetChannel.id}>.\nMembers can react to set their timezone.`
    });
  }
};
