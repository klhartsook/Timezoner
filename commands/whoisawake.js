const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require("discord.js");
const moment = require("moment-timezone");
const { timezoneData } = require("../timezone-definitions");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("whoisawake")
    .setDescription("See which server members are currently awake based on their timezone."),

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({
        content: "❌ This command can only be used in a server.",
        flags: MessageFlags.Ephemeral
      });
    }

    await interaction.deferReply();

    // Fetch all members
    const members = await interaction.guild.members.fetch();

    // Fetch timezone DB
    const db = interaction.client.db;

    const awake = [];
    const asleep = [];
    const unknown = [];

    // Define awake hours (customize this!)
    const AWAKE_START = 7;   // 7 AM
    const AWAKE_END = 23;    // 11 PM

    for (const member of members.values()) {
      if (member.user.bot) continue;

      // Get timezone from DB
      const tzRow = await new Promise((resolve, reject) => {
        db.get(
          "SELECT tz FROM timezones WHERE user = ?",
          [member.id],
          (err, row) => (err ? reject(err) : resolve(row))
        );
      });

      if (!tzRow) {
        unknown.push(member);
        continue;
      }

      const iana = tzRow.tz;
      const now = moment().tz(iana);
      const hour = now.hour();
      const formatted = now.format("h:mm A");

      const isAwake = hour >= AWAKE_START && hour < AWAKE_END;

      if (isAwake) {
        awake.push({ member, formatted });
      } else {
        asleep.push({ member, formatted });
      }
    }

    // Build embed
    const embed = new EmbedBuilder()
      .setTitle("🌐 Who Is Awake Right Now?")
      .setColor("#00AEEF")
      .setTimestamp();

    // Awake section
    embed.addFields({
      name: `😄 Awake (${awake.length})`,
      value:
        awake.length > 0
          ? awake
              .map(a => `• **${a.member.user.username}** — ${a.formatted}`)
              .join("\n")
          : "Nobody is awake right now."
    });

    // Asleep section
    embed.addFields({
      name: `💤 Asleep (${asleep.length})`,
      value:
        asleep.length > 0
          ? asleep
              .map(a => `• ${a.member.user.username} — ${a.formatted}`)
              .join("\n")
          : "Everyone is awake."
    });

    // Unknown section
    embed.addFields({
      name: `❓ No Timezone Set (${unknown.length})`,
      value:
        unknown.length > 0
          ? unknown.map(m => `• ${m.user.username}`).join("\n")
          : "All members have set a timezone."
    });

    return interaction.editReply({ embeds: [embed] });
  }
};
