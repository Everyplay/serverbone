var _ = require('lodash');
var ACLCollection = require('./acl_collection');
var IndexMixin = require('./index_mixin');
var _debug = require('debug');
var util = require('util');
var logId = 'serverbone:collections:acl_index_mixin';
var acl = require('../acl');
var errors = require('../errors');
var when = require('when');
var debug = {
  trace: _debug(logId + ':trace'),
  log: _debug(logId + ':log'),
  warn: _debug(logId + ':warn'),
  error: _debug(logId + ':error')
};


var ACLIndexMixin = _.extend({}, IndexMixin, {
  readFromIndex: function(options) {
    options = options || {};
    options.action = options.action || 'read';
    options.actor = options.actor || this.actor;
    debug.trace('ACLIndexMixin(%s).readFromIndex %s actor present: %d',
      this.type||'', options.action, options.actor !== undefined);
    var err = this.checkAccess(options);
    if (err) return when.reject(err);
    return IndexMixin.readFromIndex.call(this, options);
  },

  addToIndex: function(model, options) {
    options = options || {};
    options.action = options.action || 'update';
    options.actor = options.actor || this.actor;
    debug.trace('ACLIndexMixin(%s).addToIndex %s actor present: %d',
      this.type||'', options.action, options.actor !== undefined);
    var err = this.checkAccess(options, model);
    if (err) return when.reject(err);
    return IndexMixin.addToIndex.call(this, model, options);
  },

  removeFromIndex: function(models, options) {
    options = options || {};
    options.action = options.action || 'update';
    options.actor = options.actor || this.actor;
    var model = !_.isArray(models) ? models : null;
    var err = this.checkAccess(options, model);
    if (err) return when.reject(err);
    return IndexMixin.removeFromIndex.call(this, models, options);
  },

  destroyAll: function(options) {
    options = options || {};
    options.action = options.action || 'destroy';
    options.actor = options.actor || this.actor;
    var err = this.checkAccess(options);
    if (err) return when.reject(err);
    return this._callAdapter('removeIndex', options);
  },

  checkAccess: function(options, model) {
    var canAccess = this.canAccess(options.action, options.actor, model);
    if (!canAccess) {
      debug.log('no access:' + options.action + ', ' + this.type + ', ' + this.indexKey);
      var errorMsg = util.format(
        'No access to %s (%s)',
        options.action,
        this.name || this.indexKey
      );
      var error = new errors.ForbiddenError(errorMsg);

      return error;
    }
  }
});

ACLIndexMixin.initACL = ACLCollection.prototype.initACL;
ACLIndexMixin.canAccess = ACLCollection.prototype.canAccess;
ACLIndexMixin.getRoles = ACLCollection.prototype.getRoles;

module.exports = ACLIndexMixin;