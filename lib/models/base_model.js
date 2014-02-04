var _ = require('lodash');
var parallel = require('when/parallel');
var sequence = require('when/sequence');
var Promises = require('backbone-promises');
var PromisedModel = Promises.Model;
var Backbone = require('backbone');
var SchemaModel = require('backbone-blueprint').ValidatingModel;
var acl = require('../acl');
var asyncUtils = require('../utils/async');
var ValidationError = require('../errors').ValidationError;
var logId = 'serverbone:models:base';
var _debug = require('debug');
var debug = {
  log: _debug(logId + ':log'),
  warn: _debug(logId + ':warn'),
  error: _debug(logId + ':error')
};


/**
 * Format 'templated' properties of object like {type: '{type}'}
 * using given this-context for the actual value
 * @param  {Object} properties
 * @return {Object}
 */
var formatProperties = function(properties) {
  var self = this;
  var realProperties = {};

  function getTemplateValue(property){
    function getThisValue(match){
      var cleanedValue = match.substring(1, match.length - 1);
      return self[cleanedValue];
    }
    return property.replace(/{([^}]+)}+/g, getThisValue);
  }

  for (var propertyKey in properties) {
    realProperties[propertyKey] = getTemplateValue(properties[propertyKey]);
  }

  return realProperties;
};

