/**
 * Sendgrid Module.  See README.md for API details
 */


// Default parameter values
var DEFAULT_PATH = '/sendgrid-unread-messages';
var DEFAULT_NAME = 'Sendgrid Integration';

/**
 * Define the module with options.  Initializes our unread-message handler, and our reply handler.
 * See README.md for details on options.
 */
module.exports = function(options) {
  if (!options.name) options.name = DEFAULT_NAME;
  if (!options.path) options.path = DEFAULT_PATH;
  require('./src/handle-unread-message')(options);
  require('./src/handle-reply')(options);
};