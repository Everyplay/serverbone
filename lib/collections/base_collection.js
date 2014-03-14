var _ = require('lodash');
var Promises = require('backbone-promises');
var PromisesCollection = Promises.Collection;
var SchemaCollection = require('backbone-blueprint').Collection;
var parallel = require('when/parallel');
var BaseModel = require('../models/base_model');

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
    return 'base_collection';
  },

  create: function(data, opts) {
    return PromisesCollection.prototype.create.call(this, data, opts);
  },

  fetch: function(options) {
    options = _.extend({}, this.defaultOptions || {}, options);
    if (options.after_id) options.after_id = this._convertId(options.after_id);
    if (options.before_id) options.before_id = this._convertId(options.before_id);
    return PromisesCollection.prototype.fetch.call(this, options);
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
   * Helper function for calling fetchAll to all models in the collection
   */
  fetchModelRelations: function (options) {
    var fns = [];

    this.each(function (model) {
      fns.push(_.bind(model.fetchAll, model, _.clone(options)));
    });

    return parallel(fns);
  },

  /**
   * Destroys all models from collection
   */
  destroyAll: function(options) {
    return this.applyToAll('destroy', options);
  },

  /**
   * Apply given function to all models
   */
  applyToAll: function(fn, options) {
    var self = this;

    return this
      .fetch(_.clone(options))
      .then(function() {
        var fns = [];
        self.models.forEach(function(model) {
          fns.push(_.bind(model[fn], model, _.clone(options)));
        });
        return parallel(fns);
      });
  },

  _replaceTemplatedVals: function(value, options) {
    if (!options || !value) return value;
    if (_.isString(value) && value.indexOf('{') === 0) {
      var val = value.replace('{','').replace('}','');
      if (options.hasOwnProperty(val)) value = options[val];
    } else if (_.isString(value) && value.indexOf('{') > -1) {
      value = value.replace(/{([^}]+)}+/g, function (v) {
        var val = v.replace('{','').replace('}','');
        return options.hasOwnProperty(val) ? options[val] : v;
      });
    }
    return value;
  }
});

BaseCollection.setDbDriver = BaseModel.setDbDriver;
module.exports = BaseCollection;