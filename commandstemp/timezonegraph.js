const {
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
} = require("discord.js");
const moment = require("moment-timezone");
const { timezoneData, timezoneSections } = require("../timezone-definitions");

// Helper: get current time in a timezone
function getTimeInZone(iana) {
  try {
    return moment().tz(iana).format("h:mm A");
  } catch {
    return "Invalid TZ";
  }
}

// Build combined timezone groups by IANA
function buildTimezoneGroups() {
  const groups = new Map();

  for (const [emoji, tz] of Object.entries(timezoneData)) {
    const { offset, label, iana } = tz;
    if (!groups.has(iana)) {
      groups.set(iana, {
        iana,
        offsets: new Set(),
        labels: new Set(),
        emojis: new Set()
      });
    }
    const g = groups.get(iana);
    g.offsets.add(offset);
    g.labels.add(label);
    g.emojis.add(emoji);
  }

  return Array.from(groups.values()).map(g => ({
    iana: g.iana,
    offsets: Array.from(g.offsets).sort(),
    labels: Array.from(g.labels).sort(),
    emojis: Array.from(g.emojis),
    users: []
  }));
}

// Fetch all timezone rows from DB and map to groups
async function fetchTimezoneStats(db, guild) {
  const rows = await new Promise((resolve, reject) => {
    db.all("SELECT user, tz FROM timezones", (err, r) => {
      if (err) return reject(err);
      resolve(r || []);
    });
  });

  const groups = buildTimezoneGroups();

  // Map users to groups, excluding those who left the server
  for (const row of rows) {
    const { user, tz } = row;
    const member = guild.members.cache.get(user);
    if (!member) continue;

    const group = groups.find(g => g.iana === tz);
    if (!group) continue;

    group.users.push(member);
  }

  // Remove empty timezones
  return groups.filter(g => g.users.length > 0);
}

// Build details embed for a single timezone
function buildDetailsEmbed(group) {
  const time = getTimeInZone(group.iana);
  const count = group.users.length;
  const offsetsText = group.offsets.join(" / ");
  const labelsText = group.labels.join(" / ");

  let desc =
    `**Offsets:** ${offsetsText}\n` +
    `**Locations:** ${labelsText}\n` +
    `**Local time:** ${time}\n` +
    `**Users:** ${count}\n\n`;

  const userLines = group.users.map(m => `• <@${m.id}>`);
  const maxLines = 40;

  const chunked = [];
  for (let i = 0; i < userLines.length; i += maxLines) {
    chunked.push(userLines.slice(i, i + maxLines).join("\n"));
  }

  desc += chunked[0];

  if (chunked.length > 1) {
    desc += `\n\n_+ ${userLines.length - maxLines} more users._`;
  }

  return new EmbedBuilder()
    .setTitle("🕒 Timezone Details")
    .setDescription(desc)
    .setFooter({ text: group.iana })
    .setColor("#00AEEF");
}

