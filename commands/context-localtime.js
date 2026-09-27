const {
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  EmbedBuilder,
  MessageFlags
} = require("discord.js");
const moment = require("moment-timezone");
const fs = require("fs");
const { timezoneData } = require("../timezone-definitions");

// Railway persistent timezone file
const tzPath = "/data/timezones.json";

// Ensure file exists
fs.mkdirSync("/data", { recursive: true });
if (!fs.existsSync(tzPath)) {
  fs.writeFileSync(tzPath, "{}");
}

// Convert role/alias/offset → IANA
function lookupIanaFromRoleOrAlias(name) {
  name = name.toLowerCase();

  for (const tz of Object.values(timezoneData)) {
    // Match offset (e.g., "UTC-7")
    if (tz.offset.toLowerCase() === name) return tz.iana;

    // Match aliases (e.g., "mst", "arizona", "phoenix")
    if (tz.aliases && tz.aliases.some(a => a.toLowerCase() === name)) {
      return tz.iana;
    }
  }

  return null;
}

module.exports = {
  data: new ContextMenuCommandBuilder()
    .setName("Local Time")
    .setType(ApplicationCommandType.User),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const target = interaction.targetUser;
    const guild = interaction.guild;

    // Load timezone database
    let db = {};
    try {
      db = JSON.parse(fs.readFileSync(tzPath, "utf8"));
    } catch {
      db = {};
    }

    let iana = null;

    // 1️⃣ Try role-based lookup (if you still use roles)
    let member = null;
    if (guild) {
      member = await guild.members.fetch(target.id).catch(() => null);
    }

    if (member) {
      const roleNames = member.roles.cache.map(r => r.name);
      for (const roleName of roleNames) {
        const found = lookupIanaFromRoleOrAlias(roleName);
        if (found) {
          iana = found;
          break;
        }
      }
    }

    // 2️⃣ Fallback to stored JSON timezone
    if (!iana) {
      iana = db[target.id];
    }

    if (!iana) {
      return interaction.editReply({
        content: `❌ ${target.username} has not set a timezone.`
      });
    }

    // Convert to local time
    let localTime;
    try {
      localTime = moment().tz(iana).format("h:mm A");
    } catch {
      return interaction.editReply({
        content: `❌ Invalid timezone stored for ${target.username}.`
      });
    }

    const embed = new EmbedBuilder()
      .setTitle(`🕒 Local Time for ${target.username}`)
      .setDescription(`**${localTime}** (${iana})`)
      .setColor("#00AEEF");

    return interaction.editReply({ embeds: [embed] });
  }
};
