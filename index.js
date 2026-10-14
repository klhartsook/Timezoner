const { Client, Collection, GatewayIntentBits } = require("discord.js");
const fs = require("fs");
const path = require("path");
const { buildTimezoneGroups, buildEmbeds } = require("./utils/timezonegraph-engine");

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

client.commands = new Collection();
client.liveGraph = null;

// -------------------- Load commands --------------------
const commandsPath = path.join(__dirname, "commands");
for (const file of fs.readdirSync(commandsPath).filter((f) => f.endsWith(".js"))) {
  const cmd = require(path.join(commandsPath, file));
  if (cmd && cmd.data && cmd.execute) {
    client.commands.set(cmd.data.name, cmd);
  }
}

// -------------------- Ready handler --------------------
client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
  console.log("clientReady: starting refresh interval");
  setInterval(() => {
    console.log("DEBUG: refresh interval tick");
    refreshLiveGraph().catch((e) => console.error("Refresh loop top-level error:", e));
  }, 60_000);
});

// -------------------- Interaction handler --------------------
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand() && !interaction.isAutocomplete()) {
    console.log("⚠ Ignoring non-chat-input or stale interaction at global handler");
    return;
  }

  if (interaction.isAutocomplete()) {
    const command = client.commands.get(interaction.commandName);
    if (!command || !command.autocomplete) return;
    try {
      await command.autocomplete(interaction);
    } catch (err) {
      console.error("Autocomplete error:", err);
    }
    return;
  }

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (err) {
    console.error("Command error:", err);
    if (!interaction || !interaction.token) return;
    if (interaction.deferred || interaction.replied) return;
    try {
      await interaction.reply({ content: "❌ There was an error executing this command.", ephemeral: true });
    } catch (replyErr) {
      console.error("Failed to send error reply (ignored):", replyErr);
    }
  }
});

// -------------------- Refresh loop --------------------
async function refreshLiveGraph() {
  const livePath = path.join(__dirname, "data", "livegraph.json");

  // Reload liveGraph from file if memory is empty
  if (!client.liveGraph && fs.existsSync(livePath)) {
    client.liveGraph = JSON.parse(fs.readFileSync(livePath, "utf8"));
  }
  if (!client.liveGraph) {
    console.log("DEBUG: no liveGraph set, skipping refresh");
    return;
  }

  try {
    const channel = await client.channels.fetch(client.liveGraph.channelId);
    const message = await channel.messages.fetch(client.liveGraph.messageId);

    // Reload timezone DB fresh each tick
    const tzPath = path.join(__dirname, "data", "timezones.json");
    let db = {};
    if (fs.existsSync(tzPath)) {
      db = JSON.parse(fs.readFileSync(tzPath, "utf8"));
    }

    // ✅ Rebuild groups fresh each refresh
    const groups = buildTimezoneGroups(message.guild, db);
    const embeds = buildEmbeds(message.guild, groups);

    await message.edit({ embeds });
    console.log("✅ refresh succeeded at", new Date().toISOString());
  } catch (err) {
    console.error("Refresh loop error:", err);
    if (err?.code === 10008 || err?.code === 10062) {
      console.log("Clearing liveGraph due to message/interaction error");
      client.liveGraph = null;
    }
  }
}

// -------------------- Start bot --------------------
if (!process.env.DISCORD_TOKEN) {
  console.error("DISCORD_TOKEN is not set in environment variables.");
  process.exit(1);
}

client.login(process.env.DISCORD_TOKEN);
