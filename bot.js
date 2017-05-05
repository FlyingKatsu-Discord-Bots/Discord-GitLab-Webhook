// Import configuration files
const CONFIG = require('./require/config.json');

// Import required modules
//const NET = require('net');

// Import the discord.js module
const DISCORD = require('discord.js');

// Create an instance of a Discord client
const CLIENT = new DISCORD.Client();

/* ============================================
 * Timer to check if disconnected from Discord
 * ========================================= */
var disconnectHandled = false;
var readyMsg = `${CONFIG.bot.name} is online and ready to receive data`;

var checkDisconnect = function() {
  //console.log("### Routine check client.status: " + CLIENT.status + "; uptime: " + CLIENT.uptime);
  // if connection is lost, 
  if ( !disconnectHandled && CLIENT.status == 5 ) {
    // set disconnectHandled
    disconnectHandled = true;
    // set ready message to "Recovering from unexpected shutdown"
    readyMsg = `${CONFIG.bot.name} has been restarted.  Any unprocessed data sent before this message will need to be resubmitted.`;
    // try to login again (when ready, set interval again) 
    CLIENT.login(CONFIG.bot.token);
  }
}

// Set a timeout for 120000 or 2 minutes  OR 3000 for 3sec
var interval_dc = setInterval( checkDisconnect, 3000 );


/* ============================================
 * Set Up Webhook stuff
 * ========================================= */
const HOOK = new DISCORD.WebhookClient(CONFIG.webhook.id, CONFIG.webhook.token);
//const GUILD = CLIENT.guilds.get(HOOK.guildID);
//const CHANNEL = GUILD.channels.get(HOOK.channelID);

/* ============================================
 * Discord.JS Event Handlers
 * ========================================= */

// The ready event is vital, it means that your bot will only start reacting to information
// from Discord _after_ ready is emitted
CLIENT.on('ready', () => {
  console.log(`${CONFIG.bot.name} is ready to receive data`);
  
  if (disconnectHandled) {
    disconnectHandled = false;
    HOOK.send(readyMsg)
      .then( (message) => console.log(`Sent message: ${message.content}`))
      .catch(console.log);
  } else {
    HOOK.send(readyMsg)
      .then( (message) => console.log(`Sent message: ${message.content}`))
      .catch(console.log);
  }
  
  /*CLIENT.fetchWebhook(CONFIG.webhook.id, CONFIG.webhook.token)
    .then( (webhook) => webhook.sendMessage(readyMsg) )
    .catch( console.error );
  */
  
});

// Create an event listener for messages
CLIENT.on('message', message => {
  // If the message is "ping"
  if (message.content === 'ping') {
    // Send "pong" to the same channel
    message.channel.send('pong');
  }
});

CLIENT.on('disconnect', closeEvent => {
  let d = new Date();
  console.log(d.toLocaleString());
  
  if (closeEvent) {
    console.log( CONFIG.bot.name + ' went offline with code ' + closeEvent.code + ": " + closeEvent.reason);
    console.log("Exiting...");
  } else {
    console.log('Mr.Prog went offline with unknown code');
  }
});

CLIENT.on('reconnecting', () => {
  let d = new Date();
  console.log(d.toLocaleString());
  console.log('Mr.Prog is attempting to reconnect');
});

CLIENT.on('warn', warn => {
  let d = new Date();
  console.log(d.toLocaleString());
  if (warn) {
    console.log('Warning: ' + warn);
  }
});

CLIENT.on('error', error => {
  let d = new Date();
  console.log(d.toLocaleString());
  if (error) {
    console.log('Error: ' + error.message);
  } else {
    console.log('Unknown error');
  }
});


/* ============================================
 * Log our bot into Discord
 * ========================================= */
console.log("Logging in...");
// Log our bot in
CLIENT.login(CONFIG.bot.token);