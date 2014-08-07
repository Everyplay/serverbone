var _ = require('lodash');
var parallel = require('when/parallel');
var sequence = require('when/sequence');
var Promises = require('backbone-promises');
var when = Promises.when;
var PromisedModel = Promises.Model;
var Backbone = require('backbone');
var SchemaModel = require('backbone-blueprint').ValidatingModel;
var ValidationError = require('../errors').ValidationError;
var logId = 'serverbone:models:base';
var _debug = require('debug');
var when = Promises.when;

var debug = {
  trace: _debug(logId + ':trace'),
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
  return when.reject(err);
};

var BaseModel = SchemaModel.extend({
  initialize: function(attributes, options) {
    //debug.trace('BaseModel.initialize');
    BaseModel.__super__.initialize.apply(this, [attributes, options]);
    this.options = options ? _.clone(options) : {};
    this._processSchema();
    // attributes which have changed since this model was synced
    this._changedSinceSync = {};
    // attributes which this model had when last synced
    this._attributesOnSync = false;
    this.on('change', this.attributesChanged, this);
    this.on('sync', this.modelSynced, this);
  },

  _processSchema: function() {
    if (!this.schema) return;
    this.indexes = this.schema.indexes;
  },

  url: function() {
    var key = this.dbBaseKey || this.type;
    if (this.isNew()) {
      return key;
    } else {
      return key + ':' + this.get(this.idAttribute);
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
    var fns = [
      _.bind(self.preSave, self, opts),
      _.bind(PromisedModel.prototype.save, self, key, opts),
      _.bind(self.afterSave, self, opts)
    ];
    return sequence(fns).then(function(results) {
      return results[1];
    }, function(err) {
      if (error) error.call(opts, self, err);
      return failWithError(opts, err);
    });
  },

  fetch: function(options) {
    var self = this;

    options = options || {};

    var error = options.error;

    var fns = [
      _.bind(self.preFetch, self, options),
      _.bind(PromisedModel.prototype.fetch, self, options),
      _.bind(self.afterFetch, self, options)
    ];

    return sequence(fns).then(function () {
      self.fetchStatus = 'fetched';
      return self;
    }, function (err) {
      if (error) error.call(options, self, err);
      return failWithError(options, err);
    });
  },

  destroy: function(options) {
    options =  options || {};
    var fns = [
      _.bind(this.preDelete, this, _.clone(options)),
      _.bind(PromisedModel.prototype.destroy, this, options),
      _.bind(this.afterDelete, this, options)
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
    debug.trace('fetchAll %s',JSON.stringify(options));
    options = options || {};
    options.action = options.action || 'read';
    var self = this;
    var when = Promises.when;
    options.action = 'read';
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
      if (relation && !relation.url) {
        return;
      }
      if (relation && relation.fetch) {
        // When the run is parallel, clone the options so no shared promises happen.
        fns.push(_.bind(relation.fetch, relation, _.clone(options)));
      }
    }, this);

    return parallel(fns)
      .then(function relationsFetched() {
        self.fetchStatus = 'all_fetched';
        return self;
      }, function error(err) {
        if (options.ignoreFailures) {
          self.fetchStatus = 'all_fetched';
          return when.resolve(self);
        }
        return when.reject(err);
      });
  },

  /**
   * Fetch model/relations based on given projection.
   * Tries to avoid unnecessary fetches.
   * TODO: this does not support all projection options yet.
   * @param  {object} projection
   * @param  {object} options
   * @return {Promise}
   */
  fetchRequired: function(projection, options) {
    var requiredProperties = projection.onlyFields;
    var fetchRequired = _.any(requiredProperties, function(prop) {
      return this.get(prop) === undefined;
    }, this);

    var relationsToBeFetched = [];
    var relations = _.omit(projection, 'onlyFields');
    _.each(relations, function(attrs, relKey) {
      var r = this.get(relKey);
      var missingKeys = _.any(attrs, function(attr) {
        return r && r.get(attr) === undefined;
      });
      if (!r || missingKeys) relationsToBeFetched.push(relKey);
    }, this);

    if (relationsToBeFetched.length) fetchRequired = true;

    if (!fetchRequired) {
      return when.resolve();
    }
    if (relationsToBeFetched.length) {
      return this.fetchAll({onlyRelations: relationsToBeFetched});
    }
    return this.fetch(options);
  },

  /**
   * Save Model & its relations
   * Note: Collection relations are not saved
   */
  saveAll: function(options) {
    options = options || {};
    var fns = [
      _.bind(this.save, this, null, options)
    ];
    _.each(this.relationDefinitions, function(relationAttributes, relationKey) {
      var relation = this.get(relationKey);
      if (relation && _.isFunction(relation.save)) {
        fns.push(_.bind(relation.save, relation, null, _.clone(options)));
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
    return when.resolve();
  },

  afterSave: function() {
    return when.resolve();
  },

  preFetch: function() {
    return when.resolve();
  },

  afterFetch: function() {
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
  },

  afterDelete: function(options) {
    return when.resolve();
  },

  // omits relations from changedAttributes
  changedAttributesWithoutRelations: function() {
    var attrs = this.changedAttributes();
    var relationKeys = this.relationDefinitions ? Object.keys(this.relationDefinitions) : [];
    attrs = _.omit(attrs, relationKeys);
    return attrs;
  },

  attributesChanged: function(model, options) {
    var attrs = this.changedAttributesWithoutRelations();
    this._changedSinceSync = _.extend({}, this._changedSinceSync, attrs);
  },

  modelSynced: function(model, resp, options) {
    if (!this._attributesOnSync) {
      this._attributesOnSync = _.clone(this.attributes);
    }
  },

  changedSinceSync: function() {
    return this._changedSinceSync;
  },

  parse: function(resp, options) {
    this._changedSinceSync = {};
    this._attributesOnSync = false;
    return BaseModel.__super__.parse.apply(this, arguments);
  },

  // in context of serverbone Model.previousAttributes returns attributes that were set when last synced
  previousAttributes: function() {
    if (this._attributesOnSync) return _.clone(this._attributesOnSync);
    return _.clone(this._previousAttributes);
  }

});

BaseModel.Associations = Backbone.Associations;

// override db config during runtime
BaseModel.setDbDriver = function(dbSettings) {
  this.prototype.db = dbSettings.db;
  this.prototype.sync = dbSettings.sync;
  this.prototype.indexDb = dbSettings.indexDb;
};

// Instance methods

// Helpers

module.exports = BaseModel;
module.exports.formatProperties = formatProperties;