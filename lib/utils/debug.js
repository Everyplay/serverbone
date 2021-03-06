var _debug = require('debug');

module.exports = function(logId) {
  if (!logId) logId = 'serverbone:models:base';
  return {
    log: _debug(logId + ':log'),
    warn: _debug(logId + ':warn'),
    error: _debug(logId + ':error')
  };
};
