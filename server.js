/*
 * HTTP request handling based on
 * https://blog.kyletolle.com/using-node-js-to-inspect-webhook-calls/
 * Test it in a second client with cURL
 * curl -X POST localhost:9000 -H 'Content-Type: application/json' -d '{"payload":"test"}'
 * cat sample/unrelated.json | curl -i -v -X POST localhost:9000 -H "Content-Type: application/json" -H 'X-Gitlab-Token: TOKEN' -H 'X-Gitlab-Event: EVENT' --data-binary "@-"
 */

// Import FS for reading sample files
const FS = require('fs');
// Import the CRYPTO module for verifying tokens from HTTP request headers
const CRYPTO = require('crypto');
// Import the HTTP module for sending and receiving data
const HTTP = require('http');
// Import the discord.js module
const DISCORD = require('discord.js');

// Import CONFIG file
const CONFIG = require('./require/config.json');
const SECRET = CONFIG.webhook.token || process.env.GITLAB_TOKEN || "";
const BOT_SECRET = CONFIG.bot.token || process.env.WEBHOOK_BOT_TOKEN || "";

/* ============================================
 * Set up states and timers
 * ========================================= */
var readyToReceive = false;

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
 * Set up Webhook stuff
 * ========================================= */

// Create an instance of a Discord client
const CLIENT = new DISCORD.Client();

const HOOK = new DISCORD.WebhookClient(CONFIG.webhook.id, CONFIG.webhook.token);


/* ============================================
 * Set up Server listening stuff
 * ========================================= */

// Create our local webhook-receiving server
var app = HTTP.createServer(handler);
var statusCode = 200;

// Handler for receiving HTTP requests
function handler (req, res) {
      
  // Keep track of incoming data
  let data = '';
  let type = '';
  let passChecked = null;

  // Only do stuff if the request came via POST
  if (req.method == "POST") {

    console.log("---- Post Request Detected ----");

    // Data collection handler
    req.on('data', function(chunk) {
      
      console.log("reading...");
      
      if ( passChecked === false ) { // this data is already determined to be invalid
        console.log("Data was invalid, skipping...");
        return;
        
      } else if ( passChecked != null ) {
        data += chunk;
        return;
        
      } else {
        
        console.log(req.headers);
        
        // Is the first chunk, check the headers for validity
        if ( req.headers.hasOwnProperty('x-gitlab-token') ) {
          
          // Compare tokens
          let a = Buffer.from(req.headers['x-gitlab-token']);
          let b = Buffer.from(SECRET);
          let isValid = (SECRET != "") && (a.length - b.length) == 0 && CRYPTO.timingSafeEqual( a,b );
          
          if (!isValid) {
            // otherwise, do nothing
            console.log("Invalid");
            passChecked = false;
            
            // send a Bad Request response
            statusCode = 400;
            res.writeHead(statusCode, {'Content-Type': 'text/plain'});
            res.end();
            
            // stop receiving request data
            req.destroy( new MyError( "Invalid token" ) );
            console.log("==== DESTROYED ====");
            return;
            
          } else {
            // do something
            passChecked = true;
            statusCode = 200;
            
            // get the event type
            type = req.headers['x-gitlab-event'];
            console.log("event type is: ", type);
            
            // increment data
            data += chunk;
          }

        } else { // No Gitlab header detected
          // otherwise, do nothing
          console.log("Not from GitLab");
          passChecked = false;
          
          // send a Bad Request response
          statusCode = 400;
          res.writeHead(statusCode, {'Content-Type': 'text/plain'});
          res.end();
          
          // stop receiving request data
          req.destroy( new MyError( "Not from GitLab" ) );
          console.log("==== DESTROYED ====");
          return;
        }
      }

    });

    // Completion handler
    req.on('end', function() {
      console.log("finishing up...");
      
      if ( passChecked ) {
        // Let the sender know we received things alright
        res.writeHead(statusCode, {'Content-Type': 'text/plain'});
        res.end();
        
        // Process Data
        processData(type, data);
      }
      console.log("==== DONE ====");
    });
    
    // Error Handler
    req.on('error', function(e){
      console.error(e);
    });

  }

  // TODO: handle other HTTP request types
  
}

// Colors corresponding to different events
const ColorCodes = {
  issue_opened: 15426592, // orange
  issue_closed: 5198940, // grey
  issue_comment: 15109472, // pale orange
  commit: 7506394, // blue
  release: 2530048, // green
  merge_request_opened: 12856621, // red
  merge_request_closed: 2530048, // green
  merge_request_comment: 15749300, // pink
  default: 5198940, // grey
};


