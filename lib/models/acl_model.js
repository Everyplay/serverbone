/**
 * extends BaseModel with ACL functionality.
 */
var _ = require('lodash');
var BaseModel = require('./base_model');
var debug = require('debug')('serverbone:model:acl_model');
var acl = require('../acl');

var ACLModel = BaseModel.extend({
  initialize: function (args, options) {
    ACLModel.__super__.initialize.apply(this, arguments);
    options = options || {};
    this._processPermissions();
    this.addRoles(options.roles);
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
    debug('Adding roles %s to model %s',_.uniq(this.roles.concat(roles)), this.url());
    this.roles = _.uniq(this.roles.concat(roles));
  },

  /**
   * Return any matching roles for model from this model.
   *
   * @param  {Object} actor
   * @return {Array}
   */
  getRoles: function(actor) {
    debug('Model %s asking roles from %s',actor ? actor.url() : '', this.url());
    var roles = [];
    if (!actor) return roles;
    _.each(this.relationDefinitions, function (value, key) {
      var refs = _.pairs(value.references)[0];
      if (!value.references || !value.Class) return;

      if (actor instanceof value.Class && actor.has(refs[0]) && this.has(refs[1]) &&
        actor.get(refs[0]) === this.get(refs[1])) {

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
    debug('toJSON: %s',JSON.stringify(options));
    options = options || {};
    var json = ACLModel.__super__.toJSON.apply(this, arguments);
    if (!options.actor && options.user) {
      options.actor = options.user;
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
    if (!this.acl) return true;
    if (!model) {
      debug('using default access model');
      model = new ACLModel();
    }
    debug('canAccess %s %s', action, model.url());
    return this.acl.assert(this.getRoles(model), action);
  },
  // Field level access: get properties which user has permissions
  // field can override object level access mask
  propertiesWithAccess: function (action, model) {
    debug('propertiesWithAccess to action %s with model %s',action,model.toJSON());
    if (!model) {
      debug('using default access model');
      model = new ACLModel();
    }
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
          debug('adding key %s because of %s',key,roles.join(','));
          keys.push(key);
        }
      }
    }, this);
    debug('propertiesWithAccess giving out keys: %s', keys.join(','));
    return keys;
  },


  validate: function (attrs, options) {
    debug('validate: %s',JSON.stringify(options));
    var changedAttrs = this.changedAttributes();
    options = options ? _.clone(options) : {};
    var action = options.action || this.isNew() ? 'create' : 'update';
    debug('validate %s: %s %s %s', this.url(), action, JSON.stringify(changedAttrs), JSON.stringify(options));
    var noAccessTo, canAccess;
    if (this.acl) {
      canAccess = this.canAccess(action, options.actor || options.user);
      debug('we have an acl, canAccess: %s',canAccess);
      if (canAccess && changedAttrs) {
        var changedProps = Object.keys(changedAttrs);
        var canActProps = this.propertiesWithAccess(action, options.actor || options.user || options.model);
        noAccessTo = _.difference(changedProps, canActProps);
      }
      if ((!canAccess && changedAttrs) || (noAccessTo && noAccessTo.length > 0)) {
        debug('Failing validation, no access with action %s to %s',action, JSON.stringify(noAccessTo));
        var error = new Error('No access to ' + action + ' fields:' + noAccessTo);
        if (options && options.error) {
          return options.error(this, error);
        }
      }
    }
    ACLModel.__super__.validate.apply(this, arguments);
  }
});

module.exports = ACLModel;