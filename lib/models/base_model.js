/**
 * BaseModel extends [backbone-blueprint](https://github.com/Everyplay/backbone-blueprint)'s
 * ValidatingModel providing e.g. Model lifecycle conventions,
 * ACL related functionality & CRUD helpers.
 *
 * Defining a new model requires defining schema & type:
 *
 *  ```js
 *   var User = serverbone.models.BaseModel.extend({
 *     type: 'user',
 *     schema: {
 *       id: 'schemas/user',
 *       type: 'object',
 *       properties: {
 *         id: {
 *           type: 'integer'
 *         },
 *         username: {
 *           type: 'string'
 *         }
 *       }
 *   });
 *  ```
 *
 *  Storage adapter must be changed by overriding Model's
 *  sync & db, e.g.
 *
 *  ```js
 *  var redisStore = new RedisDb('serverbone-example', redis.createClient());
 *  var User = serverbone.models.BaseModel.extend({
 *    db: redisStore,
 *    sync: redisStore.sync,
 *    ...
 *  });
 *  ```
 *
 *  would store the Model in Redis.
 */

var _ = require('lodash');
var parallel = require('when/parallel');
var sequence = require('when/sequence');
var Promises = require('backbone-promises');
var when = Promises.when;
var PromisedModel = Promises.Model;
var SchemaModel = require('backbone-blueprint').ValidatingModel;
var ValidationError = require('../errors').ValidationError;
var logId = 'serverbone:models:base';
var _debug = require('debug');

var debug = {
  trace: _debug(logId + ':trace'),
  log: _debug(logId + ':log'),
  warn: _debug(logId + ':warn'),
  error: _debug(logId + ':error')
};

/**
 * # failWithError
 *
 * wrapper for converting error & rejecting with error
 *
 * @param {Object} options Options
 * @param {Error} err error
 * @returns {Promise} rejected promise
 */
var failWithError = function(options, err) {
  options = options || {};
  if (options.ignoreFailures) return Promises.when.resolve();
  return when.reject(err);
};

/**
 * # BaseModel
 */