/* 
 * A function for processing data received from an HTTP request
 * 
 */
function processData(type, data) {
  console.log("processing...");
  
  let output = {
    COLOR: ColorCodes.default,
    TITLE: "",
    USERNAME: "",
    AVATAR_URL: "",
    PERMALINK: "",
    DESCRIPTION: "",
    FIELDS: []
  };
  
  try {
    switch(type) {

      case "Push Hook":
        output.COLOR = ColorCodes.commit;
        output.USERNAME = data.user_name;
        output.AVATAR_URL = data.user_avatar;
        output.PERMALINK = data.project.web_url;

        if (data.commits.length == 1) {

          output.TITLE = `[${data.project.path_with_namespace}] 1 new commmit`;
          output.DESCRIPTION +=  `${data.commits[i].message}\n`;
          output.DESCRIPTION +=  `${data.commits[i].modified.length} changes\n`;
          output.DESCRIPTION +=  `${data.commits[i].added.length} additions\n`;
          output.DESCRIPTION +=  `${data.commits[i].removed.length} deletions`;

        } else {

          output.TITLE = `[${data.project.path_with_namespace}] ${data.total_commits_count} new commits`;

          for(let i = 0; i < Math.min(data.commits.length, 5); i++) {
            let changelog = `${data.commits[i].modified.length} changes; ${data.commits[i].added.length} additions; ${data.commits[i].removed.length} deletions`;
            output.DESCRIPTION += `[${data.commits[i].id.substring(0,8)}](${data.commits[i].url} "${changelog}") `;
            output.DESCRIPTION += `${data.commits[i].message.substring(0,32)}... - ${data.commits[i].author.name}`;
            output.DESCRIPTION +=  `\n`;
          }
        }      
        break;

      case "Tag Push Hook":
        // TODO https://docs.gitlab.com/ce/user/project/integrations/webhooks.html#tag-events
        console.log("# Unhandled case! Tag Push Hook.");
        output.DESCRIPTION =  "**Tag Push Hook** This feature is not yet implemented";
        break;

      case "Issue Hook":
        output.USERNAME = data.user.username;
        output.AVATAR_URL = data.user.avatar_url;
        output.PERMALINK = data.object_attributes.url;
        output.DESCRIPTION =  data.object_attributes.description.substring(0,128);

        switch( data.object_attributes.action ) {
          case "open": 
            output.COLOR = ColorCodes.issue_opened;
            output.TITLE = `[${data.project.path_with_namespace}] Issue Opened: #${data.object_attributes.iid} ${data.object_attributes.title}`;
            break;
          case "close":
            output.COLOR = ColorCodes.issue_closed;
            output.TITLE = `[${data.project.path_with_namespace}] Issue Closed: #${data.object_attributes.iid} ${data.object_attributes.title}`;
            break;
          default:
            output.COLOR = ColorCodes.issue_comment;
            console.log("## Unhandled case for Issue Hook ", data.object_attributes.action );
            break;
        }

        if (data.assignees.length > 0) {
          let assignees = { name: "Assigned To:", value: "" };
          for(let i = 0; i < data.assignees.length; i++) {
            assignees.value += `${data.assignees[i].username} `;
          }
          output.FIELDS.push(assignees);
        } 

        if (data.labels.length > 0) {
          let labels = { name: "Labeled As:", value: "" };
          for(let i = 0; i < data.labels.length; i++) {
            labels.value += `${data.labels[i].type} `;
          }
          output.FIELDS.push(labels);
        }      
        break;

      case "Note Hook":
        output.USERNAME = data.user.username;
        output.AVATAR_URL = data.user.avatar_url;
        output.DESCRIPTION =  `New comment by ${data.user.username}`;        
        output.PERMALINK = data.object_attributes.url;
        
        output.FIELDS.push({
          name: "Comment",
          value: data.object_attributes.note.substring(0,128)
        });
        
        switch( data.object_attributes.noteable_type ) {

          case "commit":
          case "Commit":
            output.COLOR = ColorCodes.commit;
            output.TITLE = `[${data.project.path_with_namespace}] New Comment on Commit ${data.commit.id.substring(0,8)}`;
            output.FIELDS.push({
              name: "Commit Message",
              value: data.commit.message
            });
            output.FIELDS.push({
              name: "Commit Author",
              value: data.commit.author.name
            });
            output.FIELDS.push({
              name: "Commit Timestamp",
              // Given Format: 2014-02-27T10:06:20+02:00
              value: Date.parse(data.commit.timestamp)
            });
            break;

          case "merge_request":
          case "MergeRequest":
            output.COLOR = ColorCodes.merge_request_comment;
            output.TITLE = `[${data.project.path_with_namespace}] New Comment on Merge Request #${data.merge_request.iid}`;
            output.FIELDS.push({
              name: "Merge Request",
              value: data.merge_request.title
            });
            output.FIELDS.push({
              name: "Source --> Target",
              value: `Merge [${data.merge_request.source.path_with_namespace}: ${data.merge_request.source_branch}](${data.merge_request.source.web_url}) into [${data.merge_request.target.path_with_namespace}: ${data.merge_request.target_branch}](${data.merge_request.target.web_url})`
            });
            output.FIELDS.push({
              name: "Assigned To",
              value: data.merge_request.assignee.username
            });     
            break;

          case "issue":
          case "Issue":
            output.COLOR = ColorCodes.issue_comment;
            output.TITLE = `[${data.project.path_with_namespace}] New Comment on Issue #${data.issue.iid} ${data.issue.title}`;
            break;

          case "snippet":
          case "Snippet":
            output.TITLE = `[${data.project.path_with_namespace}] New Comment on Code Snippet`;

            output.FIELDS.push({
              name: "Snippet",
              value: "Title: " + data.snippet.title + "\n```\n" + data.snippet.content + "\n```"
            });
            break;

          default:
            console.log("## Unhandled case for Note Hook ", data.object_attributes.noteable_type );
            break;
        }

        break;

      case "Merge Request Hook":
        output.USERNAME = data.user.username;
        output.AVATAR_URL = data.user.avatar_url;
        output.PERMALINK = data.object_attributes.url;
        output.DESCRIPTION =  data.object_attributes.description.substring(0,128);

        switch( data.object_attributes.action ) {
          case "open": 
            output.COLOR = ColorCodes.merge_request_opened;
            output.TITLE = `[${data.object_attributes.target.path_with_namespace}] Merge Request Opened: ${data.object_attributes.iid} ${data.object_attributes.title}`;
            break;
          case "close":
            output.COLOR = ColorCodes.merge_request_closed;
            output.TITLE = `[${data.object_attributes.target.path_with_namespace}] Merge Request Closed: ${data.object_attributes.iid} ${data.object_attributes.title}`;
            break;
          default:
            output.COLOR = ColorCodes.merge_request_comment;
            console.log("## Unhandled case for Merge Request Hook ", data.object_attributes.action );
            break;
        }
        
        output.FIELDS.push({
          name: "Source --> Target",
          value: `Merge [${data.object_attributes.source.path_with_namespace}: ${data.object_attributes.source_branch}](${data.object_attributes.source.web_url}) into [${data.object_attributes.target.path_with_namespace}: ${data.object_attributes.target_branch}](${data.object_attributes.target.web_url})`
        });
        
        /*if (data.object_attributes.source) {
          output.FIELDS.push({
            name: "Source:",
            value: `[${data.object_attributes.source.path_with_namespace}: ${data.object_attributes.source_branch}](${data.object_attributes.source.web_url} "${data.object_attributes.source.name}")`
          });
        } 

        if (data.object_attributes.target) {
          output.FIELDS.push({
            name: "Target:",
            value: `[${data.object_attributes.target.path_with_namespace}: ${data.object_attributes.target_branch}](${data.object_attributes.target.web_url} "${data.object_attributes.target.name}")`
          });
        }*/
        
        if (data.object_attributes.assignee) {
          output.FIELDS.push({
            name: "Assigned To",
            value: `${data.object_attributes.assignee.username}`
          });
        }
        break;

      case "Wiki Page Hook":
        output.USERNAME = data.user.username;
        output.AVATAR_URL = data.user.avatar_url;
        output.PERMALINK = data.object_attributes.url;
        output.DESCRIPTION =  data.object_attributes.message.substring(0,128);

        output.TITLE = `[${data.project.path_with_namespace}] Wiki Action: ${data.object_attributes.action}`;

        output.FIELDS.push({
            name: "Title",
            value: data.object_attributes.title
          });

        output.FIELDS.push({
            name: "Content",
            value: data.object_attributes.content.substring(0, Math.min(data.object_attributes.content.length, 128))
          });

        break;

      case "Pipeline Hook":
        // TODO https://docs.gitlab.com/ce/user/project/integrations/webhooks.html#pipeline-events
        console.log("# Unhandled case! Pipeline Hook.");
        output.DESCRIPTION =  "**Pipeline Hook** This feature is not yet implemented";
        break;

      case "Build Hook":
        // TODO https://docs.gitlab.com/ce/user/project/integrations/webhooks.html#build-events
        console.log("# Unhandled case! Build Hook.");
        output.DESCRIPTION =  "**Build Hook** This feature is not yet implemented";
        break;
      
      case "Fake Error":
        console.log("# Invoked a Fake Error response.");
        output.DESCRIPTION = data.fake.error;
        
      default:
        // TODO
        console.log("# Unhandled case! ", type);
        output.TITLE = `Type: ${type}`;
        output.DESCRIPTION =  `This feature is not yet implemented`;
        break;
    }
  } catch(e) {
    console.error(e);
    output.TITLE = "ERROR"
    output.DESCRIPTION = "Unable to complete processing data from an HTTP request.  Check console log for details.";
  }
    
  // Send data via webhook
  sendData(output);
}

