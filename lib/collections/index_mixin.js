/**
 * Helper mixin for storing indexes
 * Indexes can e.g. use a different db adapter from the main Collection.
 *
 */
var _ = require('lodash');
var nodefn = require('when/node/function');
var sequence = require('when/sequence');
var utils = require('../utils');

var IndexMixin = {
  //these must be defined:
  //indexKey: 'i:User:{user_id}:followers',
  //indexDb: Db,

  /**
   * Adds a new model to the index. Only specified attribute is indexed.
   * Db adapter returns a Promise
   */
  addToIndex: function(model, options) {
    options = options ? _.clone(options) : {};
    if (!(model = this._prepareModel(model, options))) return false;
    if (!options.wait) this.add(model, options);
    return this._callAdapter('addToIndex', options, model);
  },

  /**
   * Read model ids from the index. Populates collection models with ids,
   * for fetching from the main storage.
   */
  readFromIndex: function(options) {
    return this._callAdapter('readFromIndex', options);
  },

  /**
   * Fetch ids from index first, then models from main storage
   * if option {idsOnly: true} fetch only ids.
   */
  fetch: function(options) {
    options = options || {};
    if (!this.modelsFetch) throw new Error('modelsFetch function must be implemented');
    var fns = [
      _.bind(this.readFromIndex, this, options),
    ];
    if (!options.skipModelsFetch) {
      fns.push(_.bind(this.modelsFetch, this, options));
    }
    return utils.async.runInSequence(fns, fns.length - 1);
  },

  /**
   * Removes a model from index
   */
  removeFromIndex: function(models, options) {
    if (!models) return false;
    this.remove(models, options);
    var singular = !_.isArray(models);
    models = singular ? [models] : _.clone(models);
    return this._callAdapter('removeFromIndex', options, models);
  },

  /**
   * remove index completely
   */
  destroyAll: function(options) {
    return this._callAdapter('removeIndex', options);
  },

  /**
   *  Check if model exists in index
   */
  exists: function(model, options) {
    return this._callAdapter('existsInIndex', options, model);
  },

  /**
   * Get count of items in index
   */
  count: function(options) {
    return this._callAdapter('indexCount', options);
  },

  _callAdapter: function(fn, options, models) {
    options = options ? _.clone(options) : {};
    if (!this.indexDb) {
      throw new Error('indexDb must be defined');
    }
    options.indexKey = this.indexKey;
    var args = [this, options];
    if (models) args.splice(1, 0, models);
    return nodefn.apply(_.bind(this.indexDb[fn], this.indexDb), args);
  }

};

module.exports = IndexMixin;