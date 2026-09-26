// commands/set-timezone.js
const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const moment = require("moment-timezone");
const { regions } = require("../timezone-regions");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("set-timezone")
    .setDescription("Set your timezone and receive the matching role.")
    .addStringOption(option =>
      option
        .setName("region")
        .setDescription("Choose a region")
        .setRequired(true)
        .addChoices(
          ...Object.keys(regions).map(r => ({ name: r, value: r }))
        )
    )
    .addStringOption(option =>
      option
        .setName("period")
        .setDescription("Filter by AM or PM")
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
  // AUTOCOMPLETE — Region → AM/PM → Search → ≤25 items
  // ---------------------------------------------------------
  async autocomplete(interaction) {
    const region = interaction.options.getString("region");
    const period = interaction.options.getString("period");
    const query = interaction.options.getString("timezone").toLowerCase();

    const tzList = regions[region];

    const matches = tzList
      // AM/PM filter
      .filter(tz => moment().tz(tz.iana).format("A") === period)
      // search filter
      .filter(tz => tz.iana.toLowerCase().includes(query))
      // Discord limit
      .slice(0, 25)
      // display
      .map(tz => ({
        name: `${tz.currentTime} — ${tz.offset} (${tz.label})`,
        value: tz.iana
      }));

    await interaction.respond(matches);
  },

  // ---------------------------------------------------------
  // EXECUTE — Save timezone + assign role
  // ---------------------------------------------------------
  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const region = interaction.options.getString("region");
    const iana = interaction.options.getString("timezone");

    const tz = regions[region].find(t => t.iana === iana);
    if (!tz) {
      return interaction.editReply("❌ Invalid timezone.");
    }

    const member = await interaction.guild.members.fetch(interaction.user.id);

    // Remove old UTC roles
    for (const role of member.roles.cache.values()) {
      if (role.name.startsWith("UTC")) {
        await member.roles.remove(role);
      }
    }

    // Create role if missing
    let role = interaction.guild.roles.cache.find(r => r.name === tz.offset);
    if (!role) {
      role = await interaction.guild.roles.create({
        name: tz.offset,
        color: "Grey"
      });
    }

    await member.roles.add(role);

    // Save to DB
    await new Promise((resolve, reject) => {
      interaction.client.db.run(
        "INSERT OR REPLACE INTO timezones (user, tz) VALUES (?, ?)",
        [interaction.user.id, tz.iana],
        err => (err ? reject(err) : resolve())
      );
    });

    return interaction.editReply(
      `✅ Your timezone is set to **${tz.label} (${tz.offset})**`
    );
  }
};