var BaseModel = SchemaModel.extend({
    initialize: function(attributes, options) {
      BaseModel.__super__.initialize.apply(this, [attributes, options]);
      this.options = options ? _.clone(options) : {};
      this._processSchema();
    },

    _processSchema: function() {
      if(!this.schema) return;
      if(this.schema.access) {
        this.acl = new acl.AccessControl(this.schema.access);
      }
      this.indexes = this.schema.indexes;
    },

    url: function() {
      if(this.isNew()) {
        return this.type;
      } else {
        return this.type + ':' + this.get(this.idAttribute);
      }
    },

    sync: function() {
      throw new Error('sync method should be overridden!');
    },

    save: function(key, val, options) {
      var opts;
      if(key == null || typeof key === 'object') {
        opts = val;
      }
      opts = _.extend({validate: true}, opts);
      var fns = [
        _.bind(this.preSave, this, opts),
        _.bind(PromisedModel.prototype.save, this, key, val, options),
        _.bind(this.afterSave, this, opts)
      ];
      var opt = options || val;
      return asyncUtils.wrapToSequence(fns, 1, opt, this);
    },

    fetch: function() {
      var self = this;
      var when = Promises.when;
      var deferred = when.defer();
      PromisedModel.prototype.fetch.apply(this, arguments)
        .then(function() {
          deferred.resolve(self);
          this.fetchStatus = 'fetched';
        }).otherwise(function(err) {
          deferred.reject(err);
        });
      return deferred.promise;
    },

    destroy: function() {
      return this._delete.apply(this, arguments);
    },

    // really delete from db, useful for tests in case destroy is overridden
    delete: function() {
      return this._delete.apply(this, arguments);
    },

    _delete: function(options) {
      var fns = [
        _.bind(this.preDelete, this),
        _.bind(PromisedModel.prototype.destroy, this, options)
      ];
      return asyncUtils.runInSequence(fns, 1);
    },

    // check access to this model
    canAccess: function(action, user) {
      if(!this.acl) return true;
      var roles = this._getRoles(user);
      return this.acl.hasPermission(roles, action);
    },

    //TODO: this is just a dummy method, should be implemented
    _getRoles: function(user) {
      var roles = [];
      if(user.get('admin') === true) roles.push('admin');
      var role = user.get('id') === this.schema.owner ? 'owner' : 'world';
      roles.push(role);
      return roles;
    },

    // Field level access: get properties which user has permissions
    // field can override object level access mask
    propertiesWithAccess: function(action, user) {
      if(!this.acl) return Object.keys(this.schema.properties);
      var objectAccess = this.canAccess(action, user);
      var keys = [];
      _.each(this.schema.properties, function(prop, key) {
        if(!prop.access && objectAccess) {
          keys.push(key);
        } else if(prop.access) {
          var mask = new acl.AccessControl(prop.access);
          var roles = this._getRoles(user);
          if(mask.hasPermission(roles, action)) {
            keys.push(key);
          }
        }
      }, this);
      return keys;
    },

    toJSON: function(options) {
      options = options || {};
      var json = BaseModel.__super__.toJSON.apply(this, arguments);
      if(options.user && this.acl) {
        var readableFields = this.propertiesWithAccess('read', options.user);
        _.each(Object.keys(json), function(key) {
          if(readableFields.indexOf(key) === -1) delete json[key];
        });
      }
      return json;
    },

    validate: function(attrs, options) {
      options = options || {};
      var changedAttrs = this.changedAttributes();
      if(options.user && this.acl && changedAttrs) {
        var changedProps = Object.keys(changedAttrs);
        var canWriteProps = this.propertiesWithAccess('write', options.user);
        var noAccessTo = _.difference(changedProps, canWriteProps);
        if(noAccessTo.length) {
          var error = new Error('No access to write fields:' + noAccessTo);
          return error;
        }
      } else {
        if(!options.user) debug.warn('no user specified, ACL not applied');
        if(!this.acl) debug.warn('model ' + this.type + ' has no ACL specified');
      }
      var validationErrors = BaseModel.__super__.validate.apply(this, arguments);
      if(validationErrors) return new ValidationError({errors: validationErrors});
    },

    /**
     * Fetch current model & its relations
     * Need to fetch current model first in order to apply correct ids to relations
     */
    fetchAll: function(options) {
      options = options || {};
      var self = this;
      var when = Promises.when;
      var deferred = when.defer();

      function handleError(err) {
        if(options.ignoreFailures) {
          deferred.resolve(self);
        } else {
          deferred.reject(err);
        }
      }

      this.fetch(options)
        .then(function() {
          if(!self.relationDefinitions) {
            return deferred.resolve(self);
          }
          self
            .fetchRelations(options)
            .then(function() {
              deferred.resolve(self);
            }).otherwise(handleError);
        }, handleError);
      return deferred.promise;
    },

    /**
     * Fetches relations available based on current attributes
     */
    fetchRelations: function(options) {
      options = options || {};
      var when = Promises.when;
      var deferred = when.defer();
      var self = this;
      var fns = [];

      _.each(self.relationDefinitions, function(relationAttributes, relationKey) {
        var relation = self.get(relationKey);
        if(relation && relation.fetch) {
          fns.push(_.bind(relation.fetch, relation, options));
        }
      });

      parallel(fns)
        .then(function relationsFetched(results) {
          self.fetchStatus = 'all_fetched';
          deferred.resolve(self);
        }, function error(err) {
          if(options.ignoreFailures) {
            self.fetchStatus = 'all_fetched';
            return deferred.resolve(self);
          }
          deferred.reject(err);
        });
      return deferred.promise;
    },

    /**
     * Save Model & its relations
     * Note: Collection relations are not saved
     */
    saveAll: function(options) {
      options = options || {};
      var fns = [
        _.bind(this.save, this, options)
      ];
      _.each(this.relationDefinitions, function(relationAttributes, relationKey) {
        var relation = this.get(relationKey);
        if(relation && _.isFunction(relation.save)) {
          fns.push(_.bind(relation.save, relation, options));
        }
      }, this);
      return sequence(fns);
    },

    // apply function to this model & its relations
    applyToAll: function(fnStr, options) {
      options = options || {};
      var fns = [
        this[fnStr].apply(this, [options])
      ];
      _.each(this.relationDefinitions, function(relationAttributes, relationKey) {
        var relation = this.get(relationKey);
        if(relation) {
          fns.push(relation[fnStr](options));
        }
      }, this);
      return Promises.when.all(fns);
    },

    preSave: function(options) {
      return asyncUtils.emptyPromise();
    },

    afterSave: function(options) {
      return asyncUtils.emptyPromise();
    },

    fetchAllRequired: function() {
      return this.relationDefinitions
        && Object.keys(this.relationDefinitions).length
        && this.fetchStatus !== 'all_fetched';
    },

    preDelete: function(options) {
      options = options || {};
      if(this.fetchAllRequired()) {
        options.ignoreFailures = true;
        // no need load collection models
        options.skipModelsFetch = true;
        return this.fetchAll(options);
      }
      return asyncUtils.emptyPromise();
    }
});


BaseModel.Associations = Backbone.Associations;

// Instance methods

// Helpers


module.exports = BaseModel;
module.exports.formatProperties = formatProperties;
