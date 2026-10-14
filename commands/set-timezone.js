const { SlashCommandBuilder } = require("discord.js");
const moment = require("moment-timezone");
const { hourList } = require("../timezone-hours");
const { regions } = require("../timezone-regions");
const fs = require("fs");
const path = require("path");

// ✅ Safe timezone file path (works on Windows + Railway)
const tzPath = path.join(__dirname, "..", "data", "timezones.json");

// Ensure /data exists
fs.mkdirSync(path.join(__dirname, "..", "data"), { recursive: true });

// Ensure timezone file exists
if (!fs.existsSync(tzPath)) {
  fs.writeFileSync(tzPath, "{}");
}

// ✅ Helper to catch autocomplete errors
async function safeRespond(interaction, data) {
  try {
    await interaction.respond(data);
  } catch (err) {
    console.error("Autocomplete respond failed:", err);
  }
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

    // ⭐ Step 3 — Region
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
      if (!ampm) return safeRespond(interaction, []);

      const filteredHours = hourList.filter(h => h.value.endsWith(ampm));
      return safeRespond(interaction, filteredHours.slice(0, 25));
    }

    // ⭐ Timezone autocomplete
    if (focused.name === "timezone") {
      const hourValue = interaction.options.getString("hour");
      const regionValue = interaction.options.getString("region");

      if (!hourValue || !regionValue) {
        return safeRespond(interaction, []);
      }

      const [hour, period] = hourValue.split("-");

      const tzList = regions[regionValue].filter(tz => {
        const now = moment().tz(tz.iana);
        const currentHour = now.format("h");
        const currentPeriod = now.format("A");
        return currentHour === hour && currentPeriod === period;
      });

      tzList.sort((a, b) => a.offset.localeCompare(b.offset));

      const choices = tzList.map(tz => ({
        name: `${tz.label} — ${tz.offset} — ${tz.currentTime}`,
        value: tz.iana
      }));

      const filtered = choices.filter(c =>
        c.name.toLowerCase().includes(focused.value.toLowerCase())
      );

      return safeRespond(interaction, filtered.slice(0, 25));
    }
  },

  async execute(interaction) {
    const timezoneValue = interaction.options.getString("timezone");

    let db = {};
    try {
      db = JSON.parse(fs.readFileSync(tzPath, "utf8"));
    } catch {
      db = {};
    }

    db[interaction.user.id] = timezoneValue;

    fs.writeFileSync(tzPath, JSON.stringify(db, null, 2));

    await interaction.reply(
      `Your timezone has been set to **${timezoneValue}**.`
    );
  }
};
