/**
 * extends BaseModel with ACL functionality.
 */
var _ = require('lodash');
var when = require('when');
var BaseModel = require('./base_model');
var _debug = require('debug');
var logId = 'serverbone:models:acl';
var acl = require('../acl');
var debug = {
  trace: _debug(logId + ':trace'),
  log: _debug(logId + ':log'),
  warn: _debug(logId + ':warn'),
  error: _debug(logId + ':error')
};

var ACLModel = BaseModel.extend({
  initialize: function (args, options) {
    ACLModel.__super__.initialize.apply(this, arguments);
    options = options || {};
    this._processPermissions();
    this.addRoles(options.roles);
    if (options.actor) {
      this.actor = options.actor;
    }
  },

  save: function(key, val, options) {
    var opts = options || {};
    if (key == null || typeof key === 'object') {
      opts = val || {};
    }
    opts.action = opts.action || this.isNew() ? 'create' : 'update';
    opts.actor = opts.actor || this.actor;
    return ACLModel.__super__.save.call(this, key, opts);
  },

  fetch: function(options) {
    options = options || {};
    options.action = options.action || 'read';
    options.actor = options.actor || this.actor;
    return ACLModel.__super__.fetch.call(this, options);
  },

  destroy: function(options) {
    options =  options || {};
    options.action = options.action || 'destroy';
    options.actor = options.actor || this.actor;
    var canAccess = this.canAccess(options.action, options.actor);
    if (!canAccess) return when.reject(new Error('No access to ' + options.action));
    return ACLModel.__super__.destroy.call(this, options);
  },
  /**
   * Add role/roles to this instance
   *
   * @param  {Object|Array} roles
   */
  addRoles: function(roles) {
    this.roles = this.roles || [];
    if (!roles) return;
    if (!_.isArray(roles)) roles = [roles];
    debug.log('Adding roles %s to model %s',_.uniq(this.roles.concat(roles)), this.url());
    this.roles = _.uniq(this.roles.concat(roles));
  },

  /**
   * Return any matching roles for model from this model.
   *
   * @param  {Object} actor
   * @return {Array}
   */
  getRoles: function(actor) {
    //debug.log('Model %s asking roles from %s',actor ? actor.url() : '', this.url());
    var roles = [];
    if (!actor) return roles;
    _.each(this.relationDefinitions, function (value, key) {
      var refs = _.pairs(value.references)[0];
      if (!value.references || !value.Class) return;

      if (actor instanceof value.Class
        && actor.has(refs[0])
        && this.has(refs[1])
        && actor.get(refs[0]) === this.get(refs[1])) {
          roles = roles.concat(value.roles || key);
        }

    }, this);

    roles = _.uniq((actor.roles || []).concat(roles));
    return roles;
  },

  _processPermissions: function () {
    var permissions = {};
    if (this.schema && this.schema.permissions) {
      permissions = this.schema.permissions;
    }
    this.acl = new acl.ACL(permissions);
  },

  toJSON: function (options) {
    debug.log('toJSON: %s',JSON.stringify(options));
    options = options || {};
    var json = ACLModel.__super__.toJSON.apply(this, arguments);
    if (!options.actor && options.user) {
      options.actor = options.user || this.actor;
    }
    if (options.actor && this.acl) {
      var readableFields = this.propertiesWithAccess('read', options.actor);
      _.each(Object.keys(json), function (key) {
        if (readableFields.indexOf(key) === -1) delete json[key];
      });
    }
    return json;
  },

  // check access to this model
  canAccess: function (action, model) {
    debug.trace('canAccess %s', action);
    if (!this.acl) return true;
    if (!model) {
      debug.log('using default access model');
      model = new ACLModel();
    }
    debug.log('canAccess %s %s', action, model.url());
    return this.acl.assert(this.getRoles(model), action);
  },

  // Field level access: get properties which user has permissions
  // field can override object level access mask
  propertiesWithAccess: function (action, model) {
    if (!model) {
      debug.log('using default access model');
      model = new ACLModel();
    }
    debug.trace('propertiesWithAccess to action %s with model %s',action,model.toJSON());
    var objectAccess = this.canAccess(action, model);
    var keys = [];
    var self = this;
    if (!this.schema || !this.schema.properties) return keys;

    _.each(this.schema.properties, function (prop, key) {
      if (!prop.permissions && objectAccess) {
        keys.push(key);
      } else if (prop.permissions) {
        var mask = new acl.ACL(prop.permissions);
        var roles = self.getRoles(model);
        if (mask.assert(roles, action)) {
          debug.log('adding key %s because of %s for mask %s',key,roles.join(','), JSON.stringify(mask));
          keys.push(key);
        }
      }
    }, this);
    debug.log('propertiesWithAccess giving out keys: %s', keys.join(','));
    return keys;
  },

  validate: function (attrs, options) {
    debug.trace('validate: %s',JSON.stringify(options));
    var changedAttrs = this.changedAttributes();
    options = options ? _.clone(options) : {};
    debug.trace('validate: %s',JSON.stringify(options));
    var action = options.action || (this.isNew() ? 'create' : 'update');
    var actor = options.actor || options.user || options.model || this.actor;

    var noAccessTo, canAccess, changedProps, canActProps;
    if (this.acl) {
      canAccess = this.canAccess(action, actor);
      debug.log('we have an acl, canAccess: %s',canAccess);
      if (canAccess && changedAttrs) {
        changedProps = Object.keys(changedAttrs);
        // remove attributes not defined in the schema
        var schemaProps = Object.keys(this.schema.properties);
        changedProps = _.filter(changedProps, function(prop) {
          return schemaProps.indexOf(prop) > -1;
        }, this);
        canActProps = this.propertiesWithAccess(action, actor);
        noAccessTo = _.difference(changedProps, canActProps);
      }
      if ((!canAccess && changedAttrs) || (noAccessTo && noAccessTo.length > 0)) {
        debug.log('Failing validation, no access with action %s to %s',action, JSON.stringify(noAccessTo));
        var error = new Error('No access to ' + action + ' fields:' + noAccessTo);
        if (options && options.error) {
          if (options.error.length === 3) {
            options.error(this, error);
          } else {
            options.error(error);
          }
        }
      }
    }
    return ACLModel.__super__.validate.apply(this, arguments);
  }
});

module.exports = ACLModel;