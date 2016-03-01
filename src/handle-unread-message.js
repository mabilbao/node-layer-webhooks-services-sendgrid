/**
 * This module handles unread messages and emails any recipient who hasn't read the message.
 * See README for description of parameters.
 */
var btoa = require('btoa');
var _ = require('underscore');

var DEFAULT_TEMPLATES = {
  text: 'Hello <%= recipient.name %>;\nYou have an unread message from <%= sender.name %>:\n<%= text %>\n\n> Replies will be posted back to this Conversation',
  html: '<body><div style="font-size: 1.2em; margin-bottom: 10px">Hello <%= recipient.name %></div><div>You have an unread message from <b><%= sender.name %></b></div><div style="padding:10px; border-left: solid 1px #666;"><%= text %></div><br/><br/>&gt; Replies will be posted back to this Conversation</body>',
  subject: 'Unread message from <%= sender.name %>',
  name: '<=% sender.name %>'
};

module.exports = function(options) {
  var sendgrid  = require('sendgrid')(options.sendgridKey);
  var queue = require('kue').createQueue();
  if (!options.templates) options.templates = {};
  var templates = {
    text: _.template(options.templates.text || DEFAULT_TEMPLATES.text),
    html: _.template(options.templates.html || DEFAULT_TEMPLATEs.html),
    subject: _.template(options.templates.subject || DEFAULT_TEMPLATES.subject),
    fromName: _.template(options.templates.fromName || DEFAULT_TEMPLATES.name)
  };
  if (!options.delay) options.delay = '1 hour';

  // Define the receipts webhook structure
  var hook = {
    name: options.name,
    path: options.path,

    // These events are needed for the register call
    events: ['message.sent', 'message.read', 'message.delivered', 'message.deleted'],

    // Wait the specified period and then check if they have read the message
    delay: options.delay,

    receipts: {
      // Any user whose recipient status is 'sent' or 'delivered' (not 'read')
      // is of interest once the delay has completed.
      // Change to 'sent' to ONLY send notifications when a message wasn't delivered.
      recipient_status_filter: options.recipient_status_filter || ['sent', 'delivered']
    }
  };

  // Register the webhook with Layer's Services
  options.webhookServices.register({
    secret: options.secret,
    url: options.url,
    hooks: [hook]
  });

  // Listen for events from Layer's Services
  options.webhookServices.receipts({
    expressApp: options.app,
    secret: options.secret,
    hooks: [hook]
  });

  // Any Messages that are unread by any participants will be passed into this job
  // after the delay specified above has passed.
  queue.process(hook.name, function(job, done) {
    var message = job.data.message;
    var recipients = job.data.recipients;
    processMessage(message, recipients, done);
  });

  /**
   * Any Message with unread participants will call processMessage to handle it.
   * This will iterate over all unread recipients, gather the necessary info and call prepareEmail.
   */
  function processMessage(message, recipients, done) {
    options.getUser(message.sender.user_id, function(err, sender) {
      var count = 0;
      recipients.forEach(function(recipient) {
        options.getUser(recipient, function(err, user) {
          count++;
          try {
            if (err) console.error(hook.name + ': ', err);
            else {
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
		  console.error(new Date().toLocaleString() + ': ' + webhookName + ': Unable to create Kue process', err);
		}
	      });
            }
          } catch(e) {
            console.error(hook.name + ': ', e);
          }
          if (count === recipients.length) {
            done();
          }
        });
      });
    });
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

    console.log(hook.name + ': Sending email to ' + job.data.user.email + ' for not reading message');
    var fromAddress = btoa(JSON.stringify({
      conversation: message.conversation.id,
      user: job.data.userId
    }));

    if (options.updateObject) {
      options.updateObject(message, function(message) {
        sendEmail(message, job.data.user.email, fromAddress + '@' + options.emailDomain, done);
      });
    } else {
      sendEmail(message, job.data.user.email, fromAddress + '@' + options.emailDomain, done);
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
       return console.error(hook.name + ': ', err);
     }
     done(err);
   });
  }
};