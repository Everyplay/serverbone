var util = require('util');

var error = 'Error message should be defined';
var description = '';

var code = 500;

var BaseError = function(msg, options) {
  options = options || {};
  this.message = this.message || msg || options.msg || error;
  this.errorCode = this.errorCode || options.errorCode;
  this.statusCode = this.statusCode || options.statusCode || options.errorCode || code;
  this.description = this.description || options.description || description;
  Error.call(this, this.message);
  Error.captureStackTrace(this, this);
};

util.inherits(BaseError, Error);

BaseError.prototype.toJSON = function() {
  return {
    error: this.message,
    error_description: this.description,
    error_code: this.errorCode || this.statusCode,
    status: this.statusCode
  };
};

module.exports = BaseError;
