var _ = require('lodash');
var Promises = require('backbone-promises');
var PromisesCollection = Promises.Collection;
var SchemaCollection = require('backbone-blueprint').Collection;
var when = require('when');
var parallel = require('when/parallel');
var sequence = require('when/sequence');
var BaseModel = require('../models/base_model');
var Backbone = require('backdash');
var debug = require('debug')('serverbone:base_collection');
/**
 * # BaseCollection
 *
 * The base class for Serverbone collections.
 * It extends [Backbone Blueprint](https://github.com/Everyplay/backbone-blueprint)'s
 * schema-validated `Collection` and overrides the data access methods to
 * return Promises/A+ compliant promises as provided by
 * [Backbone Promises](https://github.com/Everyplay/backbone-promises).
 */
var BaseCollection = SchemaCollection.extend({
  model: BaseModel,
  initialize: function(models, options) {
    BaseCollection.__super__.initialize.apply(this, arguments);
    this.setupDefaultOptions(options);
  },

  setupDefaultOptions: function(options) {
    this.defaultOptions = _.clone(this.defaultOptions);
    // replace templated properties in where field
    _.each(this.defaultOptions && this.defaultOptions.where, function(val, key) {
      this.defaultOptions.where = _.clone(this.defaultOptions.where);
      if (_.isString(val) && val.indexOf('{') === 0) {
        this.defaultOptions.where[key] = this._replaceTemplatedVals(val, options);
      } else if (_.isObject(val)) {
        _.each(val, function(objVal, objKey) {
          this.defaultOptions.where[key] = _.clone(this.defaultOptions.where[key]);
          this.defaultOptions.where[key][objKey] = this._replaceTemplatedVals(objVal, options);
        }, this);
      }
    }, this);
  },

  url: function() {
    return this.type || 'base_collection';
  },

  create: function(data, opts) {
    if (data) {
      _.each(this.defaultOptions && this.defaultOptions.where, function(val, key) {
        if (!_.isObject(val)) {
          if (data instanceof Backbone.Model) {
            data.set(key, val);
          } else if (!data.hasOwnProperty(key)) {
            data[key] = val;
          }
        } else if (val.constructor && val.constructor.name === 'ObjectID') {
          data[key] = val;
        }
      });
    }

    return PromisesCollection.prototype.create.call(this, data, opts);
  },

  fetch: function(options) {
    var self = this;
    options = _.extend({}, this.defaultOptions || {}, options);
    if (options.after_id) options.after_id = this._convertId(options.after_id);
    if (options.before_id) options.before_id = this._convertId(options.before_id);
    return PromisesCollection.prototype
      .fetch.call(this, options)
      .then(function() {
        self.fetchStatus = 'fetched';
      });
  },

  // Convert ids according to Model's schema
  _convertId: function(id) {
    if (!id) return;
    var idAttr = this.model.prototype.idAttribute;
    var attrs = {};
    attrs[idAttr] = id;
    var converted = this.model.prototype._convertAttributes(attrs);
    return converted.hasOwnProperty(idAttr) && converted[idAttr];
  },

  /**
   * ## BaseCollection.prototype.fetchModelRelations
   *
   * A helper function for calling `fetchAll` on all models in the collection.
   *
   * @param {Object} options options for fetch
   * @returns {Promise} promise of the asynchronous operation
   */
  fetchModelRelations: function (options) {
    var fns = [];

    this.each(function (model) {
      fns.push(_.bind(model.fetchAll, model, _.extend({}, options || {}, {action: 'read'})));
    });

    return parallel(fns);
  },

  /**
   * ## BaseCollection.prototype.destroyAll
   *
   * Destroys all models from the collection.
   *
   * @param {Object} options Options
   * @returns {Promise} promise of the asynchronous operation
   */
  destroyAll: function(options) {
    return this.applyToAll('destroy', options);
  },

  /**
   * ## BaseCollection.prototype.applyToAll
   *
   * Apply a given member function to all models. The function is referenced
   * by name.
   *
   * @param {String} fn       name of the function property on the model
   * @param {Object} options  options to pass to the function
   * @returns {Promise} promise of the asynchronous operation
   */
  applyToAll: function(fn, options) {
    var self = this;
    var fetchFn = this.fetchStatus !== 'fetched'
      ? _.bind(this.fetch, this, _.extend({}, options, {action: 'read'}))
      : when.resolve;

    function fetchModel(model) {
      return model[fn](_.clone(options))
        .then(function() {

        }, function(err) {
          if (err.statusCode === 404) {
            self.remove(model);
            debug('model %s(%s) not found', model.type, model.id.toString());
          } else {
            return when.reject(err);
          }
        });
    }
    return fetchFn()
      .then(function() {
        var fns = [];
        self.models.forEach(function(model) {
          fns.push(_.bind(fetchModel, self, model));
        });
        return options && options.sequential
          ? sequence(fns) : parallel(fns);
      });
  },

  _replaceTemplatedVals: function(value, options) {
    var val;
    if (!options || !value) return value;
    if (_.isString(value) && value.indexOf('{') === 0) {
      val = value
        .replace('{', '')
        .replace('}', '');
      if (options.hasOwnProperty(val)) value = options[val];
    } else if (_.isString(value) && value.indexOf('{') > -1) {
      value = value.replace(/{([^}]+)}+/g, function (v) {
        val = v
        .replace('{', '')
        .replace('}', '');
        return options.hasOwnProperty(val) ? options[val] : v;
      });
    }
    return value;
  }
});

BaseCollection.setDbDriver = BaseModel.setDbDriver;
module.exports = BaseCollection;
