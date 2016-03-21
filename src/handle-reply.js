/**
 * This module receives a request from sendgrid any time it receives an email to the subdomain you've mapped to their server.
 * This module will only handle emails to that subdomain if it has a correctly formatted TO field.
 * Any correctly formed replies will get posted back to the Conversation.
 */

var Debug = require('debug');
var EmailReplyParser = require('emailreplyparser').EmailReplyParser;
var atob = require('atob');
var multer = require('multer')({
  // Block all attached files
  fileFilter: function(req, file, cb) {
    cb(null, false);
  }
}).any();

module.exports = function(options) {
  var sendgrid = require('sendgrid')(options.sendgridKey);
  var queue = require('kue').createQueue();
  if (!options.sApp) options.sApp = options.app;
  var webhookName = options.name;
  var logger = Debug('layer-webhooks-sendgrid:' + webhookName.replace(/\s/g,'-') + ':email-listener');

  // Listen for webhook events and parse the results
  options.sApp.post(options.sendgrid_path || '/new-email', multer, function(req, res) {
    // Extract the conversation.id and the sender's userId from the email's TO field.
    getContext(req.body.to, req.body.from, function(toConversation, fromUser) {

      if (!toConversation || !fromUser) {
        return logger('Email \`To\` field lacks key properties; ignoring email', req.body);
      }

      // Extract the text from the email
      var emailText = req.body.text;

      // GMail may do a line wrapping due to our very long TO field;
      // this line wrapping breaks the EmailReplyParser.
      // Unwrap the line in the email that refers to the to field.
      var lines = emailText.split(/\r?\n/);
      for (var i = 0; i < lines.length; i++) {
        if (lines[i].indexOf(to) === 0) {
          lines[i - 1] += lines[i];
          lines.splice(i, 1);
          break;
        }
      }

      // Get the text of the email, with hidden sections stripped out. (signatures, replies, etc..)
      var text = EmailReplyParser.read(lines.join('\n')).fragments.filter(function(fragment) {
        return !fragment.hidden;
      }).map(function(fragment) {
        return fragment.content;
      }).join('\n');

      // Create a job for sending the response. Done via queue to insure retries in the event that this fails.
      queue.createJob(webhookName + ' post-reply', {
        conversation: toConversation,
        sender: fromUser,
        text: text
      }).attempts(10).backoff({
        type: 'exponential',
        delay: 10000
      }).save(function(err) {
        if (err) {
          console.error(new Date().toLocaleString() + ': ' + webhookName + ': Unable to create Kue process', err);
        }
      });
    });
    res.sendStatus(200);
  });


  // Listen for requests to post the Message to the Conversation
  queue.process(webhookName + ' post-reply', function(job, done) {
    options.client.messages.sendTextFromUser(job.data.conversation, job.data.sender, job.data.text, function(err) {
      if (err) {
        console.error(new Date().toLocaleString() + ': ' + webhookName + ': Failed to post email to Conversation', err);
        done(err);
      } else {
        logger('Response posted to Conversation ', job.data.conversation + ' for ' + job.data.sender + ': ' + job.data.text);
        done();
      }
    });
  });

  /**
   * The Default mechansism for getting the identity of the email sender
   * and comparing it to the actual email reported by sendgrid.
   */
  function getUserFromIdentities(userId, callback) {
    options.client.identities.get(userId, function(err, response) {
      var identity = err ? null : response.body;
      if (identity) identity.email = identity.email_address;
      callback(err, identity);
    });
  }

  /**
   * Get the userId of the message sender, and the Conversation ID.
   * If either is lacking, then we can't post the Message to
   * a Conversation.
   */
  function getContext(toFull, from, callback) {
    var toConversation, fromUser;
    to = toFull.split(/\s*,\s*/).filter(function(recipient) {
      return recipient.indexOf(options.emailDomain) !== -1;
    })[0];

    if (to.indexOf('<') !== -1) to = to.replace(/^.*<(.*?)>.*$/m, '$1');
    to = to.replace(/@.*$/, '');

    if (from.indexOf('<') !== -1) from = from.replace(/^.*<(.*?)>.*$/m, '$1');

    var toObj = JSON.parse(atob(to));
    toConversation = toObj.conversation;
    toUser = toObj.user;
    if (!toUser) {
      callback();
    } else {
      if (!(options.identities instanceof Function)) {
        options.identities = getUserFromIdentities;
      }
      options.identities(toUser, function(err, user) {
        if (user.email !== from) {
          logger('The specified recipient has an email of ' + user.email + ' but message comes from ' + from + '; rejecting email');
          callback();
        } else {
          callback(toConversation, toUser);
        }
      });
    }
  }
};
