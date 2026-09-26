// commands/set-timezone.js
const { SlashCommandBuilder } = require("discord.js");
const moment = require("moment-timezone");
const { hourList } = require("../timezone-hours");
const { regions } = require("../timezone-regions");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("set-timezone")
    .setDescription("Set your timezone using hour → region → timezone.")

    // 1️⃣ Hour selector
    .addStringOption(option =>
      option
        .setName("hour")
        .setDescription("Pick the hour your clock is currently in (e.g., 2:xx PM).")
        .setRequired(true)
        .addChoices(...hourList)
    )

    // 2️⃣ Region selector
    .addStringOption(option =>
      option
        .setName("region")
        .setDescription("Pick your region.")
        .setRequired(true)
        .addChoices(
          { name: "Americas", value: "Americas" },
          { name: "Europe", value: "Europe" },
          { name: "Asia", value: "Asia" },
          { name: "Oceania", value: "Oceania" },
          { name: "Africa", value: "Africa" },
          { name: "Others", value: "Others" }
        )
    )

    // 3️⃣ Timezone selector (autocomplete)
    .addStringOption(option =>
      option
        .setName("timezone")
        .setDescription("Pick your exact timezone.")
        .setRequired(true)
        .setAutocomplete(true)
    ),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused();
    const hourValue = interaction.options.getString("hour");
    const regionValue = interaction.options.getString("region");

    if (!hourValue || !regionValue) {
      return interaction.respond([]);
    }

    const [hour, period] = hourValue.split("-"); // "2-PM" → ["2", "PM"]

    const tzList = regions[regionValue].filter(tz =>
      tz.currentHour === hour && tz.currentPeriod === period
    );

    const choices = tzList.map(tz => ({
      name: `${tz.label} — ${tz.offset} — ${tz.currentTime}`,
      value: tz.iana
    }));

    const filtered = choices.filter(c =>
      c.name.toLowerCase().includes(focused.toLowerCase())
    );

    interaction.respond(filtered.slice(0, 25));
  },

  async execute(interaction) {
    const timezoneValue = interaction.options.getString("timezone");

    await interaction.reply(
      `Your timezone has been set to **${timezoneValue}**.`
    );
  }
};
