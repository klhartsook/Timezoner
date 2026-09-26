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

    // 2️⃣ Region selector (filtered later)
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

    // 3️⃣ Timezone selector (filtered later)
    .addStringOption(option =>
      option
        .setName("timezone")
        .setDescription("Pick your exact timezone.")
        .setRequired(true)
    ),

  async execute(interaction) {
    const hourValue = interaction.options.getString("hour"); // "2-PM"
    const regionValue = interaction.options.getString("region");
    const timezoneValue = interaction.options.getString("timezone");

    // Save timezone however your bot stores it
    await interaction.reply(
      `Your timezone has been set to **${timezoneValue}**.`
    );
  }
};