/**
 * If Collection permissions are defined, check ACL based on those first.
 */
var BaseCollection = require('./base_collection');
var ACLModel = require('../models/acl_model');
var _ = require('lodash');
var when = require('when');
var _debug = require('debug');
var logId = 'serverbone:collections:acl';
var acl = require('serverbone-acl');
var errors = require('../errors');
var util = require('util');
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
    if (!this.actor && options && options.parent) {
      this.actor = options.parent.actor;
    }
    if (this.permissions) {
      this.initACL();
    }
  },
  create: function(data, options) {
    options = _.clone(options) || {};
    options.action = 'create';
    options.actor = options.actor || this.actor;
    debug.trace('ACLCollection(%s).create %s actor present: %d',
      this.type || '', options.action, !!options.actor);
    var err = this.checkAccess(options);
    if (err) return when.reject(err);
    return ACLCollection.__super__.create.call(this, data, options);
  },
  fetch: function(options) {
    options = _.clone(options) || {};
    options.action = 'read';
    options.actor = options.actor || this.actor;
    debug.trace('ACLCollection(%s).fetch %s actor present: %d',
      this.type || '', options.action, !!options.actor);
    var err = this.checkAccess(options);
    if (err) return when.reject(err);
    return ACLCollection.__super__.fetch.call(this, options);
  },
  destroyAll: function(options) {
    options = _.clone(options) || {};
    options.action = 'destroy';
    options.actor = options.actor || this.actor;
    debug.trace('ACLCollection(%s).destroyAll %s actor present: %d',
      this.type || '', options.action, !!options.actor);
    var err = this.checkAccess(options);
    if (err) return when.reject(err);
    return ACLCollection.__super__.destroyAll.call(this, options);
  },

  initACL: function() {
    this.acl = new acl.ACL(this.permissions);
  },

  canAccess: function(action, actor, model) {
    if (!this.acl) return true;
    return this.acl.assert(this.getRoles(actor, model), action);
  },

  getRoles: function(actor, model) {
    var roles = [];
    if (!actor) return roles;
    if (model
        && model.type === actor.type
        && model.id === actor.id) {
      roles.push('owner');
    }
    return _.union(roles, actor.roles || []);
  },

  checkAccess: function(options) {
    var canAccess = this.canAccess(options.action, options.actor);
    if (!canAccess) {
      debug.log('no access:' + options.action + ', ' + this.type + ', ' + this.indexKey);
      var errorMsg = util.format(
        'No access to %s (%s)',
        options.action,
        this.indexKey || this.type
      );
      var error = new errors.ForbiddenError(errorMsg);
      return error;
    }
  }
});

module.exports = ACLCollection;
