const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { timezoneData } = require("../timezone-definitions");

const timezones = Object.values(timezoneData);

function findTimezone(value) {
  const normalized = value.trim().toLowerCase();
  return timezones.find(tz =>
    tz.offset.toLowerCase() === normalized ||
    tz.label.toLowerCase() === normalized ||
    tz.iana.toLowerCase() === normalized
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("settimezone")
    .setDescription("Set your timezone and receive the matching role.")
    .addStringOption(option =>
      option
        .setName("timezone")
        .setDescription("Choose a timezone")
        .setRequired(true)
        .setAutocomplete(true)
    ),

  async autocomplete(interaction) {
    const query = interaction.options.getString("timezone", true).toLowerCase();
    const matches = timezones
      .filter(tz =>
        `${tz.offset} ${tz.label} ${tz.iana}`.toLowerCase().includes(query)
      )
      .slice(0, 25)
      .map(tz => ({
        name: `${tz.offset} - ${tz.label}`,
        value: tz.offset
      }));

    await interaction.respond(matches);
  },

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({
        content: "❌ This command can only be used in a server.",
        flags: MessageFlags.Ephemeral
      });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const timezone = findTimezone(interaction.options.getString("timezone", true));
    if (!timezone) {
      return interaction.editReply({
        content: "❌ Choose a timezone from the autocomplete options."
      });
    }

    const member = await interaction.guild.members.fetch(interaction.user.id);
    const timezoneRoleNames = timezones.map(tz => tz.offset);

    for (const role of member.roles.cache.values()) {
      if (timezoneRoleNames.includes(role.name)) {
        await member.roles.remove(role);
      }
    }

    let role = interaction.guild.roles.cache.find(r => r.name === timezone.offset);
    if (!role) {
      role = await interaction.guild.roles.create({
        name: timezone.offset,
        color: "Grey",
        reason: "Timezone role created by settimezone command"
      });
    }

    await member.roles.add(role);

    await new Promise((resolve, reject) => {
      interaction.client.db.run(
        "INSERT OR REPLACE INTO timezones (user, tz) VALUES (?, ?)",
        [interaction.user.id, timezone.iana],
        err => (err ? reject(err) : resolve())
      );
    });

    return interaction.editReply({
      content: `✅ Your timezone is set to **${timezone.offset} - ${timezone.label}** and you now have the **${role.name}** role.`
    });
  }
};