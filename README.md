# Layer Webhooks Service - Sendgrid

This repository contains an integration between [Layer](https://layer.com) messaging service and [Sendgrid](http://sendgrid.com/) email service. It is designed to notify participants about unread messages by sending an email.

## Setting up Sendgrid

The following actions are needed:

1. Obtain an API key.  This key is needed for the `sendgridKey` parameter.
2. Register a subdomain that you can map to `mx.sendgrid.net`.  See https://sendgrid.com/docs/API_Reference/Webhooks/parse.html#-Setup for details.  All emails sent to this subdomain will be received and processed by sendgrid.
3. Register your webhook.  Go to Settings => Inbound Parse, and add your registered subdomain as host, and this web server's url (ending typically with `/new-mail`) as the URL (e.g. 'https://mysampleco.com/new-mail')

## The Full API

The following parameters are supported:

| Name                  | Required  | Description |
|-----------------------|-----------|-------------|
| app                   | Yes       | An express server instance, listening using https protocol. |
| sApp                  | No        | An express server instance listening on a different port.  Used when app is running on a self signed certificate; sendgrid webhooks won't use a self signed certificate, so a separate express server listening on a separate port must be provided in this case. |
| webhookServices                | Yes       | An instance of [Webhook Service Client](https://www.npmjs.com/package/layer-webhooks-services) |
| client                | Yes       | An instance of [Layer Platform API Client](https://www.npmjs.com/package/layer-api) |
| url                   | Yes       | URL that this server is on; omit paths. Used in combination with the `path` property to register your webhook. |
| delay                 | Yes       | How long to wait before checking for unread messages and notifiying users.  Delays can be configured using a number representing miliseconds, or a string such as '10 minutes' or other strings parsable by [ms](https://github.com/rauchg/ms.js) |
| secret                | Yes       | Any unique string that nobody outside your company knows; used to validate webhook requests |
| sendgridKey           | Yes       | Your sendgrid API Key |
| emailDomain           | Yes       | Full hostname registered with sendgrid; all From fields will use this when sending emails. |
| getUser               | Yes       | Function that looks up a user's info and returns the results via callback |
| templates             | No        | Templates Object for the message, subject and sender |
| name                  | No        | Name to assign the webhook; needed if your using this repository for multiple webhooks. |
| path                  | No        | Path that the express app will use to listen for unread message webhook requests. Customize if using multiple copies of this repo. |
| sendgrid_path         | No        | Path that the express app will use to listen for new email webhook requests. |
| recipient_status_filter | No      | Array of user states that justify notification; `['sent']` (Message could not be delivered yet); `['sent', 'delivered']` (Message is undelivered OR simply unread); `['delivered']` (Message is delivered but not read). Default is `['sent', 'delivered']` |
| updateObject          | No        | Asynchronous callback for decorating the Message object being fed into the templates |


### getUser(userId, callback)

<<<<<<< HEAD
<<<<<<< HEAD
Layer's Webhooks do not provide key values needed to drive email services.  In order to send users an email, An email address must be provided.  The default behavior is to automatically get the address from the Layer's Identities service; however, this only works if you've actually registered your user's address there.

If you are not using the Layer Identities service and putting email addresses there, then provide a `identities` function when configuring this module. The `identities` function should return a User Object.  Your User Object should provide `name` and `email` fields; other custom fields can be added and used from your templates.

```javascript
function identities(userId, callback) {
    // Lookup in a database or query a web service to get details of this user
    doLookup(userId, function(err, result) {
       callback(error, {
          email: result.myEmail,
          name: result.first_name + ' ' + result.last_name,
          misc: result.favorite_color
       });
    });
}
```

### updateObject(message, callback)

To add additional information to your Message object before its passed through your templates, you can add the optional `updateObject` parameter:

```javascript
require('layer-webhooks-service-sendgrid')({
    ...,
    updateObject: function(message, callback) {
        message.fieldA = 'value A';
        callback(message);
    }
});
```
You can then have a template string that contains `You have a <%= fieldA %> from <%= sender.name %>`.

## Templates

Templates use [Underscore JS Templates](http://underscorejs.org/#template).  The following template parameters can be provided:

* `textTemplate`: A text-only version of your email message
* `htmlTemplate`: An html versin of your email message
* `subjectTemplate`: The subject line for your email
* `fromNameTemplate`: The display name for the sender, but NOT the email address of the sender of the email.

Each of these templates should expect to run on a Message Object as defined by the [Layer Webhooks Docs](https://developer.layer.com/docs/webhooks/payloads#message-sent).

In addition, the following properties will be added:

* `sender` Object: This will be an object returned from Layer's Identity Service _or_ an object you provide via an `identities` call on the sender of this Message.
* `recipient` Object: This will be an object returned from Layer's Identity Service _or_ an object you provide via an `identities` call on a single recipient
* `text` String: This will extract any text/plain parts and concatenate their body's together into an easily accessed string

A typical template might look like:

```json
{
    "textTemplate": "Hello <%= recipient.name %>;\n\nYou have an unread message from <%= sender.name %>:\n<%= text %>\n\nSincerely\nYour Bot",
    "htmlTemplate": "<body>Hello <%= recipient.name %>;<br/><br/>nYou have an unread message from <b><%= sender.name %></b>:<div><%= text %></div>Sincerely<br/>Your Bot</body>",
    "subject": "You have Failed! Failed, to read <%= text =>",
    "fromNameTemplate": "Lord <%= sender.name %> King of this Email"
}
```

<<<<<<< HEAD
<<<<<<< HEAD
## The Full API

The following parameters are supported:

| Name                  | Required  | Description |
|-----------------------|-----------|-------------|
| app                   | Yes       | An express server instance, listening using https protocol. |
| sApp                  | No        | An express server instance listening on a different port.  Used when app is running on a self signed certificate; sendgrid webhooks won't use a self signed certificate, so a separate express server listening on a separate port must be provided in this case. |
| webhookServices                | Yes       | An instance of [Webhook Service Client](https://www.npmjs.com/package/layer-webhooks-services) |
| client                | Yes       | An instance of [Layer Platform API Client](https://www.npmjs.com/package/layer-api) |
| url                   | Yes       | URL that this server is on; omit paths. Used in combination with the `path` property to register your webhook. |
| delay                 | Yes       | How long to wait before checking for unread messages and notifiying users.  Delays can be configured using a number representing miliseconds, or a string such as '10 minutes' or other strings parsable by [ms](https://github.com/rauchg/ms.js) |
| secret                | Yes       | Any unique string that nobody outside your company knows; used to validate webhook requests |
| sendgridKey           | Yes       | Your sendgrid API Key |
| emailDomain           | Yes       | Full hostname registered with sendgrid; all From fields will use this when sending emails. |
| identities            | Yes       | Function that looks up a user's info and returns the results via callback |
| templates             | No        | Templates Object for the message, subject and sender |
| name                  | No        | Name to assign the webhook; needed if your using this repository for multiple webhooks. |
| path                  | No        | Path that the express app will use to listen for unread message webhook requests. Customize if using multiple copies of this repo. |
| sendgrid_path         | No        | Path that the express app will use to listen for new email webhook requests. |
| reportForStatus       | No        | Array of user states that justify notification; `['sent']` (Message could not be delivered yet); `['sent', 'delivered']` (Message is undelivered OR simply unread); `['delivered']` (Message is delivered but not read). Default is `['sent', 'delivered']` |
| updateObject          | No        | Asynchronous callback for decorating the Message object being fed into the templates |

### The updateObject method

To add additional information to your Message object before its passed through your templates, you can add the optional `updateObject` parameter:

```javascript
require('layer-webhooks-service-sendgrid')({
    ...,
    updateObject: function(message, callback) {
        message.fieldA = 'value A';
        callback(message);
    }
});
```
You can then have a template string that contains `You have a <%= fieldA %> from <%= sender.name %>`.


## Example

```javascript
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

var getUser = require('./my-custom-get-user');

secureExpressApp.listen(PORT, function() {
    require('layer-webhooks-service-sendgrid')({
        client: webhooksClient,
        url: 'https://mydomain.com',
        app: secureExpressApp,
        delay: '30 minutes',
        secret: 'Lord of the Mog has jammed your radar',
        sendgridKey: 'abcdef',
        templates: {
            text: 'Yo <%= recipient.name %>! Read your Messages Dude!\n\n<%= sender.name %> said "<%= text %>" to you and you totatally ignored him!'
        }
    });
});
```
