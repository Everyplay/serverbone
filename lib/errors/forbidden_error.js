var util = require('util');
var BaseError = require('./base_error');

var error = 'forbidden';
var description = "The resource owner or authorization server denied the " +
  "request.";
var code = 403;

var ForbiddenError = function(msg, options) {
  options = options || {};
  this.message = msg || options.msg || error;
  this.errorCode = options.errorCode;
  this.statusCode = options.statusCode || options.errorCode || code;
};

util.inherits(ForbiddenError, BaseError);

module.exports = ForbiddenError;