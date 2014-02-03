var util = require('util');

var ResponseError = function(msg, options) {
  if(msg) this.message = msg;
  options = options || {};
  this.errorCode = options.errorCode;
  this.statusCode = options.statusCode || options.errorCode || 500;
};

util.inherits(ResponseError, Error);

module.exports = ResponseError;
