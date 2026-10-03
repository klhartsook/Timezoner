const moment = require("moment-timezone");
const { EmbedBuilder } = require("discord.js");

// --- Build groups based on exact local time
function buildTimezoneGroups(guild, db) {
  const groups = new Map();

  for (const [userId, tz] of Object.entries(db)) {
    const member = guild.members.cache.get(userId);
    if (!member) continue;

    const localTime = moment().tz(tz);
    const timeLabel = localTime.format("h:mm A");

    if (!groups.has(timeLabel)) {
      groups.set(timeLabel, {
        timeLabel,
        members: []
      });
    }

    groups.get(timeLabel).members.push(member);
  }

  const ordered = [...groups.values()].sort((a, b) => {
    const aTime = moment(a.timeLabel, "h:mm A");
    const bTime = moment(b.timeLabel, "h:mm A");
    return aTime - bTime;
  });

  return ordered;
}

// --- Build embeds with chunking
function buildEmbeds(guild, groups) {
  const embeds = [];
  let current = new EmbedBuilder()
    .setTitle(`🕒 Local Time Graph for ${guild.name}`)
    .setColor("#00AEEF")
    .setDescription("Members grouped by their exact current local time.");
  let currentSize = current.data.description.length + current.data.title.length;

  for (const group of groups) {
    const memberMentions = group.members.map(m => `<@${m.id}>`);
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

    for (let i = 0; i < memberChunks.length; i++) {
      const name =
        i === 0
          ? `${group.timeLabel} (${group.members.length})`
          : `${group.timeLabel} (continued)`;
      const value = memberChunks[i];
      const fieldSize = name.length + value.length;

      if (current.data.fields?.length >= 25 || currentSize + fieldSize > 5500) {
        embeds.push(current);
        current = new EmbedBuilder()
          .setTitle(`🕒 Local Time Graph for ${guild.name}`)
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

module.exports = { buildTimezoneGroups, buildEmbeds };
    