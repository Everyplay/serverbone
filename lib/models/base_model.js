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
var when = Promises.when;

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

  function getTemplateValue(property) {
    function getThisValue(match) {
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

// convert error & reject
var failWithError = function(options, err) {
  options = options || {};
  if (options.ignoreFailures) return Promises.when.resolve();
  console.log(err.message);
  if (err.message === 'not found') {
    err.status = 404;
  }
  return Promises.when.reject(err);
};

var BaseModel = SchemaModel.extend({
  initialize: function(attributes, options) {
    BaseModel.__super__.initialize.apply(this, [attributes, options]);
    this.options = options ? _.clone(options) : {};
    this._processSchema();
  },

  _processSchema: function() {
    if (!this.schema) return;
    this.indexes = this.schema.indexes;
  },

  url: function() {
    if (this.isNew()) {
      return this.type;
    } else {
      return this.type + ':' + this.get(this.idAttribute);
    }
  },

  sync: function() {
    throw new Error('sync method should be overridden!');
  },

  save: function(key, val, options) {
    var opts = options || {};
    var self = this;
    if (key == null || typeof key === 'object') {
      opts = val || {};
    }
    var error = opts.error;
    return this.preSave(opts).then(function() {
      return PromisedModel.prototype.save.call(self, key, opts).then(function(model) {
        return self.afterSave(opts).then(function() {
          return model;
        });
      });
    }, function(err) {
      if (error) error(self, err);
      return err;
    });

    /*
    var fns = [
      _.bind(this.preSave, this, opts),
      _.bind(PromisedModel.prototype.save, this, key, val, options),
      _.bind(this.afterSave, this, opts)
    ];
    return asyncUtils.wrapToSequence(fns, 1, opts, this);*/
  },

  fetch: function(options) {
    var self = this;
    return PromisedModel.prototype
      .fetch.apply(this, arguments)
      .then(function() {
        self.fetchStatus = 'fetched';
        return self;
      }, _.bind(failWithError, null, options));
  },

  destroy: function(options) {
    var fns = [
      _.bind(this.preDelete, this),
      _.bind(PromisedModel.prototype.destroy, this, options)
    ];
    return sequence(fns)
      .then(function(results) {
        return results[1];
      }, _.bind(failWithError, null, options));
  },

  // stub, everyone can access
  canAccess: function() {
    return true;
  },

  //TODO: this is just a dummy method, should be implemented
  getRoles: function() {
    var roles = [];
    return roles;
  },

  // Field level access: get properties which user has permissions
  // field can override object level access mask
  propertiesWithAccess: function() {
    return Object.keys(this.schema.properties);
  },

  toJSON: function(options) {
    options = options || {};
    var json = BaseModel.__super__.toJSON.apply(this, arguments);
    return json;
  },

  validate: function(attrs, options) {
    options = options || {};
    var validationErrors = BaseModel.__super__.validate.apply(this, arguments);
    if (validationErrors) return new ValidationError({
      errors: validationErrors
    });
  },

  /**
   * Fetch current model & its relations
   * Need to fetch current model first in order to apply correct ids to relations
   */
  fetchAll: function(options) {
    options = options || {};
    var self = this;
    var when = Promises.when;

    function handleError(err) {
      if (options.ignoreFailures) {
        return when.resolve(self);
      } else {
        return when.reject(err);
      }
    }
    return this
      .fetch(options)
      .then(function() {
        if (!self.relationDefinitions) {
          return self;
        }
        return self
          .fetchRelations(options)
          .then(function() {
            return self;
          }, handleError);
      }, handleError);
  },

  /**
   * Fetches relations available based on current attributes
   * if options.onlyRelations Array is specified only those relations are fetched
   * e.g. fetchRelations({onlyRelations: ['user']}) will fetch only relation 'user'
   */
  fetchRelations: function(options) {
    options = options || {};
    var when = Promises.when;
    var self = this;
    var fns = [];

    _.each(self.relationDefinitions, function(relationAttributes, relationKey) {
      if (_.isArray(options.onlyRelations)) {
        if (options.onlyRelations.indexOf(relationKey) === -1) return;
      }
      var relation = self.get(relationKey);
      if (relation && relation.fetch) {
        fns.push(_.bind(relation.fetch, relation, _.clone(options)));
      }
    });

    return parallel(fns)
      .then(function relationsFetched() {
        self.fetchStatus = 'all_fetched';
        return self;
      }, function error(err) {
        if (options.ignoreFailures) {
          self.fetchStatus = 'all_fetched';
          return when.resolve(self);
        }
        return err;
      });
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
      if (relation && _.isFunction(relation.save)) {
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
      if (relation) {
        fns.push(relation[fnStr](options));
      }
    }, this);
    return Promises.when.all(fns);
  },

  preSave: function() {
    debug.log('BaseModel.preSave %s', JSON.stringify(arguments));
    return when.resolve();
  },

  afterSave: function() {
    debug.log('BaseModel.afterSave %s', JSON.stringify(arguments));
    return when.resolve();
  },

  fetchAllRequired: function() {
    return this.relationDefinitions
      && Object.keys(this.relationDefinitions).length
      && this.fetchStatus !== 'all_fetched';
  },

  preDelete: function(options) {
    options = options || {};
    if (this.fetchAllRequired()) {
      options.ignoreFailures = true;
      // no need load collection models
      options.skipModelsFetch = true;
      return this.fetchAll(options);
    }
    return when.resolve();
  }
});

BaseModel.Associations = Backbone.Associations;

// Instance methods

// Helpers

module.exports = BaseModel;
module.exports.formatProperties = formatProperties;