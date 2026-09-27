const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require("discord.js");
const moment = require("moment-timezone");
const fs = require("fs");

// Railway persistent timezone file
const tzPath = "/data/timezones.json";

// Ensure file exists
if (!fs.existsSync(tzPath)) {
  fs.writeFileSync(tzPath, "{}");
}

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

    // Load timezone database
    let db = {};
    try {
      db = JSON.parse(fs.readFileSync(tzPath, "utf8"));
    } catch {
      db = {};
    }

    const timezone = db[user.id];

    if (!timezone) {
      return interaction.reply({
        content: `❌ ${user.username} has not set a timezone.`,
        flags: MessageFlags.Ephemeral
      });
    }

    const localTime = moment().tz(timezone).format("h:mm A");

    const embed = new EmbedBuilder()
      .setTitle(`🕒 Timezone for ${user.username}`)
      .setDescription(`**${timezone}**\nLocal time: **${localTime}**`)
      .addFields({ name: "IANA timezone", value: timezone })
      .setColor("#00AEEF");

    return interaction.reply({ embeds: [embed] });
  }
};
