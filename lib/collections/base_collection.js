var _ = require('lodash');
var when = require('when');
var Promises = require('backbone-promises');
var Backbone = require('backbone');
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
      if(_.isString(val) && val.indexOf('{') === 0) {
        this.defaultOptions.where[key] = this._replaceTemplatedVals(val, options);
      } else if(_.isObject(val)) {
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

  create: function() {
    return PromisesCollection.prototype.create.apply(this, arguments);
  },

  fetch: function(options) {
    options = _.extend({}, this.defaultOptions || {}, options);
    return PromisesCollection.prototype.fetch.apply(this, [options]);
  },

  /**
   * Destroys all models from collection
   */
  destroyAll: function(options) {
    var self = this;
    var deferred = when.defer();
    this
      .fetch(options)
      .then(function() {
        var fns = [];
        self.models.forEach(function(model) {
          fns.push(_.bind(model.destroy, model, options));
        });
        parallel(fns)
          .then(function() {
            deferred.resolve();
          }).otherwise(function(err) {
            deferred.reject(err);
          });
      }).otherwise(function(err) {
        deferred.reject(err);
      });
    return deferred.promise;
  },

  _replaceTemplatedVals: function(value, options) {
    if(!options || !value) return value;
    if(_.isString(value) && value.indexOf('{') === 0) {
      var val = value.replace('{','').replace('}','');
      if(options.hasOwnProperty(val)) value = options[val];
    } else if(_.isString(value) && value.indexOf('{') > -1) {
      value = value.replace(/{([^}]+)}+/g, function (v) {
        var val = v.replace('{','').replace('}','');
        return options.hasOwnProperty(val) ? options[val] : v;
      });
    }
    return value;
  }
});

module.exports = BaseCollection;