var BaseModel = SchemaModel.extend({
  /**
   * ## BaseModel.prototype.initialize
   *
   * Init attributes & set event listeners
   *
   * @param {Object} attributes attributes for Model
   * @param {Object} options Options
   */
  initialize: function(attributes, options) {
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

  /**
   * ## BaseModel.prototype.url
   *
   * `url` function is used by some backbone-db drivers, then it defines the database key
   *
   * @returns {String} url of this Model
   */
  url: function() {
    var key = this.dbBaseKey || this.type;
    if (!this.has(this.idAttribute)) {
      return key;
    }
    return key + ':' + this.get(this.idAttribute);
  },

  /**
   * ## BaseModel.prototype.sync
   *
   * sync method must be implemented by the Model
   */
  sync: function() {
    throw new Error('sync method should be overridden!');
  },

  /**
   * ## BaseModel.prototype.save
   *
   * save extends backbone-blueprint's save by adding calls to lifecycle methods
   *
   * @param {String/Object} key   key to be saved
   * @param {Any} val value
   * @param {Object} options Options
   * @returns {Promise} promise
   */
  save: function(key, val, options) {
    var opts = options || {};
    var self = this;
    var attrs;
    /* eslint no-eq-null: 0*/
    if (key == null || typeof key === 'object') {
      opts = val || {};
      attrs = key;
    } else if (key) {
      (attrs = {})[key] = val;
    }
    // if saving only specified attributes, call set,
    // since preSave may depend on changed attributes
    if (attrs) {
      this.set(attrs, opts);
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

  /**
   * ## BaseModel.prototype.preSave
   *
   * preSave is called before main save (saving to db) is executed.
   * This is a good place to add extended validation, ACL or other code that should be
   * executed (asyncronously) before model is saved.
   *
   * @returns {Promise} resolves immediately unless implemented by Model
   */
  preSave: function() {
    return when.resolve();
  },

  /**
   * ## BaseModel.prototype.afterSave
   *
   * afterSave is called after model was successfully saved to db.
   * Here you can for example trigger 'hooks' that inform other parts of the application that
   * model was successfully saved.
   *
   * @returns {Promise} resolves immediately unless implemented by Model
   */
  afterSave: function() {
    return when.resolve();
  },

  /**
   * ## BaseModel.prototype.fetch
   *
   * fetch extends backbone-blueprint's fetch by adding calls to lifecycle methods
   *
   * @param {Object} options Options for fetching
   * @returns {Promise} promise
   */
  fetch: function(options) {
    var self = this;

    options = options || {};

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

  /**
   * ## BaseModel.prototype.preFetch
   *
   * preFetch is called before main fetch (reading from db) is executed.
   *
   * @returns {Promise} resolves immediately unless implemented by Model
   */
  preFetch: function() {
    return when.resolve();
  },

  /**
   * ## BaseModel.prototype.afterFetch
   *
   * afterFetch is called after main fetch (reading from db) succeeded.
   * Here you can for example fetch dependencies and trigger other functionality that
   * depends on the data.
   *
   * @returns {Promise} resolves immediately unless implemented by Model
   */
  afterFetch: function() {
    return when.resolve();
  },

  /**
   * ## BaseModel.prototype.isFetched
   *
   * Get fetch status of the Model
   *
   * @returns {Boolean} true if Model is fetched
   */
  isFetched: function() {
    return this.fetchStatus === 'fetched';
  },

  /**
   * ## BaseModel.prototype.destroy
   *
   * fetch extends backbone-blueprint's destroy by adding calls to lifecycle methods
   *
   * @param {Object} options Options for destroying
   * @returns {Promise} promise
   */
  destroy: function(options) {
    options =  options || {};
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

  /**
   * ## BaseModel.prototype.preDelete
   *
   * preDelete is called before main destroy (deleting from db) is run.
   * Here you can for example check access control dependencies.
   *
   * @param {Object} options Options for deleting
   * @returns {Promise} by default fetches all relations before deleting.
   */
  preDelete: function(options) {
    if (this.fetchAllRequired()) {
      options = _.clone(options) || {};
      options.ignoreFailures = true;
      // no need load collection models
      options.skipModelsFetch = true;
      return this.fetchAll(options);
    }
    return when.resolve();
  },

  /**
   * ## BaseModel.prototype.afterDelete
   *
   * afterDelete is called after main destroy (deleting from db) succeeds.
   * Here you can for example cascade delete (delete other models that depend on deleted model).
   *
   * @param {Object} options Options for deleting
   * @returns {Promise} resolves immediately unless implemented by Model
   */
  /* eslint no-unused-vars: 0 */
  afterDelete: function(options) {
    return when.resolve();
  },

  // These ACL methods provide just the interface, default implementation is in ACLModel:

  /**
   * ## BaseModel.prototype.canAccess
   *
   * canAccess checks global level access to the model.
   * @returns {Boolean} by default true this is just a stub, everyone can access
   */
  canAccess: function() {
    return true;
  },

  /**
   * ## BaseModel.prototype.getRoles
   *
   * getRoles dynamically sets roles for this model.
   * @returns {Array} returns empty array by default
   */
  getRoles: function() {
    var roles = [];
    return roles;
  },

  /**
   * ## BaseModel.prototype.propertiesWithAccess
   *
   * propertiesWithAccess return a list of properties keys of this Model
   * which the actor has access to.
   *
   * @returns {Array} array of keys. By default return all keys.
   */
  propertiesWithAccess: function() {
    return Object.keys(this.schema.properties);
  },

  /**
   * ## BaseModel.prototype.toJSON
   *
   * toJSON is used both when returning a JSON representation of the Model to the HTTP response and
   * when saving the model to database
   *
   * @returns {Object} JSON object
   */
  toJSON: function() {
    return BaseModel.__super__.toJSON.apply(this, arguments);
  },

  /**
   * ## BaseModel.prototype.validate
   *
   * validate the Model based on JSON schema
   *
   * @param {Object} attrs attributes
   * @param {Object} options Options
   * @returns {ValidationError} return ValidationError if there were errors
   */
  validate: function(attrs, options) {
    var validationErrors = BaseModel.__super__.validate.apply(this, arguments);
    if (validationErrors) return new ValidationError({
      errors: validationErrors
    });
  },

  // Workaround for Backbone modifying the passed options object
  isValid: function(options) {
    return BaseModel.__super__.isValid.call(this, _.clone(options));
  },

  /**
   * ## BaseModel.prototype.fetchAll
   *
   * Fetch current model & its relations
   * Need to fetch current model first in order to apply correct ids to relations
   *
   * @param {Object} options Options
   * @returns {Promise} promise
   */
  fetchAll: function(options) {
    debug.trace('fetchAll %s', JSON.stringify(options));
    options = _.clone(options) || {};
    options.action = 'read';
    var self = this;
    function handleError(err) {
      if (options.ignoreFailures) {
        return when.resolve(self);
      }
      return when.reject(err);
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
   * ## BaseModel.prototype.fetchRelations
   *
   * Fetches relations available based on current attributes
   * if options.onlyRelations Array is specified only those relations are fetched
   *
   * e.g.
   * ```js
   * fetchRelations({onlyRelations: ['user']})
   * ```
   * will fetch only relation `user`
   *
   * @param {Object} options Options
   * @returns {Promise} promise
   */
  fetchRelations: function(options) {
    options = options || {};
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
        var fetchOpts = _.has(options.relation, relationKey)
          ? _.clone(options.relation[relationKey])
          : _.clone(options);
        fns.push(_.bind(relation.fetch, relation, fetchOpts));
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
   * ## BaseModel.prototype.fetchRequired
   *
   * Fetch model/relations based on given projection.
   * Tries to avoid unnecessary fetches.
   * TODO: this does not support all projection options yet.
   *
   * @param {String/Object} projection projection opts
   * @param {Object} options Options
   * @returns {Promise} promise
   */
  fetchRequired: function(projection, options) {
    options = options || {};

    if (_.isString(projection)) {
      // read projection config from schema
      projection = this.schema && this.schema.projection && this.schema.projection[projection];
    }
    projection = projection || {};

    var fetchRequired;

    var relationsToBeFetched = [];

    if (options.onlyRelations) {
      relationsToBeFetched = options.onlyRelations;
    } else {
      var relations = _.omit(
        projection,
        'onlyFields',
        'removeFields',
        'actor',
        'requiredDependencies'
      );
      _.each(relations, function(attrs, relKey) {
        var r = this.get(relKey);
        var missingKeys = _.any(attrs, function(attr) {
          return r && r.get && _.isUndefined(r.get(attr));
        });
        if (!r || missingKeys) relationsToBeFetched.push(relKey);
      }, this);

      if (projection.onlyFields) {
        relationsToBeFetched = _.uniq(
          relationsToBeFetched.concat(this.missingRelations(projection.onlyFields))
        );
      }
    }

    if (relationsToBeFetched.length) fetchRequired = true;
    if (options.forceFetch) fetchRequired = true;

    if (relationsToBeFetched.length) {
      var fetchOpts = _.extend({}, options, {
        onlyRelations: relationsToBeFetched
      });
      debug.trace('fetchRequired', relationsToBeFetched);
      return this.fetchAll(fetchOpts);
    }
    var requiredProperties = projection.onlyFields;
    if (requiredProperties && !fetchRequired) {
      var defaultFields = _.result(this, 'defaults') || {};
      fetchRequired = _.any(requiredProperties, function(prop) {
        return _.isUndefined(this.get(prop)) || !_.isUndefined(defaultFields[prop]);
      }, this);
    } else {
      fetchRequired = true;
    }
    if (fetchRequired) {
      debug.trace('fetch required, just model without relations');
      return this.fetch(_.clone(options));
    }

    debug.trace('no fetch required', this.type, this.id);
    return when.resolve();
  },

  /**
   * ## BaseModel.prototype.saveAll
   *
   * Save Model & its relations
   * Note: Collection relations are not saved
   *
   * @param {Object} options Options
   * @returns {Promise} promise
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

  /**
   * ## BaseModel.prototype.applyToAll
   *
   * applyToAll applies function to this model & its relations
   * @param  {String} fnStr   which function to call
   * @param  {Object} options pass options to the called function
   * @returns {Promise}         return a joined promise of the called functions
   */
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

  /**
   * ## BaseModel.prototype.fetchAllRequired
   *
   * Check if fetchAll should be called
   * @returns {Boolean} `true` if fetchAll should be called
   */
  fetchAllRequired: function() {
    return this.relationDefinitions
      && Object.keys(this.relationDefinitions).length
      && this.fetchStatus !== 'all_fetched';
  },

  /**
   * ## BaseModel.prototype.changedAttributesWithoutRelations
   *
   * omits relations from changedAttributes
   * @returns {Object} object containing changed attributes
   */
  changedAttributesWithoutRelations: function() {
    var attrs = this.changedAttributes();
    var relationKeys = this.relationDefinitions ? Object.keys(this.relationDefinitions) : [];
    attrs = _.omit(attrs, relationKeys);
    return attrs;
  },

  /**
   * ## BaseModel.prototype.attributesChanged
   *
   * Called when attributes of this model are changed. Used for keeping track of which
   * attributes have been changed since this model was last synced (fetched or saved).
   * @param {Model} model this
   * @param {Object} options Options
   */
  attributesChanged: function(model, options) {
    var attrs = this.changedAttributesWithoutRelations();
    this._changedSinceSync = _.extend({}, this._changedSinceSync, attrs);
  },

  modelSynced: function(model, resp, options) {
    if (!options || (!options.action || options.action === 'create')) return;
    var relationKeys = this.relationDefinitions ? Object.keys(this.relationDefinitions) : [];
    this._attributesOnSync = _.cloneDeep(_.omit(this.attributes, relationKeys));
  },

  changedSinceSync: function() {
    return this._changedSinceSync;
  },

  parse: function(resp, options) {
    this._changedSinceSync = {};
    this._attributesOnSync = false;
    return BaseModel.__super__.parse.apply(this, arguments);
  },

  // in context of serverbone `Model.previousAttributes` returns
  // attributes that were set when last synced
  previousAttributes: function() {
    if (this._attributesOnSync) return _.clone(this._attributesOnSync);
    return _.clone(this._previousAttributes);
  },

  /**
   * ## BaseModel.prototype.missingRelations
   *
   * Check missing relations based on keys array.
   * @param  {Array} keys array of strings
   * @returns {Array} keys of missing relations
   */
  missingRelations: function(keys) {
    var missingRelations = [];
    var relationKeys = this.relationDefinitions ? Object.keys(this.relationDefinitions) : [];
    _.each(keys, function(key) {
      var isRelation = relationKeys.indexOf(key) > -1;
      if (isRelation && _.isUndefined(this.get(key))) {
        missingRelations.push(key);
      }
    }, this);
    return _.uniq(missingRelations);
  }

});

//
/**
 * ## BaseModel.setDbDriver
 *
 * allows overriding db config during runtime
 *
 * @param {Object} dbSettings object with keys  {db: ..., sync: ..., indexDb: ...}
 */
BaseModel.setDbDriver = function(dbSettings) {
  this.prototype.db = dbSettings.db;
  this.prototype.sync = dbSettings.sync;
  this.prototype.indexDb = dbSettings.indexDb;
};

module.exports = BaseModel;


/**
 * # formatProperties
 *
 * Format 'templated' properties of object like {type: '{type}'}
 * using given this-context for the actual value
 *
 * @param  {Object} properties properties to format
 * @returns {Object} formatted properties, i.e. templated values replaced by real value
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

  _.each(properties, function(property, propertyKey) {
    realProperties[propertyKey] = getTemplateValue(property);
  });
  return realProperties;
};

module.exports.formatProperties = formatProperties;
