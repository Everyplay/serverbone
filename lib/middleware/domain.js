var domain = require('domain');
var debug = require('debug')('epm:middleware:domain');

/**
 * express error domain, handles any uncaught exceptions thrown after this middleware.
 *
 * Calls next(err); for any exceptions not caught and forward them to the proper express error handler.
 * Purpose is to isolate errors and handle them gracefully for this application and not let them to take down
 * any other possible apps running in the same process.
 *
 * With this middleware it is safe to throw from asynchronous blocks to get the error to express error handler.
 *
 * @return {Function}
 */
module.exports = function() {
  return function(req, res, next) {
    var requestDomain = domain.create();
    debug('creating request domain for request to %s',req.url);
    req.on('finish', function() {
      debug('request to %s finished, disposing domain',req.url);
      requestDomain.dispose();
    });
    res.on('close', function() {
      debug('response to %s closed, disposing domain',req.url);
      requestDomain.dispose();
    });
    requestDomain.on('error', function(err) {
      debug('rrequest to %s errored, calling next with error',req.url);
      requestDomain.dispose();
      return next(err);
    });
    debug('running next() in domain for %s',req.url);
    requestDomain.run(next);
  };
};