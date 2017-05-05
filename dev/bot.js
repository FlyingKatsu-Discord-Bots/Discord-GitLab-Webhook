// Import required modules
//const NET = require('net');

// Import configuration files
const CONFIG = require('require/config.json');

// Import the discord.js module
const DISCORD = require('discord.js');

// Create an instance of a Discord client
const CLIENT = new DISCORD.Client();


// The ready event is vital, it means that your bot will only start reacting to information
// from Discord _after_ ready is emitted
CLIENT.on('ready', () => {
  console.log(`{CONFIG.bot.name} is ready to receive data`);
});

// Create an event listener for messages
CLIENT.on('message', message => {
  // If the message is "ping"
  if (message.content === 'ping') {
    // Send "pong" to the same channel
    message.channel.send('pong');
  }
});

// Log our bot in
CLIENT.login(CONFIG.bot.token);