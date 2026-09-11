const {
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  EmbedBuilder,
  MessageFlags
} = require("discord.js");
const moment = require("moment-timezone");
const { timezoneData } = require("../timezone-definitions");

function getTimezoneFromMember(member) {
  if (!member) return null;

  const roleNameToIana = {};
  for (const tz of Object.values(timezoneData)) {
    roleNameToIana[tz.offset] = tz.iana;
  }

  const timezoneRole = member.roles.cache.find(role => roleNameToIana[role.name]);
  return timezoneRole ? roleNameToIana[timezoneRole.name] : null;
}

module.exports = {
  data: new ContextMenuCommandBuilder()
    .setName("Local Time")
    .setType(ApplicationCommandType.User),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const db = interaction.client.db;
    const target = interaction.targetUser;
    const guild = interaction.guild;

    let member = null;
    if (guild) {
      member = await guild.members.fetch(target.id).catch(() => null);
    }

    let iana = getTimezoneFromMember(member);

    if (!iana) {
      const row = await new Promise((resolve, reject) => {
        db.get("SELECT tz FROM timezones WHERE user = ?", [target.id], (err, r) => {
          if (err) return reject(err);
          resolve(r);
        });
      });

      if (!row) {
        return interaction.editReply({
          content: `❌ ${target.username} has not set a timezone.`
        });
      }

      iana = row.tz;
    }

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