function sendData(input) {
  
  console.log("sending...");
  
  let embed = {
    color: input.COLOR,
    author: {
      name: input.USERNAME,
      icon_url: input.AVATAR_URL
    },
    title: input.TITLE,
    url: input.PERMALINK,
    description: input.DESCRIPTION,
    fields: input.FIELDS || {},
    timestamp: new Date()
  };
  
  HOOK.send("", {embeds: [embed]})
      .then( (message) => console.log(`Sent embed`))
      .catch(console.log);
  
  //console.log(embed);
}


// Custom Errors
function MyError(message) {
  this.name = 'MyError';
  this.message = message || 'Default Message';
  this.stack = (new Error()).stack;
}
MyError.prototype = Object.create(Error.prototype);
MyError.prototype.constructor = MyError;


/* A function that should use the appropriate decryption scheme for the specified webhook source
 * [Twitter] uses HMAC SHA-256 on a secret+payload, which should be compared to base-64 encoded headers[X-Twitter-Webhooks-Signature]
 * https://dev.twitter.com/webhooks/securing
 * [GitLab] simply sends the user-specified token which should be at least compared in a timing-safe fashion
 * https://gitlab.com/gitlab-org/gitlab-ce/issues/18256
 */
//function decrypt(headers) {
  // Set up our secure token checking object
  //const HMAC = CRYPTO.createHmac( 'sha256', process.env.GITLAB_TOKEN );
  // Hash the data
  //HMAC.update(headers['X-Gitlab-Token'], 'base64');
  // Verify the hash
  //console.log(hmac.digest('base64'));
  //return CRYPTO.timingSafeEqual(hmac.digest('base64'), b);
  //return false;
