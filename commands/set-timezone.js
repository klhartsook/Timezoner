// commands/settimezone.js
const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const moment = require("moment-timezone");
const { timezoneData } = require("../timezone-definitions");

// Find timezone by IANA name
function findTimezone(value) {
  const normalized = value.trim().toLowerCase();
  return timezoneData.find(tz =>
    tz.iana.toLowerCase() === normalized ||
    tz.label.toLowerCase() === normalized
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("settimezone")
    .setDescription("Set your timezone and receive the matching role.")
    .addStringOption(option =>
      option
        .setName("period")
        .setDescription("Filter timezones by AM or PM")
        .setRequired(true)
        .addChoices(
          { name: "AM", value: "AM" },
          { name: "PM", value: "PM" }
        )
    )
    .addStringOption(option =>
      option
        .setName("timezone")
        .setDescription("Choose a timezone")
        .setRequired(true)
        .setAutocomplete(true)
    ),

  async autocomplete(interaction) {
    const query = interaction.options.getString("timezone", true).toLowerCase();
    const period = interaction.options.getString("period");

    const matches = timezoneData
      // Filter by AM/PM
      .filter(tz => moment().tz(tz.iana).format("A") === period)
      // Filter by search text
      .filter(tz => tz.iana.toLowerCase().includes(query))
      // Discord limit
      .slice(0, 25)
      // Format display
      .map(tz => ({
        name: `${moment().tz(tz.iana).format("h:mm A")} — ${tz.offset} (${tz.label})`,
        value: tz.iana
      }));

    await interaction.respond(matches);
  },

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const timezone = findTimezone(interaction.options.getString("timezone", true));
    if (!timezone) {
      return interaction.editReply("❌ Invalid timezone.");
    }

    const member = await interaction.guild.members.fetch(interaction.user.id);

    // Remove old timezone roles
    const oldRoles = member.roles.cache.filter(r => r.name.startsWith("UTC"));
    for (const role of oldRoles.values()) {
      await member.roles.remove(role);
    }

    // Create role if missing
    let role = interaction.guild.roles.cache.find(r => r.name === timezone.offset);
    if (!role) {
      role = await interaction.guild.roles.create({
        name: timezone.offset,
        color: "Grey"
      });
    }

    await member.roles.add(role);

    // Save timezone to DB
    await new Promise((resolve, reject) => {
      interaction.client.db.run(
        "INSERT OR REPLACE INTO timezones (user, tz) VALUES (?, ?)",
        [interaction.user.id, timezone.iana],
        err => (err ? reject(err) : resolve())
      );
    });

    return interaction.editReply(
      `✅ Your timezone is set to **${timezone.label} (${timezone.offset})**`
    );
  }
};
