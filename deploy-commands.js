const { REST, Routes, ApplicationCommandType } = require('discord.js');
const fs = require('fs');

// Load commands
const commands = [];
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);

    if (!command || !command.data) continue;

    // Slash commands (type undefined or type 1)
    if (command.data.type === undefined || command.data.type === 1) {
        commands.push(command.data.toJSON());
    }

    // User context menu commands (right-click)
    if (command.data.type === ApplicationCommandType.User) {
        commands.push(command.data.toJSON());
    }
}

// Load environment variables
const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;

if (!token) {
    console.error("❌ Missing DISCORD_TOKEN environment variable.");
    process.exit(1);
}

if (!clientId) {
    console.error("❌ Missing DISCORD_CLIENT_ID environment variable.");
    process.exit(1);
}

// Deploy commands
const rest = new REST({ version: '10' }).setToken(token);

rest.put(
    Routes.applicationCommands(clientId),
    { body: commands }
)
.then(() => console.log('✅ All commands (slash + context menu) registered.'))
.catch(console.error);
