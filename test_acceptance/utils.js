/**
 * Helper for making http Promisified requests
 */
var request = require('request');
var when = require('when');
var nodefn = require('when/node/function');
var config = require('../config');
var _ = require('lodash');

var req = function(method, opts) {
  return nodefn
    .call(request[method], opts)
    .then(function(results) {
      return when.resolve(results[0]);
    });
};

var baseOpts = function(path, options, baseO) {
  options = options || {};

  var opts = {
    url: config.get('base_url') + path,
    json: options.json !== undefined ? options.json : true
  };
  if (options.headers) opts.headers = options.headers;
  _.merge(opts, baseO || {});
  return opts;
};

exports.request = function(baseO) {
  return {
    request: function(path, options) {
      options = _.extend({}, options, baseOpts(path, options), baseO);
      return nodefn.call(request, options).then(function(results) {
        return when.resolve(results[0]);
      });
    },
    get: function(path, options) {
      var opts = baseOpts(path, options, baseO);
      return req('get', opts);
    },
    del: function(path, options) {
      var opts = baseOpts(path, options, baseO);
      return req('del', opts);
    },
    post: function(path, data, options) {
      var opts = baseOpts(path, options, baseO);
      opts.json = data;
      return req('post', opts);
    },
    put: function(path, data, options) {
      var opts = baseOpts(path, options, baseO);
      opts.json = data;
      return req('put', opts);
    }
  };
};
