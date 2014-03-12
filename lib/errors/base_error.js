var util = require('util');

var error = 'Error message should be defined';
var description = '';

var code = 500;

var BaseError = function(msg, options) {
  options = options || {};
  this.message = msg || options.msg || error;
  this.errorCode = options.errorCode;
  this.statusCode = options.statusCode || options.errorCode || code;
};

util.inherits(BaseError, Error);

BaseError.prototype.toJSON = function() {
  return {
    error: this.message,
    error_description: description,
    status: this.statusCode
  };
};

module.exports = BaseError;