//}


/* ============================================
 * Bot Commands
 * ========================================= */
const SAMPLE = {
  build: {type: "Build Hook", filename: "sample/build.json"},
  issue: {type: "Issue Hook", filename: "sample/issue.json"},
  merge: {type: "Merge Request Hook", filename: "sample/merge.json"},
  merge_request: {type: "Merge Request Hook", filename: "sample/merge.json"},
  commit_comment: {type: "Note Hook", filename: "sample/note-commit.json"},
  issue_comment: {type: "Note Hook", filename: "sample/note-issue.json"},
  merge_comment: {type: "Note Hook", filename: "sample/note-merge.json"},
  snippet: {type: "Note Hook", filename: "sample/note-snippet.json"},
  pipeline: {type: "Pipeline Hook", filename: "sample/pipeline.json"},
  push: {type: "Push Hook", filename: "sample/push.json"},
  tag: {type: "Tag Push Hook", filename: "sample/tag.json"},
  wiki: {type: "Wiki Hook", filename: "sample/wiki.json"},
  unrelated: {type: "Unrelated", filename: "sample/unrelated.json"},
  fake_error: {type: "Fake Error", filename: "sample/unrelated.json"}
};


const COMMANDS = {
  
  clear: function(msg, arg) {    
    // Get the number of messages (first arg)
    let num = (arg[0]) ? parseInt(arg[0]) : 0;
    if ( !num || num <= 2 || num >= 200 ) {
      // Inform the user that this number is invalid
      msg.reply(`You must specify a number between 2 and 200, exclusive.`)
        .then( (m) => {console.log(`Informed ${msg.author} that the num messages to delete was invalid`)} )
        .catch(console.error);
      // End
      return;
    }
    
    // Get the channel mentioned if it was mentioned, otherwise set to current channel
    let channel = (msg.mentions.channels.size > 0) ? msg.mentions.channels.first() : msg.channel;
    if ( channel.type !== "text" ) {
      // Inform the user that this channel is invalid
      msg.reply(`You must specify a text channel.`)
        .then( (m) => {console.log(`Informed ${msg.author} that the channel ${channel} was an invalid type ${channel.type}`)} )
        .catch(console.error);
      // End
      return;
    }
    
    // Set the number of messages to no more than the size of the channel's message collection
    num = Math.min(num, channel.messages.size);
    if (num <= 2) {
      // Inform the user that there are not enough messages in the channel to bulk delete
      msg.reply(`The channel ${channel} does not have enough messages in it for bulk delete to work. Needs at least 3 messages.`)
        .then( (m) => {console.log(`Informed ${msg.author} that the channel ${channel} had too few messages`)} )
        .catch(console.error);
      // End
      return;
    }
    
    // Check if author is allowed to manage messages (8192 or 0x2000) in specified channel
    if ( channel.permissionsFor(msg.author).has(8192) ) {      
      // Bulk Delete, auto-ignoring messages older than 2 weeks
      channel.bulkDelete( num, true )
        .then( (collection) => { 
          msg.reply(`Successfully deleted ${collection.size} recent messages (from within the past 2 weeks) in ${channel}`)
            .then( (m) => console.log(`Confirmed success of bulk delete in channel ${channel}`) )
            .catch(console.error) 
        } )
        .catch(console.error);
      
    } else {
      // Inform the user that they are not permitted
      msg.reply(`Sorry, but you are not permitted to manage messages in ${channel}`)
        .then( (m) => {console.log(`Informed ${msg.author} that they do not have permission to manage messages in ${channel}`)} )
        .catch(console.error);
    }
  },
  
  embed: function(msg, arg) {
    if ( SAMPLE.hasOwnProperty(arg) ) {      
      FS.readFile(SAMPLE[arg].filename, 'utf8', function (err, data) {
        if (err) {
          console.error(err);
          msg.channel.send(`There was a problem loading the sample data: ${arg}`).catch(console.log);
        } else {
          msg.channel.send(`Sending a sample embed: ${arg}`).catch(console.log);
          processData(SAMPLE[arg].type, JSON.parse(data));
        }        
      });      
    } else {
      msg.channel.send(`Not a recognized argument`).catch(console.log);
    }    
  },
  
  ping: function(msg, arg) {
    msg.channel.send('pong').catch(console.log);
  },
  
  test: function(msg, arg) {
    msg.channel.send('Sending a sample embed').catch(console.log);
    
    let embed = {
      color: 3447003,
      author: {
        name: CLIENT.user.username,
        icon_url: CLIENT.user.avatarURL
      },
      title: 'This is an embed',
      url: 'http://google.com',
      description: `[abcdef](http://google.com "A title") A commit message... -Warped2713`,
      fields: [
        {
          name: 'Fields',
          value: 'They can have different fields with small headlines.'
        },
        {
          name: 'Masked links',
          value: 'You can put [masked links](http://google.com) inside of rich embeds.'
        },
        {
          name: 'Markdown',
          value: 'You can put all the *usual* **__Markdown__** inside of them.'
        }
      ],
      timestamp: new Date(),
      footer: {
        icon_url: CLIENT.user.avatarURL,
        text: '© Example'
      }
    };

    HOOK.send("", {embeds: [embed]})
      .then( (message) => console.log(`Sent test embed`))
      .catch(console.log);
  }
  
};

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
    
    if (!app.listening) {
      // Start listening for HTTP requests
      app.listen(
        CONFIG.webhook.server.port, 
        CONFIG.webhook.server.address,
        () => { 
          console.log( "Ready to listen at ", app.address() );
          readyToReceive = true;
          HOOK.send("Ready to listen for HTTP requests")
            .then( (message) => console.log(`Sent message: ${message.content}`))
            .catch(console.log);
        });
    }
    
  }
  
});

// Create an event listener for messages
CLIENT.on('message', msg => {
  // Only read message if it starts with command prefix
  if (msg.content.startsWith(CONFIG.bot.prefix)) {
    
    // Parse cmd and args
    let [cmd, ...arg] = msg.content.substring(CONFIG.bot.prefix.length).toLowerCase().split(" ");
    
    // Only process command if it is recognized
    if ( COMMANDS.hasOwnProperty(cmd) ) {
      COMMANDS[cmd](msg, arg);
    }
    
  }  
});

CLIENT.on('disconnect', closeEvent => {
  let d = new Date();
  console.log(d.toLocaleString());
  
  if (closeEvent) {
    console.log( CONFIG.bot.name + ' went offline with code ' + closeEvent.code + ": " + closeEvent.reason);
    console.log("Exiting...");
  } else {
    console.log(`${CONFIG.bot.name} went offline with unknown code`);
  }
});

CLIENT.on('reconnecting', () => {
  let d = new Date();
  console.log(d.toLocaleString());
  console.log(`${CONFIG.bot.name} is attempting to reconnect`);
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
CLIENT.login(BOT_SECRET);