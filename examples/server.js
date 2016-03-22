// Setup the express server
require('dotenv').load();

var express = require('express');
var https = require('https');
var fs = require('fs');
var app = express();

var getUser = require('./my-custom-get-user');

// If using a separate server for listening to sendgrid, create the new server. Typically needed when using a self-signed certificate
// as sendgrid will not talk to it... but will talk to an http server.
if (process.env.SENDGRID_PORT) {
  var sApp = express();
}

// Setup environmental variables
if (!process.env.LAYER_BEARER_TOKEN) return console.error('LAYER_BEARER_TOKEN missing in your environmental variables');
if (!process.env.LAYER_APP_ID) return console.error('LAYER_APP_ID missing in your environmental variables');
if (!process.env.SENDGRID_API) return console.error('SENDGRID_API missing in your environmental variables');

var PORT = process.env.WEBHOOK_PORT || '443';
var HOST = process.env.HOST || 'localhost';
var URL  = ((HOST.indexOf('https://') === 0) ? HOST : 'https://' + HOST).replace(/\/$/, '') + ':' + PORT;

// Setup Redis and kue
var redis = require('redis').createClient(process.env.REDIS_URL);
var queue = require('kue').createQueue({
  jobEvents: false,
  redis: process.env.REDIS_URL
});

// Setup the Layer Webhooks Service
var LayerWebhooks = require('layer-webhooks-services');
var webhooksClient = new LayerWebhooks({
  token: process.env.LAYER_BEARER_TOKEN,
  appId: process.env.LAYER_APP_ID,
  redis: redis
});

// Setup the Layer Platform API
var LayerClient = require('layer-api');
var layerClient = new LayerClient({
  token: process.env.LAYER_BEARER_TOKEN,
  appId: process.env.LAYER_APP_ID,
});

// Presumably you either have the ssl folder setup... or your running on
// heroku where its not required, and we can just use the app variable.
var key, cert, ca, secureServer;
try {
  key = fs.readFileSync('./ssl/server.key');
  cert= fs.readFileSync('./ssl/server.crt');
  ca  = fs.readFileSync('./ssl/ca.crt');
  secureServer = https.createServer({
    key: key,
    cert: cert,
    ca: ca,
    requestCert: true,
    rejectUnauthorized: false
  }, app);
} catch(e) {
  console.log('SSL folder not found; assume heroku environment');
  secureServer = app;
}

// Startup the server; allow for a custom heroku PORT
secureServer.listen(process.env.PORT || PORT, function() {
  console.log('Secure Express server listening on port ' + PORT);
  if (sApp) {
    sApp.listen(process.env.SENDGRID_PORT, function() {
      console.log('Insecure express server listening on port ' + process.env.SENDGRID_PORT);
      init();
    });
  } else {
    init();
  }
});

/* This optional parameter allows you to annotate the object that will be used by your templates.
 * This example adds the full Conversation so we can get the Conversation name.
 * A more optimal implementation of this would subscribe to conversation metadata
 * change webhook events, and maintain a local database of Conversations rather than
 * repeatedly hitting Layer's servers.
 */
function updateObject(message, callback) {
  layerClient.conversations.get(message.conversation.id, function(err, res) {
    if (err) {
      console.error('Failed to load Conversation to get its name', err);
      message.conversation.metadata = {conversationName: 'Unnamed Conversation'};
    } else {
      message.conversation = res.body;
    }
    callback(message);
  })
}

/* Initialize the layer-sendgrid webhooks server */
function init() {
  require('../index')({
    layer: {
      webhookServices: webhooksClient,
      client: layerClient,
      secret: 'Lord of the Mog has jammed your radar'
    },
    server: {
      url: URL,
      app: app,
      sApp: sApp,
    },
    sendgrid: {
      emailDomain: process.env.EMAIL_DOMAIN,
      key: process.env.SENDGRID_API,
    },
    delay: '30 minutes',
    templates: {
      text: '<%= recipient.name %>: you have a new message in <%= conversation.metadata.conversationName %>:\n<%= sender.name %>: <%= text %>\n\n> Replies will be posted back to this Conversation',
      html: '<body><div style="font-size: 1.2em; margin-bottom: 10px">Hello <%= recipient.name %></div><div>You have a new Message in <b><%= conversation.metadata.conversationName %></b></div><div style="padding:10px; border-left: solid 1px #666;"><b><%= sender.name %></b>: <%= text %></div><br/><br/>&gt; Replies will be posted back to this Conversation</body>',
      subject: 'New message in <%= conversation.metadata.conversationName %> from <%= sender.name %>. Read it or be spammed.',
      fromName: 'Lord <%= sender.name %>, Guardian of the Mog and his own best friend'
    },
    updateObject: updateObject
  });
}
