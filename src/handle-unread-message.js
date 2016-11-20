/**
 * This module handles unread messages and emails any recipient who hasn't read the message.
 * See README for description of parameters.
 */
var btoa = require('btoa');
var Debug = require('debug');
var _ = require('underscore');

var DEFAULT_TEMPLATES = {
  text: 'Hello <%= recipient.name %>;\nYou have an unread message from <%= sender.name %>:\n<%= text %>\n\n> Replies will be posted back to this Conversation',
  html: '<body><div style="font-size: 1.2em; margin-bottom: 10px">Hello <%= recipient.name %></div><div>You have an unread message from <b><%= sender.name %></b></div><div style="padding:10px; border-left: solid 1px #666;"><%= text %></div><br/><br/>&gt; Replies will be posted back to this Conversation</body>',
  subject: 'Unread message from <%= sender.name %>',
  name: '<=% sender.name %>'
};


module.exports = function(options) {
  var sendgrid  = require('sendgrid')(options.sendgrid.key);
  var queue = require('kue').createQueue();
  if (!options.templates) options.templates = {};
  var templates = {
    text: _.template(options.templates.text || DEFAULT_TEMPLATES.text),
    html: _.template(options.templates.html || DEFAULT_TEMPLATES.html),
    subject: _.template(options.templates.subject || DEFAULT_TEMPLATES.subject),
    fromName: _.template(options.templates.fromName || DEFAULT_TEMPLATES.name)
  };
  if (!options.delay) options.delay = '1 hour';
  var logger = Debug('layer-webhooks-sendgrid:' + options.name.replace(/\s/g,'-') + ':email-notifier');

  // Define the receipts webhook structure
  var hook = registerHooks();

  // Any Messages that are unread by any participants will be passed into this job
  // after the delay specified above has passed.
  queue.process(hook.name, function(job, done) {
    var message = job.data.message;
    var recipients = job.data.recipients;
    var identities = job.data.identities;

    processMessage(message, recipients, identities, done);
  });

  function simplifyIdentity(identity) {
    if (typeof options.identities !== 'function') {
      return {
        displayName: identity.display_name,
        avatarUrl: identity.avatar_url,
        firstName: identity.first_name,
        lastName: identity.last_name,
        email: identity.email_address,
        phone: identity.phone_number,
        metadata: identity.metadata
      };
    } else {
      return identity;
    }
  }

  /**
   * Any Message with unread participants will call processMessage to handle it.
   * This will iterate over all unread recipients, gather the necessary info and call prepareEmail.
   */
  function processMessage(message, recipients, identities, done) {
    var sender = simplifyIdentity(identities[message.sender.user_id] || {});
    var count = 0;
    recipients.forEach(function(recipient) {
      var user = simplifyIdentity(identities[recipient] || {});
      queue.createJob(hook.name + ' send-email', {
        message: message,
        sender: sender,
        user: user,
        userId: recipient
      }).attempts(10).backoff({
        type: 'exponential',
        delay: 10000
      }).save(function(err) {
        if (err) {
          console.error(new Date().toLocaleString() + ': ' + hook.name + ': Unable to create Kue process', err);
        }
      });
    });
    done();
  }


  /**
   * Calculate all the fields needed, and if present call the updateObject method.  Then call sendEmail.
   */
  queue.process(hook.name + ' send-email', function(job, done) {
    var message = job.data.message;
    message.sender = job.data.sender;
    message.recipient = job.data.user;
    message.text = message.parts.filter(function(part) {
      return part.mime_type === 'text/plain';
    }).map(function(part) {
      return part.body;
    }).join('\n');
    var email = job.data.user.email;

    if (!email) {
      logger('Recipient ' + job.data.userId + ' does not have an email address');
      return done();
    }

    logger('Recipient ' + job.data.userId + ' is getting an email at ' + email + ' for not reading message');
    var fromAddress = btoa(JSON.stringify({
      conversation: message.conversation.id,
      user: job.data.userId
    }));

    if (options.updateObject) {
      options.updateObject(message, function(message) {
        sendEmail(message, email, fromAddress + '@' + options.sendgrid.emailDomain, done);
      });
    } else {
      sendEmail(message, email, fromAddress + '@' + options.sendgrid.emailDomain, done);
    }
  });

  /**
   * Send the specified email using templates where suited to populate the fields.
   */
  function sendEmail(message, to, from, done) {
   sendgrid.send({
     to: to,
     from: from,
     fromname: templates.fromName(message),
     subject: templates.subject(message),
     text: templates.text(message),
     html: templates.html(message)
   }, function(err, json) {
     if (err) {
       return console.error(new Date().toLocaleString() + ': ' + hook.name + ': ', err);
     }
     done(err);
   });
  }

  function registerHooks() {
    var hook = {
      name: options.name,
      path: options.server.unreadMessagePath,

      // These events are needed for the register call
      events: ['message.sent', 'message.read', 'message.delivered', 'message.deleted'],

      // Wait the specified period and then check if they have read the message
      delay: options.delay,

      receipts: {
        // Any user whose recipient status is 'sent' or 'delivered' (not 'read')
        // is of interest once the delay has completed.
        // Change to 'sent' to ONLY send notifications when a message wasn't delivered.
        reportForStatus: options.reportForStatus || ['sent', 'delivered'],
        identities: 'identities' in options ? options.identities : true
      }
    };

    // Register the webhook with Layer's Services
    options.layer.webhookServices.register({
      secret: options.layer.secret,
      url: options.server.url,
      hooks: [hook]
    });

    // Listen for events from Layer's Services
    options.layer.webhookServices.receipts({
      expressApp: options.server.app,
      secret: options.layer.secret,
      hooks: [hook]
    });

    return hook;
  };
};
