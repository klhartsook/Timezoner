// index.js
const { Client, GatewayIntentBits, Collection, MessageFlags, Partials, ApplicationCommandType } = require("discord.js");
const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

// --- Create client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions
  ],
  partials: [
    Partials.Message,
    Partials.Reaction,
    Partials.User,
    Partials.Channel
  ]
});

// --- Command collections
client.commands = new Collection();       // Slash commands
client.contextMenus = new Collection();   // Right-click user commands

// --- Load commands
const commandsPath = path.join(__dirname, "commands");
for (const file of fs.readdirSync(commandsPath)) {
  if (!file.endsWith(".js")) continue;

  const command = require(path.join(commandsPath, file));
  if (!command || !command.data) continue;

  // Slash commands
  if (command.data.type === undefined || command.data.type === 1) {
    client.commands.set(command.data.name, command);
  }

  // User context menu commands (right-click)
  if (command.data.type === ApplicationCommandType.User) {
    client.contextMenus.set(command.data.name, command);
  }
}

// --- Database
const dbPath = path.join(__dirname, "database", "timezones.db");
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new sqlite3.Database(dbPath);

// Create tables if they don't exist
db.run("CREATE TABLE IF NOT EXISTS timezones (user TEXT PRIMARY KEY, tz TEXT)");

client.db = db;

// --- Load events
const possibleEventsPaths = [
  path.join(__dirname, "events"),
  path.join(__dirname, "Events")
];
const eventsPath = possibleEventsPaths.find(p => fs.existsSync(p));
if (eventsPath) {
  for (const file of fs.readdirSync(eventsPath)) {
    if (!file.endsWith(".js")) continue;
    const event = require(path.join(eventsPath, file));
    if (typeof event === "function") {
      try {
        event(client);
      } catch (err) {
        console.error(`Error loading event file ${file}:`, err);
      }
    }
  }
}

// --- Interaction handler
client.on("interactionCreate", async (interaction) => {
  try {
    // AUTOCOMPLETE
    if (interaction.isAutocomplete()) {
      const command = client.commands.get(interaction.commandName);
      if (!command || !command.autocomplete) return;
      if (interaction.responded || interaction.deferred) return;

      try {
        await command.autocomplete(interaction);
      } catch (err) {
        console.error("Autocomplete handler error:", err);
      }
      return;
    }

    // USER CONTEXT MENU COMMAND (right-click → Apps → Local Time)
    if (interaction.isUserContextMenuCommand()) {
      const command = client.contextMenus.get(interaction.commandName);
      if (!command) return;

      await command.execute(interaction);
      return;
    }

    // SLASH COMMANDS
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;

      await command.execute(interaction);
      return;
    }

  } catch (err) {
    console.error("Command error:", err);

    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "❌ There was an error executing this command.",
          flags: MessageFlags.Ephemeral
        });
      } else {
        await interaction.followUp({
          content: "❌ There was an error executing this command.",
          flags: MessageFlags.Ephemeral
        });
      }
    } catch (sendErr) {
      console.error("Error sending error reply:", sendErr);
    }
  }
});

// --- Global error logging
process.on("unhandledRejection", (err) => {
  console.error("Unhandled promise rejection:", err);
});

client.on("error", (err) => {
  console.error("Discord client error:", err);
});

// --- Ready
client.on("clientReady", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// --- Login
const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error("Missing DISCORD_TOKEN environment variable. Set it and restart the bot.");
  process.exit(1);
}

client.login(token).catch(err => {
  console.error("Failed to login:", err);
  process.exit(1);
});
