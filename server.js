/*
 * HTTP request handling based on
 * https://blog.kyletolle.com/using-node-js-to-inspect-webhook-calls/
 * Test it in a second client with cURL
 * curl -X POST localhost:9000 -H 'Content-Type: application/json' -d '{"payload":"test"}'
 * curl -i -X POST localhost:9000 -H "Content-Type: application/json" --data-binary "test.json"
 */

// Import the CRYPTO module for verifying tokens from HTTP request headers
const CRYPTO = require('crypto');
// Import the HTTP module for sending and receiving data
const HTTP = require('http');
// Import CONFIG file
const CONFIG = require('./require/config.json');
const SECRET = CONFIG.webhook.token || process.env.GITLAB_TOKEN || "";

// Create our local webhook-receiving server
var app = HTTP.createServer(handler);
var statusCode = 200;
app.listen(
  CONFIG.webhook.server.port, 
  CONFIG.webhook.server.address,
  () => { 
    console.log( "Ready to listen at ", app.address() );
  });

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
    USERNAME: data.user_name,
    AVATAR_URL: data.user_avatar,
    TITLE: "",
    PERMALINK: data.project.web_url,
    DESCRIPTION: "",
    FIELDS: null
  };
  
  switch(type) {
      
    case "Push Hook":
      output.COLOR = ColorCodes.commit;
      
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
          output.DESCRIPTION += `[${data.commits[i].id.substring(0,8)}](${data.commits[i].url} ${changelog}) `;
          output.DESCRIPTION += `${data.commits[i].message.substring(0,32)}... - ${data.commits[i].author.name}`;
          output.DESCRIPTION +=  `\n`;
        }
      }      
      break;
      
    case "Tag Push Hook":
      // TODO https://docs.gitlab.com/ce/user/project/integrations/webhooks.html#tag-events
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
      output.DESCRIPTION =  data.object_attributes.note.substring(0,128);
      output.PERMALINK = data.object_attributes.url;
      
      switch( data.object_attributes.noteable_type ) {
        
        case: "commit":
        case: "Commit":
          output.COLOR = ColorCodes.commit;
          output.TITLE = `[${data.project.path_with_namespace}] New Comment on Commit ${data.commit.id.substring(0,8)}`;
          output.FIELDS.push({
            name: "Commit Message:",
            value: data.commit.message;
          });
          output.FIELDS.push({
            name: "Commit Author:",
            value: data.commit.author.name;
          });
          output.FIELDS.push({
            name: "Commit Timestamp:",
            value: data.commit.timestamp;
          });          
          break;
          
        case: "merge_request":
        case: "MergeRequest":
          output.COLOR = ColorCodes.merge_request_comment;
          output.TITLE = `[${data.project.path_with_namespace}] New Comment on Merge Request ${data.merge_request.iid}`;
          output.FIELDS.push({
            name: "Merge Request:",
            value: data.merge_request.title;
          });
          output.FIELDS.push({
            name: "Source --> Target",
            value: `${data.merge_request.source.path_with_namespace}:${data.merge_request.source_branch} ---> ${data.merge_request.target.path_with_namespace}:${data.merge_request.target_branch}`;
          });
          output.FIELDS.push({
            name: "Assigned To:",
            value: data.merge_request.assignee.username;
          });     
          break;
          
        case: "issue":
        case: "Issue":
          output.COLOR = ColorCodes.issue_comment;
          output.TITLE = `[${data.project.path_with_namespace}] New Comment on Issue #${data.issue.iid} ${data.issue.title}`;
          break;
          
        case: "snippet":
          // TODO https://docs.gitlab.com/ce/user/project/integrations/webhooks.html#comment-on-code-snippet
          console.log("## Unhandled case for Note Hook ", data.object_attributes.noteable_type );
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
          output.TITLE = `[${data.project.path_with_namespace}] Merge Request Opened: ${data.object_attributes.iid} ${data.object_attributes.title}`;
          break;
        case "close":
          output.COLOR = ColorCodes.merge_request_closed;
          output.TITLE = `[${data.project.path_with_namespace}] Merge Request Closed: ${data.object_attributes.iid} ${data.object_attributes.title}`;
          break;
        default:
          output.COLOR = ColorCodes.merge_request_comment;
          console.log("## Unhandled case for Merge Request Hook ", data.object_attributes.action );
          break;
      }
      
      if (data.object_attributes.assignee) {
        output.FIELDS.push({
          name: "Assigned To:",
          value: `${data.object_attributes.assignee.username}`
        });
      }
      
      if (data.object_attributes.source) {
        output.FIELDS.push({
          name: "Source:",
          value: `[${data.object_attributes.source.path_with_namespace}](${data.object_attributes.source.web_url} ${data.object_attributres.source.name})`
        });
      } 
      
      if (data.object_attributes.target) {
        output.FIELDS.push({
          name: "Target:",
          value: `[${data.object_attributes.target.path_with_namespace}](${data.object_attributes.target.web_url} ${data.object_attributres.target.name})`
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
          value: data.object_attributes.title;
        });
      
      output.FIELDS.push({
          name: "Content:",
          value: data.object_attributes.content.substring(0, Math.min(data.object_attributes.content.length, 128));
        });
      
      break;
      
    case "Pipeline Hook":
      // TODO https://docs.gitlab.com/ce/user/project/integrations/webhooks.html#pipeline-events
      console.log("# Unhandled case! Pipeline Hook.");
      break;
      
    case "Build Hook":
      // TODO https://docs.gitlab.com/ce/user/project/integrations/webhooks.html#build-events
      console.log("# Unhandled case! Build Hook.");
      break;
      
    default:
      // TODO
      console.log("# Unhandled case! ", type);
      break;
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
  
  /*HOOK.send({embed: embed})
      .then( (message) => console.log(`Sent message: ${message.content}`))
      .catch(console.log);*/
  console.log(embed);
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


