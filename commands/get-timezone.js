const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require("discord.js");
const moment = require("moment-timezone");
const { timezoneData } = require("../timezone-definitions");

const timezoneByRoleName = new Map(
  Object.values(timezoneData).map(timezone => [timezone.offset, timezone])
);

module.exports = {
  data: new SlashCommandBuilder()
    .setName("gettimezone")
    .setDescription("Show the timezone of a server member.")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("The member whose timezone you want to see")
        .setRequired(true)
    ),

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({
        content: "❌ This command can only be used in a server.",
        flags: MessageFlags.Ephemeral
      });
    }

    const user = interaction.options.getUser("user", true);
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);

    if (!member) {
      return interaction.reply({
        content: "❌ That user is not a member of this server.",
        flags: MessageFlags.Ephemeral
      });
    }

    const timezone = member.roles.cache
      .map(role => timezoneByRoleName.get(role.name))
      .find(Boolean);

    if (!timezone) {
      return interaction.reply({
        content: `❌ ${user.username} has not set a timezone.`,
        flags: MessageFlags.Ephemeral
      });
    }

    const localTime = moment().tz(timezone.iana).format("h:mm A");

    const embed = new EmbedBuilder()
      .setTitle(`🕒 Timezone for ${user.username}`)
      .setDescription(`**${timezone.offset} - ${timezone.label}**\nLocal time: **${localTime}**`)
      .addFields({ name: "IANA timezone", value: timezone.iana })
      .setColor("#00AEEF");

    return interaction.reply({ embeds: [embed] });
  }
};