var BaseCollection = require('./base_collection');
var ACLModel = require('../models/acl_model');
var _ = require('lodash');
var _debug = require('debug');
var logId = 'serverbone:collections:acl';
var acl = require('../acl');
var errors = require('../errors');
var debug = {
  trace: _debug(logId + ':trace'),
  log: _debug(logId + ':log'),
  warn: _debug(logId + ':warn'),
  error: _debug(logId + ':error')
};

var ACLCollection = BaseCollection.extend({
  model: ACLModel,
  initialize: function(models, options) {
    ACLCollection.__super__.initialize.apply(this, arguments);
    if (options && options.actor) {
      this.actor = options.actor;
    }
  },
  create: function(data, options) {
    options = options || {};
    options.action = 'create';
    options.actor = options.actor || this.actor;
    debug.trace('ACLCollection(%s).create %s actor present: %d',
      this.type||'', options.action, options.actor !== undefined);
    return ACLCollection.__super__.create.call(this, data, options);
  },
  fetch: function(options) {
    options = options || {};
    options.action = 'read';
    options.actor = options.actor || this.actor;
    debug.trace('ACLCollection(%s).fetch %s actor present: %d',
      this.type||'', options.action, options.actor !== undefined);
    return ACLCollection.__super__.fetch.call(this, options);
  },
  destroyAll: function(options) {
    options = options || {};
    options.action = 'destroy';
    options.actor = options.actor || this.actor;
    debug.trace('ACLCollection(%s).destroyAll %s actor present: %d',
      this.type||'', options.action, options.actor !== undefined);
    return ACLCollection.__super__.destroyAll.call(this, options);
  }
});

module.exports = ACLCollection;