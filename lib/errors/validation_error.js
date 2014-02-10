var _ = require('lodash');
var util = require('util');
var ResponseError = require('./response_error');

// convert errors given by jsonschema
function getErrorMessage(errors) {
  if (_.isArray(errors)) {
    return _.pluck(errors, 'stack').join().replace(/instance./g, '');
  } else if (errors) {
    return errors.message;
  }
}

var ValidationError = function(options) {
  var msg;
  if (_.isString(options)) {
    msg = options;
    options = {};
  }
  options.statusCode = options.statusCode || 400;
  msg = msg || getErrorMessage(options.errors);
  ValidationError.super_.call(this, msg, options);
};

util.inherits(ValidationError, ResponseError);

module.exports = ValidationError;