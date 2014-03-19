var _ = require('lodash');
var IndexMixin = require('./index_mixin');
var _debug = require('debug');
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
  initACL: function() {
    this.acl = new acl.ACL(this.permissions);
  },

  addToIndex: function(model, options) {
    options = options || {};
    options.action = 'update';
    options.actor = options.actor || this.actor;
    debug.trace('ACLCollection(%s).create %s actor present: %d',
      this.type||'', options.action, options.actor !== undefined);
    var err = this.checkAccess(options, model);
    if (err) return when.reject(err);
    return IndexMixin.addToIndex.call(this, model, options);
  },

  removeFromIndex: function(models, options) {
    options = options || {};
    options.action = 'update';
    options.actor = options.actor || this.actor;
    return IndexMixin.removeFromIndex.call(this, models, options);
  },

  destroyAll: function(options) {
    options = options || {};
    options.action = 'destroy';
    options.actor = options.actor || this.actor;
    return this._callAdapter('removeIndex', options);
  },

  canAccess: function(action, actor, model) {
    return this.acl.assert(this.getRoles(actor, model), action);
  },

  getRoles: function(actor, model) {
    var roles = [];
    if (!actor) return roles;
    if (model.id === actor.id) {
      roles.push('owner');
    }
    roles = _.uniq((actor.roles || []).concat(roles));
    return roles;
  },

  checkAccess: function(options, model) {
    var canAccess = this.canAccess(options.action, options.actor, model);
    if (!canAccess) {
      var error = new errors.ForbiddenError('No access to ' + options.action);
      return error;
    }
  }
});

module.exports = ACLIndexMixin;