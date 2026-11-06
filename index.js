const { Client, Collection, GatewayIntentBits } = require("discord.js");
const fs = require("fs");
const path = require("path");

console.log("=================================");
console.log("TIMEZONER STARTING");
console.log("Node Version:", process.version);
console.log("Working Directory:", process.cwd());
console.log("=================================");

process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:");
  console.error(err);
});

process.on("unhandledRejection", (err) => {
  console.error("UNHANDLED REJECTION:");
  console.error(err);
});

let buildTimezoneGroups;
let buildEmbeds;

try {
  ({ buildTimezoneGroups, buildEmbeds } = require("./utils/timezonegraph-engine"));
  console.log("✅ timezonegraph-engine loaded");
} catch (err) {
  console.error("❌ Failed to load timezonegraph-engine");
  console.error(err);
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

client.commands = new Collection();
client.liveGraph = null;

// -------------------- Load commands --------------------

const commandsPath = path.join(__dirname, "commands");

console.log("Loading commands from:", commandsPath);

try {
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((f) => f.endsWith(".js"));

  console.log(`Found ${commandFiles.length} command files`);

  for (const file of commandFiles) {
    try {
      console.log(`Loading command: ${file}`);

      const cmd = require(path.join(commandsPath, file));

      if (cmd && cmd.data && cmd.execute) {
        client.commands.set(cmd.data.name, cmd);
        console.log(`✅ Loaded ${cmd.data.name}`);
      } else {
        console.log(`⚠ Skipped ${file}`);
      }
    } catch (err) {
      console.error(`❌ Error loading command ${file}`);
      console.error(err);
    }
  }
} catch (err) {
  console.error("❌ Error reading commands directory");
  console.error(err);
}

// -------------------- Ready handler --------------------

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  console.log("clientReady: starting refresh interval");

  setInterval(() => {
    refreshLiveGraph().catch((e) =>
      console.error("Refresh loop top-level error:", e)
    );
  }, 60000);
});

// -------------------- Interaction handler --------------------

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand() && !interaction.isAutocomplete()) {
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

  if (!command) {
    console.error(`Command not found: ${interaction.commandName}`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(`Command error (${interaction.commandName}):`);
    console.error(err);

    if (!interaction || !interaction.token) return;
    if (interaction.deferred || interaction.replied) return;

    try {
      await interaction.reply({
        content: "❌ There was an error executing this command.",
        ephemeral: true,
      });
    } catch (replyErr) {
      console.error("Failed to send error reply:");
      console.error(replyErr);
    }
  }
});

// -------------------- Refresh loop --------------------

async function refreshLiveGraph() {
  const livePath = path.join(__dirname, "data", "livegraph.json");

  if (!client.liveGraph && fs.existsSync(livePath)) {
    try {
      client.liveGraph = JSON.parse(
        fs.readFileSync(livePath, "utf8")
      );

      console.log("✅ Loaded livegraph.json");
    } catch (err) {
      console.error("❌ Failed loading livegraph.json");
      console.error(err);
      return;
    }
  }

  if (!client.liveGraph) {
    console.log("DEBUG: no liveGraph set, skipping refresh");
    return;
  }

  try {
    const channel = await client.channels.fetch(
      client.liveGraph.channelId
    );

    const message = await channel.messages.fetch(
      client.liveGraph.messageId
    );

    const tzPath = path.join(__dirname, "data", "timezones.json");

    let db = {};

    if (fs.existsSync(tzPath)) {
      db = JSON.parse(
        fs.readFileSync(tzPath, "utf8")
      );
    }

    const groups = buildTimezoneGroups(message.guild, db);
    const embeds = buildEmbeds(message.guild, groups);

    await message.edit({ embeds });

    console.log(
      "✅ refresh succeeded at",
      new Date().toISOString()
    );
  } catch (err) {
    console.error("Refresh loop error:");
    console.error(err);

    if (err?.code === 10008 || err?.code === 10062) {
      console.log("Clearing liveGraph due to message/interaction error");
      client.liveGraph = null;
    }
  }
}

// -------------------- Login --------------------

console.log("Checking DISCORD_TOKEN...");

if (!process.env.DISCORD_TOKEN) {
  console.error("❌ DISCORD_TOKEN is missing");
  process.exit(1);
}

console.log("✅ DISCORD_TOKEN found");
console.log("Attempting Discord login...");

client.login(process.env.DISCORD_TOKEN);