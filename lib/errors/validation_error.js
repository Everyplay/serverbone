var _ = require('lodash');
var util = require('util');
var BaseError = require('./base_error');

// convert errors given by jsonschema
function getErrorMessage(errors) {
  if (_.isArray(errors)) {
    return _.uniq(_.pluck(errors, 'stack')).join().replace(/instance./g, '');
  } else if (errors) {
    return errors.message;
  }
}

var ValidationError = function(options) {
  var description;
  if (_.isString(options)) {
    description = options;
    options = {};
  }
  options.statusCode = options.statusCode || 400;
  options.description = description || getErrorMessage(options.errors);
  var msg = 'validation_error';
  ValidationError.super_.call(this, msg, options);
};

util.inherits(ValidationError, BaseError);

module.exports = ValidationError;