// Build region menus (only populated timezones)
function buildRegionMenus(groups) {
  const regionMap = {};

  for (const [regionName, emojis] of Object.entries(timezoneSections)) {
    const populated = [];

    for (const emoji of emojis) {
      const tz = timezoneData[emoji];
      if (!tz) continue;

      const group = groups.find(g => g.iana === tz.iana);
      if (!group) continue;

      populated.push({ emoji, tz, group });
    }

    if (populated.length > 0) {
      regionMap[regionName] = populated;
    }
  }

  const mergedMenus = [
    {
      label: "Americas",
      regions: ["🌎 Pacific & Oceania", "🌍 North America", "🌎 South America"]
    },
    {
      label: "Europe",
      regions: ["🌍 Europe"]
    },
    {
      label: "Middle East",
      regions: ["🌏 Middle East"]
    },
    {
      label: "South & Southeast Asia",
      regions: ["🌏 South Asia", "🌏 Southeast Asia"]
    },
    {
      label: "East Asia & Australia",
      regions: ["🌏 East Asia", "🌏 Australia (Half‑Hour Zones)"]
    }
  ];

  const actionRows = [];

  for (const menu of mergedMenus) {
    const options = [];

    for (const regionName of menu.regions) {
      const items = regionMap[regionName];
      if (!items) continue;

      for (const item of items) {
        options.push({
          emoji: item.emoji,
          label: `${item.tz.offset} — ${item.tz.label}`,
          value: item.group.iana
        });
      }
    }

    if (options.length === 0) continue;

    const chunks = [];
    for (let i = 0; i < options.length; i += 25) {
      chunks.push(options.slice(i, i + 25));
    }

    for (const chunk of chunks) {
      const select = new StringSelectMenuBuilder()
        .setCustomId(`tz_select_${menu.label.replace(/\s+/g, "_")}_${Math.random().toString(36).slice(2)}`)
        .setPlaceholder(menu.label);

      for (const opt of chunk) {
        select.addOptions(
          new StringSelectMenuOptionBuilder()
            .setLabel(opt.label)
            .setValue(opt.value)
            .setEmoji(opt.emoji)
        );
      }

      actionRows.push(new ActionRowBuilder().addComponents(select));
    }
  }

  return actionRows.slice(0, 5);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("timezonegraph")
    .setDescription("Shows timezone graph in regular or details mode.")
    .addStringOption(option =>
      option
        .setName("mode")
        .setDescription("regular or details")
        .setRequired(true)
        .addChoices(
          { name: "regular", value: "regular" },
          { name: "details", value: "details" }
        )
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const mode = interaction.options.getString("mode");
    const db = interaction.client.db;
    const guild = interaction.guild;

    let groups;
    try {
      groups = await fetchTimezoneStats(db, guild);
    } catch (err) {
      console.error(err);
      return interaction.editReply("❌ Database error.");
    }

    if (groups.length === 0) {
      return interaction.editReply("❌ No populated timezones found.");
    }

    // REGULAR MODE RESTORED EXACTLY AS BEFORE
    if (mode === "regular") {
      const sorted = [...groups].sort((a, b) => b.users.length - a.users.length);

      const pageSize = 10;
      let page = 0;

      const buildPageEmbed = () => {
        const slice = sorted.slice(page * pageSize, (page + 1) * pageSize);

        let desc = "";
        for (const g of slice) {
          const bar = "█".repeat(Math.min(g.users.length, 20));
          desc += `**${g.offsets[0]} — ${g.labels[0]}** ${bar} (${g.users.length})\n`;
        }

        return new EmbedBuilder()
          .setTitle("🕒 Timezone Graph — Regular Mode")
          .setDescription(desc)
          .setFooter({ text: `Page ${page + 1} / ${Math.ceil(sorted.length / pageSize)}` })
          .setColor("#00AEEF");
      };

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("prev").setLabel("Previous").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("next").setLabel("Next").setStyle(ButtonStyle.Primary)
      );

      const msg = await interaction.editReply({
        embeds: [buildPageEmbed()],
        components: [row]
      });

      const collector = msg.createMessageComponentCollector({ time: 10 * 60 * 1000 });

      collector.on("collect", async btn => {
        if (btn.user.id !== interaction.user.id) {
          return btn.reply({ content: "❌ Not your command.", flags: MessageFlags.Ephemeral });
        }

        if (btn.customId === "prev" && page > 0) page--;
        if (btn.customId === "next" && page < Math.ceil(sorted.length / pageSize) - 1) page++;

        await btn.update({
          embeds: [buildPageEmbed()],
          components: [row]
        });
      });

      collector.on("end", async () => {
        try {
          await msg.edit({ components: [] });
        } catch {}
      });

      return;
    }

    // DETAILS MODE (region menus)
    if (mode === "details") {
      const menus = buildRegionMenus(groups);

      const introEmbed = new EmbedBuilder()
        .setTitle("🕒 Timezone Graph — Details Mode")
        .setDescription("Select a timezone from the menus below to view detailed information.")
        .setColor("#00AEEF");

      const msg = await interaction.editReply({
        embeds: [introEmbed],
        components: menus
      });

      const collector = msg.createMessageComponentCollector({ time: 10 * 60 * 1000 });

      collector.on("collect", async sel => {
        if (sel.user.id !== interaction.user.id) {
          return sel.reply({ content: "❌ Not your command.", flags: MessageFlags.Ephemeral });
        }

        const selectedIana = sel.values[0];
        const group = groups.find(g => g.iana === selectedIana);

        if (!group) {
          return sel.reply({ content: "❌ Timezone not found.", flags: MessageFlags.Ephemeral });
        }

        await sel.update({
          embeds: [buildDetailsEmbed(group)],
          components: menus
        });
      });

      collector.on("end", async () => {
        try {
          await msg.edit({ components: [] });
        } catch {}
      });
    }
  }
};
