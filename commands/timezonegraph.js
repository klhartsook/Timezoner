const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require("discord.js");
const { timezoneData } = require("../timezone-definitions");

const timezones = Object.values(timezoneData);
const timezoneByRoleName = new Map(
  timezones.map(timezone => [timezone.offset, timezone])
);

function buildTimezoneGroups(members) {
  const groups = new Map();

  for (const member of members.values()) {
    for (const role of member.roles.cache.values()) {
      const timezone = timezoneByRoleName.get(role.name);
      if (!timezone) continue;

      if (!groups.has(timezone.offset)) {
        groups.set(timezone.offset, {
          timezone,
          members: []
        });
      }

      groups.get(timezone.offset).members.push(member);
    }
  }

  return [...groups.values()].sort((a, b) =>
    a.timezone.offset.localeCompare(b.timezone.offset, undefined, { numeric: true })
  );
}

function buildEmbeds(guild, groups) {
  const embeds = [];
  let current = new EmbedBuilder()
    .setTitle(`🕒 Timezone Graph for ${guild.name}`)
    .setColor("#00AEEF")
    .setDescription("Members grouped by their timezone role.");
  let currentSize = current.data.description.length + current.data.title.length;

  for (const group of groups) {
    const memberMentions = group.members.map(member => `<@${member.id}>`);
    const memberChunks = [];
    let chunk = "";

    for (const mention of memberMentions) {
      const nextChunk = chunk ? `${chunk}, ${mention}` : mention;
      if (nextChunk.length > 1024) {
        memberChunks.push(chunk);
        chunk = mention;
      } else {
        chunk = nextChunk;
      }
    }
    if (chunk) memberChunks.push(chunk);

    for (let index = 0; index < memberChunks.length; index++) {
      const name = index === 0
        ? `${group.timezone.offset} - ${group.timezone.label} (${group.members.length})`
        : `${group.timezone.offset} - ${group.timezone.label} (continued)`;
      const value = memberChunks[index];
      const fieldSize = name.length + value.length;

      if (
        current.data.fields?.length >= 25 ||
        currentSize + fieldSize > 5500
      ) {
        embeds.push(current);
        current = new EmbedBuilder()
          .setTitle(`🕒 Timezone Graph for ${guild.name}`)
          .setColor("#00AEEF");
        currentSize = current.data.title.length;
      }

      current.addFields({ name, value });
      currentSize += fieldSize;
    }
  }

  if (current.data.fields?.length) embeds.push(current);
  return embeds;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("timezonegraph")
    .setDescription("Show members grouped by their timezone role."),

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({
        content: "❌ This command can only be used in a server.",
        flags: MessageFlags.Ephemeral
      });
    }

    await interaction.deferReply();

    await interaction.guild.members.fetch();
    const groups = buildTimezoneGroups(interaction.guild.members.cache);

    if (!groups.length) {
      return interaction.editReply({
        content: "No members currently have a timezone role."
      });
    }

    return interaction.editReply({ embeds: buildEmbeds(interaction.guild, groups) });
  }
};