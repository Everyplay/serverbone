/**
 * extends BaseModel with ACL functionality.
 */

// TODO: fix jsdocs
/* eslint valid-jsdoc: 0 */
var _ = require('lodash');
var when = require('when');
var BaseModel = require('./base_model');
var _debug = require('debug');
var logId = 'serverbone:models:acl';
var acl = require('serverbone-acl');
var errors = require('../errors');
var util = require('util');
var debug = {
  trace: _debug(logId + ':trace'),
  log: _debug(logId + ':log'),
  warn: _debug(logId + ':warn'),
  error: _debug(logId + ':error')
};

var ACLModel = BaseModel.extend({
  initialize: function(args, options) {
    ACLModel.__super__.initialize.apply(this, arguments);
    options = options || {};
    this._processPermissions();
    this.addRoles(options.roles);
    if (options.actor) {
      this.actor = options.actor;
    }
    if (!this.actor && options.parent) {
      this.actor = options.parent.actor;
    }
  },

  /**
   * Check access before proceeding with save
   *
   * @param {String/Object} key   key to be saved
   * @param {Any} val value
   * @param {Object} options Options
   * @returns {Promise} promise
   */
  save: function(key, val, options) {
    var opts = {};
    /* eslint no-eq-null: 0*/
    if (key == null || typeof key === 'object') {
      opts = _.clone(val) || {};
    } else if (options) {
      opts = _.clone(options);
    }
    opts.action = opts.action || (this.isNew() ? 'create' : 'update');
    opts.actor = opts.actor || this.actor;
    debug.trace('ACLModel(%s).save %s actor present: %d', this.type || '',
      opts.action, !!opts.actor);
    return ACLModel.__super__.save.call(this, key, opts);
  },

  /**
   * Check access before proceeding with fetchAll

   * @param {Object} options Options
   * @returns {Promise} promise
   */
  fetchAll: function(options) {
    options = _.clone(options) || {};
    options.action = 'read';
    options.actor = options.actor || this.actor;
    debug.trace('ACLModel(%s).fetchAll %s actor present: %d', this.type || '',
      options.action, !!options.actor);
    return ACLModel.__super__.fetchAll.call(this, options);
  },

  /**
   * Check access before proceeding with fetch
   */
  fetch: function(options) {
    options = _.clone(options) || {};
    options.action = 'read';
    options.actor = options.actor || this.actor;
    debug.trace('ACLModel(%s).fetch %s actor present: %d',
      this.type || '', options.action, !!options.actor);
    return ACLModel.__super__.fetch.call(this, options);
  },

  /**
   * fetchACLDependencies should be implemented if role resolving needs data e.g. from other model
   * @param  {Object} options options for fetch the dependencies
   * @returns {Promise}
   */
  /* eslint no-unused-vars: 0 */
  fetchACLDependencies: function(options) {
    return when.resolve();
  },

  /**
   * Process the permissions because the template-derived permissions might be
   * dependent on the data.
   *
   * @returns {Promise}
   */
  afterFetch: function(options) {
    this._processPermissions();
    return ACLModel.__super__.afterFetch.call(this, options);
  },

  /**
   * Check access before proceeding with destroy
   */
  destroy: function(options) {
    var self = this;
    options = _.clone(options) || {};
    options.action = 'destroy';
    options.actor = options.actor || this.actor;
    debug.trace('ACLModel(%s).destroy %s actor present: %d',
      this.type || '', options.action, !!options.actor);

    return this
      .fetchACLDependencies(options)
      .then(function() {
        var canAccess = self.canAccess(options.action, options.actor);
        if (!canAccess) {
          var errorMsg = util.format(
            'No access to %s: %s (%s)',
            options.action,
            self.type || self.indexKey,
            self.id
          );
          return when.reject(new errors.ForbiddenError(errorMsg));
        }
        return ACLModel.__super__.destroy.call(self, options);
      });
  },

  /**
   * Add role/roles to this instance of the Model
   *
   * @param  {Object|Array} roles
   */
  addRoles: function(roles) {
  //  debug.trace('ACLModel(%s).addRoles %s', this.type || '', JSON.stringify(roles || []));
    this.roles = this.roles || [];
    if (!roles) return;
    if (!_.isArray(roles)) roles = [roles];
 //   debug.log('Adding roles %s to model %s', _.uniq(this.roles.concat(roles)), this.url());
    this.roles = _.uniq(this.roles.concat(roles));
  },

  /**
   * Return roles for actor accessing this Model.
   *
   * @param  {Object} actor
   * @returns {Array}
   */
  getRoles: function(actor) {
    // debug.trace('ACLModel(%s).getRoles for model type %s, self.id: %s, actor.id: %s',
    //  this.type || '', (actor || {}).type || '', this.id, (actor || {}).id);
    // debug.log('Model %s asking roles from %s',actor ? actor.url() : '', this.url());
    var roles = [];
    if (!actor) return roles;

    _.each(this.relationDefinitions, function(value, key) {
      if (!value.references || !value.Class) return;
      var refs = _.pairs(value.references)[0];
      var relation = this.get(key);
      if (relation
        && actor.type === relation.type
        && actor.has(refs[0]) && this.has(refs[1])
        && actor.get(refs[0]) === this.get(refs[1])) {
          roles = roles.concat(value.roles || key);
      }
    }, this);

    return _.union(roles, actor.roles || []);
  },

  /**
   * init ACL
   */
  _processPermissions: function() {
    var permissions = {};
    if (this.schema && this.schema.permissions) {
      // permissons keys may be templated -> replace based on model attributes
      _.each(_.keys(this.schema.permissions), function(templatedRole) {
        var role = BaseModel.formatTemplatedProperties.call(this, templatedRole).call(this);
        permissions[role] = this.schema.permissions[templatedRole];
      }, this);
    }
    this.acl = new acl.ACL(permissions);
  },

  /**
   * Filters data in JSON to include only properties that actor has access to
   * @param  {Object} options options for reading the JSON, should contain at least actor object
   * @returns {Object}
   */
  toJSON: function(options) {
    options = options || {};
    var json = ACLModel.__super__.toJSON.apply(this, arguments);
    if (!json) return json;
    var actor = options.actor;
    if (!actor && (options.user || this.actor)) {
      actor = options.user || this.actor;
    }
    if (actor && this.acl) {
      var action = options.action || 'read';
      var readableFields = this.propertiesWithAccess(action, actor);
      _.each(Object.keys(json), function(key) {
        if (readableFields.indexOf(key) === -1) {
          delete json[key];
        }
      });
    }
    return json;
  },

  // check access to this model
  canAccess: function(action, model) {
   // debug.trace('canAccess %s(%s): %s', model ? model.type : '', model ? model.id : '', action);
    if (!this.acl) return true;
    if (action === 'validate') return true;
    if (!model) {
      debug.log('using default access model');
      model = new ACLModel();
    }
//    debug.log('canAccess %s %s', action, model.url());
    return this.acl.assert(this.getRoles(model), action);
  },

  // Field level access: get properties which user has permissions
  // field can override object level access mask
  propertiesWithAccess: function(action, model) {
    if (!model) {
      debug.log('using default access model');
      model = new ACLModel();
    }
    // debug.trace('propertiesWithAccess to action %s with model %s', action, model.toJSON());
    var objectAccess = this.canAccess(action, model);
    var keys = [];
    if (!this.schema || !this.schema.properties) return keys;

    var roles = this.getRoles(model);

    function grantAccess(propertyList) {
      _.each(propertyList, function(prop, key) {
        if (!prop.permissions && objectAccess) {
          keys.push(key);
        } else if (prop.permissions) {
          var mask = new acl.ACL(prop.permissions);
          if (mask.assert(roles, action)) {
            keys.push(key);
          }
        }
      });
    }
    grantAccess(this.schema.properties);

    debug.log('propertiesWithAccess giving out keys: %s to %s(%s) on %s %s(%s)',
      keys.join(','), model.type, model.id, action, this.type, this.id);
    return keys;
  },

  /**
   * Override default validation by adding ACL check.
   * Checks if actor has access to proceed with given action.
   */
  validate: function(attrs, options) {
    var changedAttrs = this.changedSinceSync ? this.changedSinceSync() : this.changedAttributes();
    options = options || {};
    var action = options.action || (this.isNew() ? 'create' : 'update');
    var actor = options.actor || options.user || options.model || this.actor;
    var oldAttrs = action === 'update' ? this.previousAttributes() : attrs;

    if (this.acl) {
      var canAccess = this.canAccess(action, actor);
      var noAccessTo;
      var changedProps;
      if (canAccess && changedAttrs) {
        var schemaProps = Object.keys(this.schema.properties);
        changedProps = Object.keys(changedAttrs);
        changedProps = _.filter(changedProps, function(prop) {
          var oldValue = _.isDate(oldAttrs[prop]) ? oldAttrs[prop].getTime() : oldAttrs[prop];
          var newValue = _.isDate(this.get(prop)) ? this.get(prop).getTime() : this.get(prop);
          var equalValues = _.isEqual(oldValue, newValue);
          return schemaProps.indexOf(prop) > -1 && !equalValues;
        }, this);
        var canActProps = this.propertiesWithAccess(action, actor);
        noAccessTo = _.difference(changedProps, canActProps);
      }
      if ((!canAccess && changedAttrs)
          || (noAccessTo && noAccessTo.length > 0 && action !== 'validate')) {
        debug.log('Failing validation, no access with actor: %s roles %s - action %s to fields %s',
          actor && actor.id,
          this.getRoles(actor),
          action,
          JSON.stringify(noAccessTo)
        );
        var errorMsg = util.format('No access to %s %s (%s)', action, this.type, this.id);
        if (noAccessTo) errorMsg += ' fields:' + noAccessTo;
        var error = new errors.ForbiddenError(errorMsg);
        if (options && options.error) {
          if (options.error.length === 3) {
            options.error(this, error);
          } else {
            options.error(error);
          }
        }
        return error;
      }
    }
    return ACLModel.__super__.validate.apply(this, arguments);
  }
});

module.exports = ACLModel;
