const {
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  EmbedBuilder,
  MessageFlags
} = require("discord.js");
const moment = require("moment-timezone");

module.exports = {
  data: new ContextMenuCommandBuilder()
    .setName("Local Time")
    .setType(ApplicationCommandType.User),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const db = interaction.client.db;
    const target = interaction.targetUser;

    // Fetch timezone from DB
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

    const iana = row.tz;

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
