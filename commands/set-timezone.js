const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const moment = require("moment-timezone");
const { timezoneData } = require("../timezone-definitions");

const timezones = Object.values(timezoneData);

// Find timezone by ANY identifier
function findTimezone(value) {
  const normalized = value.trim().toLowerCase();
  return timezones.find(tz =>
    tz.offset.toLowerCase() === normalized ||
    tz.label.toLowerCase() === normalized ||
    tz.iana.toLowerCase() === normalized ||
    tz.aliases?.some(alias => alias.toLowerCase() === normalized)
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

  // ---------------------------------------------------------
  // AUTOCOMPLETE — AM/PM FILTER + SEARCH FILTER + 25 LIMIT
  // ---------------------------------------------------------
  async autocomplete(interaction) {
    const query = interaction.options.getString("timezone", true).toLowerCase();
    const period = interaction.options.getString("period"); // AM or PM

    const matches = timezones
      // 1. Filter by AM/PM first (required to avoid Discord truncation)
      .filter(tz => {
        const currentPeriod = moment().tz(tz.iana).format("A"); // AM or PM
        return currentPeriod === period;
      })
      // 2. Filter by search text
      .filter(tz => {
        const text = `${tz.offset} ${tz.label} ${tz.iana} ${(tz.aliases || []).join(" ")}`.toLowerCase();
        return query.length === 0 || text.includes(query);
      })
      // 3. Discord limit
      .slice(0, 25)
      // 4. Format display
      .map(tz => ({
        name: `${moment().tz(tz.iana).format("h:mm A")} — ${tz.offset} (${tz.label})`,
        value: tz.iana
      }));

    await interaction.respond(matches);
  },

  // ---------------------------------------------------------
  // EXECUTE — Save timezone + assign role
  // ---------------------------------------------------------
  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({
        content: "❌ This command can only be used in a server.",
        flags: MessageFlags.Ephemeral
      });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // Get timezone from autocomplete selection
    const timezone = findTimezone(interaction.options.getString("timezone", true));
    if (!timezone) {
      return interaction.editReply({
        content: "❌ Choose a timezone from the autocomplete options."
      });
    }

    const member = await interaction.guild.members.fetch(interaction.user.id);

    // Remove old timezone roles
    const timezoneRoleNames = timezones.flatMap(tz => [
      tz.offset,
      ...(tz.aliases || [])
    ]);

    for (const role of member.roles.cache.values()) {
      if (timezoneRoleNames.includes(role.name)) {
        await member.roles.remove(role);
      }
    }

    // Create role if missing
    let role = interaction.guild.roles.cache.find(r => r.name === timezone.offset);
    if (!role) {
      role = await interaction.guild.roles.create({
        name: timezone.offset,
        color: "Grey",
        reason: "Timezone role created by settimezone command"
      });
    }

    // Add new timezone role
    await member.roles.add(role);

    // Save timezone to DB
    await new Promise((resolve, reject) => {
      interaction.client.db.run(
        "INSERT OR REPLACE INTO timezones (user, tz) VALUES (?, ?)",
        [interaction.user.id, timezone.iana],
        err => (err ? reject(err) : resolve())
      );
    });

    return interaction.editReply({
      content: `✅ Your timezone is set to **${timezone.offset} — ${timezone.label}** and you now have the **${role.name}** role.`
    });
  }
};
