# Examples

You can run this standalone server with your app, doing all the configuration needed right here.

Before running, you'll need to open `server.js` and replace
```javascript
var getUser = require('./my-custom-get-user');
```
with a suitable `getUser` function described in the [README](../README.md).


## Running in Heroku

1. Get the repo: `git clone git@github.com:layerhq/node-layer-webhooks-services-sendgrid.git`
2. CD into folder: `cd node-layer-webhooks-services-sendgrid`
3. Create Heroku App: `heroku create`
4. Deploy to Heroku: `git push heroku master`
5. Configure your
   * Layer App ID: `heroku config:set LAYER_APP_ID=YOUR_APP_ID`
   * Layer Authentication Token: `heroku config:set LAYER_BEARER_TOKEN=YOUR_TOKEN`
   * Email hostname: `heroku config:set EMAIL_DOMAIN=YOUR DOMAIN` (e.g. 'sample-mx.mycompany.com'; this will be used as the FROM field in all emails)
   * Sendgrid API Token: `heroku config:set SENDGRID_API=YOUR_SENDGRID_TOKEN`
   * Logger: `heroku config:set 'DEBUG=*,-body-parser:json, -express:*'`
   * Hostname: `heroku config:set HOST=$(heroku apps:info -s  | grep web-url | cut -d= -f2)`
6. Install `heroku-redis`: Instructions at https://devcenter.heroku.com/articles/heroku-redis#installing-the-cli-plugin

You should now be able to send messages, change conversation titles, and see the webhook examples respond.


## Running on Your Server

1. Get the repo: `git clone git@github.com:layerhq/node-layer-webhooks-services-sendgrid.git`
2. CD into folder: `cd node-layer-webhooks-services-sendgrid`
3. Install root dependencies: `npm install`
4. CD into the examples folder: `cd examples`
5. Install example dependencies `npm install`
6. Setup an `ssl` folder with your certificate; your ssl folder should have:
  * server.key
  * server.crt
  * ca.crt
7. Setup your .env file to have the following values:
  * `SENDGRID_API`: Your Sendgrid API Key
  * `EMAIL_DOMAIN`: Your email hostname (e.g. 'sample-mx.mycompany.com'; this will be used as the FROM field in all emails)
  * `HOST`: Your server host name or IP
  * `WEBHOOK_PORT`: The port your server will receive requests on (defaults to 443 if unset)
  * `SENDGRID_PORT`: This is needed if using a self signed certificate; you will need to specify a separate port to listen for webhooks from sendgrid.
  * `LAYER_BEARER_TOKEN`: You can find your Bearer Token on Layer's Developer Dashboard, in the `keys` section.
  * `LAYER_APP_ID`: Your layer app id; you can find this on the same page as your bearer token
  * `REDIS_URL`: Only needed if your not running redis locally.
8. Run the server: `npm start`
