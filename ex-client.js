/* Sample Client Request from NodeJS docs
 * https://nodejs.org/dist/latest-v7.x/docs/api/http.html#http_http_request_options_callback
 */
// Import the HTTP module for sending and receiving data
const HTTP = require('http');
const querystring = require('querystring');

// Import CONFIG file
const CONFIG = require('./require/config.json');
const SECRET = CONFIG.webhook.token || process.env.DGW_WEBHOOK_TOKEN || "";

const postDataJSON_QS = querystring.stringify(
  {
  msg: "Hello World!"
  }
);
const postDataTextJSON = `{ "words": "Hello Alternate Reality!" }`;
const postDataText = "I am a string!";
const postDataJSON = JSON.stringify({ msg: "Hello World!" });

const options = function(type, data) {
  return {
    hostname: CONFIG.webhook.server.address,
    port: CONFIG.webhook.server.port,
    path: '',
    method: 'POST',
    headers: {
      'Content-Type': type,
      'Content-Length': Buffer.byteLength(data),
      'X-GitLab-Token': SECRET,
      'X-GitLab-Event': "Test",
    }
  };
};

const resHandler = function(res) {
  console.log(`STATUS: ${res.statusCode}`);
  console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
  res.setEncoding('utf8');
  res.on('data', (chunk) => {
    console.log(`BODY: ${chunk}`);
  });
  res.on('end', () => {
    console.log('No more data in response.');
  });
};

const errHandler = function(e) {
  console.error(`problem with request: ${e.message}`);
};

// JSON
let req1 = HTTP.request(options("application/json", postDataJSON), resHandler );
req1.on('error', errHandler);
req1.write(postDataJSON);
req1.end();

// Text JSON
let req2 = HTTP.request(options("text/plain", postDataTextJSON), resHandler );
req2.on('error', errHandler);
req2.write(postDataTextJSON);
req2.end();

// Text
let req3 = HTTP.request(options("text/plain", postDataText), resHandler );
req3.on('error', errHandler);
req3.write(postDataText);
req3.end();

// Text that is really JSON
let req4 = HTTP.request(options("text/plain", postDataJSON), resHandler );
req4.on('error', errHandler);
req4.write(postDataJSON);
req4.end();

// An "image" that is really Text
let req5 = HTTP.request(options("image/png", "I am an image fufufu"), resHandler );
req5.on('error', errHandler);
req5.write("I am an image fufufu");
req5.end();

// An "image" that is really JSON
let req6 = HTTP.request(options("image/png", postDataJSON), resHandler );
req6.on('error', errHandler);
req6.write(postDataJSON);
req6.end();

// A QueryString of an object
let req7 = HTTP.request(options("application/json", postDataJSON_QS), resHandler );
req7.on('error', errHandler);
req7.write(postDataJSON_QS);
req7.end();