// index.js (complete minimal example with defensive global handler)
// Adjust intents and other setup to match your existing project if needed.

const { Client, Collection, GatewayIntentBits } = require("discord.js");
const fs = require("fs");
const path = require("path");

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
client.commands = new Collection();
client.liveGraph = null;

// Load commands
const commandsPath = path.join(__dirname, "commands");
for (const file of fs.readdirSync(commandsPath).filter(f => f.endsWith(".js"))) {
  const cmd = require(path.join(commandsPath, file));
  if (cmd && cmd.data && cmd.execute) {
    client.commands.set(cmd.data.name, cmd);
  }
}

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// Defensive global interaction handler
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

// Example refresh loop snippet (if you have a loop that edits the live message, use this pattern)
// This is a minimal example showing how to clear client.liveGraph on message/interaction errors.
async function refreshLiveGraph() {
  if (!client.liveGraph) return;
  try {
    const channel = await client.channels.fetch(client.liveGraph.channelId);
    const message = await channel.messages.fetch(client.liveGraph.messageId);
    // ... build new embeds and edit message ...
    // await message.edit({ embeds: newEmbeds });
  } catch (err) {
    console.error("Refresh loop error:", err);
    // Clear liveGraph on known message/interaction errors so the loop stops trying
    if (err?.code === 10008 || err?.code === 10062) {
      console.log("Clearing liveGraph due to message/interaction error");
      client.liveGraph = null;
    }
  }
}

// Start a periodic refresh if desired (example: every 60 seconds)
setInterval(() => {
  refreshLiveGraph().catch(e => console.error("Refresh loop top-level error:", e));
}, 60_000);

// Login
client.login(process.env.DISCORD_TOKEN);
