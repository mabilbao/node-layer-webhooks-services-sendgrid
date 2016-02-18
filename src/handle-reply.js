/**
 * This module receives a request from sendgrid any time it receives an email to the subdomain you've mapped to their server.
 * This module will only handle emails to that subdomain if it has a correctly formatted TO field.
 * Any correctly formed replies will get posted back to the Conversation.
 */
//var multiparty = require('multiparty');

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

  // Listen for webhook events and parse the results
  options.sApp.post(options.sendgrid_path || '/new-email', multer, function(req, res) {
    try {
      // Extract the conversation.id and the sender's userId from the email's TO field.
      var toConversation, fromUser;
      try {
        var to = req.body.to.split(/\s*,\s*/).filter(function(to) {
          return to.indexOf(options.emailDomain) !== -1;
        })[0];

        if (to.indexOf('<') !== -1) to = to.replace(/^.*<(.*?)>.*$/m, '$1');
        to = to.replace(/@.*$/, '');
        var toObj = JSON.parse(atob(to));
        toConversation = toObj.conversation;
        fromUser = toObj.user;
        if (!toConversation || !fromUser) throw new Error('To field lacks key properties');
      } catch (e) {
        console.error(new Date().toLocaleString() + ': ' + webhookName + ': Failed to parse to field: ' + req.body.to, e);
        return res.sendStatus(200);
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
    } catch (err) {
      console.error(new Date().toLocaleString() + ': ' + webhookName + ': Failed to parse email:', err);
    }
    res.sendStatus(200);
  });


  // Listen for requests to post the Message to the Conversation
  queue.process(webhookName + ' post-reply', function(job, done) {
    options.client.messages.sendTextFromUser(job.data.conversation, job.data.sender, job.data.text, function(err) {
      if (err) {
        console.error(new Date().toLocaleString() + ': ' + webhookName + ': Failed to post email to Conversation', err);
        done(err);
      } else {
        console.log(new Date().toLocaleString() + ': ' + webhookName + ': Response posted to Conversation ',
          job.data.conversation + ' for ' + job.data.sender + ': ' + job.data.text);
        done();
      }
    });
  });
};