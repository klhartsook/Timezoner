const { SlashCommandBuilder } = require("discord.js");
const moment = require("moment-timezone");
const { hourList } = require("../timezone-hours");
const { regions } = require("../timezone-regions");
const fs = require("fs");

// Railway persistent timezone file
const tzPath = "/data/timezones.json";

// Ensure file exists
fs.mkdirSync("/data", { recursive: true });
if (!fs.existsSync(tzPath)) {
  fs.writeFileSync(tzPath, "{}");
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("set-timezone")
    .setDescription("Set your timezone using AM/PM → hour → region → timezone.")

    // ⭐ Step 1 — AM or PM
    .addStringOption(option =>
      option
        .setName("ampm")
        .setDescription("Pick AM or PM.")
        .setRequired(true)
        .addChoices(
          { name: "AM", value: "AM" },
          { name: "PM", value: "PM" }
        )
    )

    // ⭐ Step 2 — Hour (filtered by AM/PM)
    .addStringOption(option =>
      option
        .setName("hour")
        .setDescription("Pick the hour your clock is currently in.")
        .setRequired(true)
        .setAutocomplete(true)
    )

    // ⭐ Step 3 — Region (UPDATED)
    .addStringOption(option =>
      option
        .setName("region")
        .setDescription("Pick your region.")
        .setRequired(true)
        .addChoices(
          { name: "Americas", value: "Americas" },
          { name: "Europe", value: "Europe" },
          { name: "Africa", value: "Africa" },
          { name: "Oceania", value: "Oceania" },
          { name: "Asia West", value: "Asia West" },
          { name: "Asia Central", value: "Asia Central" },
          { name: "Asia South", value: "Asia South" },
          { name: "Asia East", value: "Asia East" },
          { name: "Asia Southeast", value: "Asia Southeast" },
          { name: "Others", value: "Others" }
        )
    )

    // ⭐ Step 4 — Timezone
    .addStringOption(option =>
      option
        .setName("timezone")
        .setDescription("Pick your exact timezone.")
        .setRequired(true)
        .setAutocomplete(true)
    ),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);

    // ⭐ Hour autocomplete
    if (focused.name === "hour") {
      const ampm = interaction.options.getString("ampm");
      if (!ampm) return interaction.respond([]);

      const filteredHours = hourList.filter(h => h.value.endsWith(ampm));
      return interaction.respond(filteredHours.slice(0, 25));
    }

    // ⭐ Timezone autocomplete
    if (focused.name === "timezone") {
      const hourValue = interaction.options.getString("hour");
      const regionValue = interaction.options.getString("region");

      if (!hourValue || !regionValue) {
        return interaction.respond([]);
      }

      const [hour, period] = hourValue.split("-");

      const tzList = regions[regionValue].filter(
        tz => tz.currentHour === hour && tz.currentPeriod === period
      );

      const choices = tzList.map(tz => ({
        name: `${tz.label} — ${tz.offset} — ${tz.currentTime}`,
        value: tz.iana
      }));

      const filtered = choices.filter(c =>
        c.name.toLowerCase().includes(focused.value.toLowerCase())
      );

      return interaction.respond(filtered.slice(0, 25));
    }
  },

  async execute(interaction) {
    const timezoneValue = interaction.options.getString("timezone");

    // ⭐ Load existing timezone database
    let db = {};
    try {
      db = JSON.parse(fs.readFileSync(tzPath, "utf8"));
    } catch {
      db = {};
    }

    // ⭐ Save timezone for this user
    db[interaction.user.id] = timezoneValue;

    // ⭐ Write back to file
    fs.writeFileSync(tzPath, JSON.stringify(db, null, 2));

    await interaction.reply(
      `Your timezone has been set to **${timezoneValue}**.`
    );
  }
};
