const { REST, Routes } = require('discord.js');
require('dotenv').config();

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID; // add this to your .env file

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    console.log('🧹 Clearing all guild commands...');
    await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: [] }
    );
    console.log('✅ Guild commands cleared.');
  } catch (err) {
    console.error(err);
  }
})();
