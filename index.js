// index.js
const { Client, Collection, GatewayIntentBits } = require("discord.js");
const fs = require("fs");
const path = require("path");

// Utilities used by the refresh loop
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

  // Start periodic refresh AFTER the client is ready
  console.log("clientReady: starting refresh interval");
  setInterval(() => {
    console.log("DEBUG: refresh interval tick");
    refreshLiveGraph().catch((e) => console.error("Refresh loop top-level error:", e));
  }, 60_000);
});

// -------------------- Interaction handler --------------------
client.on("interactionCreate", async (interaction) => {
  // Global preflight: only handle chat input commands and ignore obviously stale interactions
  if (!interaction.isChatInputCommand() || !interaction.token) {
    console.log("⚠ Ignoring non-chat-input or stale interaction at global handler");
    return;
  }

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (err) {
    console.error("Command error:", err);

    // Defensive: only attempt to reply if the interaction still looks usable
    if (!interaction || !interaction.token) {
      console.log("⚠ Not sending error reply: interaction missing token or is stale.");
      return;
    }

    if (interaction.deferred || interaction.replied) {
      console.log("⚠ Not sending error reply: interaction already acknowledged.");
      return;
    }

    try {
      await interaction.reply({ content: "❌ There was an error executing this command.", ephemeral: true });
    } catch (replyErr) {
      console.error("Failed to send error reply (ignored):", replyErr);
    }
  }
});

// -------------------- Refresh loop --------------------
async function refreshLiveGraph() {
  if (!client.liveGraph) {
    console.log("DEBUG: no liveGraph set, skipping refresh");
    return;
  }

  console.log("DEBUG: refreshing liveGraph", client.liveGraph);

  try {
    const channel = await client.channels.fetch(client.liveGraph.channelId);
    if (!channel) {
      console.log("DEBUG: channel not found, clearing liveGraph");
      client.liveGraph = null;
      return;
    }

    const message = await channel.messages.fetch(client.liveGraph.messageId);
    if (!message) {
      console.log("DEBUG: message not found, clearing liveGraph");
      client.liveGraph = null;
      return;
    }

    // Load timezone DB
    const tzPath = path.join(__dirname, "data", "timezones.json");
    let db = {};
    try {
      if (fs.existsSync(tzPath)) {
        db = JSON.parse(fs.readFileSync(tzPath, "utf8"));
      } else {
        db = {};
      }
    } catch (err) {
      console.error("Failed to read timezone DB during refresh, continuing with empty DB:", err);
      db = {};
    }

    // Build new embeds
    let groups, embeds;
    try {
      const guild = message.guild;
      groups = buildTimezoneGroups(guild, db);
      embeds = buildEmbeds(guild, groups);
    } catch (err) {
      console.error("Failed to build timezone graph embeds during refresh:", err);
      return;
    }

    console.log("DEBUG: editing message with new embeds");
    await message.edit({ embeds });
    console.log("✅ refresh succeeded at", new Date().toISOString());
  } catch (err) {
    console.error("Refresh loop error:", err);

    // Clear liveGraph on known unrecoverable errors so the loop stops trying
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
