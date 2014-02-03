var util = require('util');

var NotFound = exports.NotFound = function (msg, constr) {
  Error.captureStackTrace(this, constr || this);
  this.message = msg || 'Not Found';
  this.status = 404;
};

util.inherits(NotFound, Error);
NotFound.prototype.name = 'NotFoundError';

var AccessDenied = exports.AccessDenied = function (msg, constr) {
  Error.captureStackTrace(this, constr || this);
  this.message = msg || 'Access Denied';
  this.status = 403;
};

util.inherits(AccessDenied, Error);
AccessDenied.prototype.name = 'AccessDeniedError';
