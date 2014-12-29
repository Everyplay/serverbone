/**
 * A helper mixin for storing indices.
 * Indices can e.g. use a [Backbone DB](https://github.com/Everyplay/backbone-db)
 * adapter different from the main Collection.
 */
var _ = require('lodash');
var when = require('when');
var nodefn = require('when/node');
var sequence = require('when/sequence');
var utils = require('../utils');

/**
 * # IndexMixin
 *
 * A mixin for collections, providing support for storing property and
 * relation indices in a separate storage backend.
 *
 * Application developers may find it more convenient to use
 * [IndexCollection](./index_collection.js.html#indexcollection) or
 * specialized extensions of `IndexMixin` rather than use this mixin directly.
 *
 * Collection classes extended using `IndexMixin` must define the following
 * properties:
 *
 * - `indexKey`: name of the index key. May be a format string to derive the
 *   name from a relation property, e.g. `i:Value:{ref_id}:relation`.
 * - `indexDb`: a Backbone DB storage backend for index data
 */
var IndexMixin = {

  /**
   * ## IndexMixin.addToIndex
   *
   * Adds a new model to the index. Only the index attribute is indexed.
   *
   * @param {Object} model the model to add
   * @return {Promise} promise of the asynchronous operation
   */
  addToIndex: function(model, options) {
    options = options ? _.clone(options) : {};
    if (!(model = this._prepareModel(model, options))) return false;
    if (!options.wait) this.add(model, options);
    return this._callAdapter('addToIndex', options, model);
  },

  /**
   * ## IndexMixin.readFromIndex
   *
   * Read model IDs from the index. Populates collection's models with IDs,
   * for fetching from the main storage.
   *
   * @return {Promise} promise of the asynchronous operation
   */
  readFromIndex: function(options) {
    return this._callAdapter('readFromIndex', options);
  },

  /**
   * ## IndexMixin.fetch
   *
   * Fetch IDs from the index first, then models from the main storage.
   * If the option `idsOnly` is true, fetch only the IDs.
   *
   * @param {Object} [options] the options
   * @return {Promise} promise of the asynchronous operation
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
    return sequence(fns);
  },

  /**
   * ## IndexMixin.removeFromIndex
   *
   * Removes models from the index.
   *
   * @param models a model or an array of models
   * @return {Promise} promise of the asynchronous operation
   */
  removeFromIndex: function(models, options) {
    if (!models) return false;
    this.remove(models, options);
    var singular = !_.isArray(models);
    models = singular ? [models] : _.clone(models);
    return this._callAdapter('removeFromIndex', options, models);
  },

  /**
   * ## IndexMixin.removeIndex
   *
   * Removes the index completely.
   *
   * @return {Promise} promise of the asynchronous operation
   */
  removeIndex: function(options) {
    return this._callAdapter('removeIndex', options);
  },

  // FIXME: should we override destroyAll here, not on IndexCollection?
  /**
   * ## IndexMixin.destroyAll
   *
   * Removes the index completely.
   *
   * @return {Promise} promise of the asynchronous operation
   */
  destroyAll: function(options) {
    return this.removeIndex(options);
  },

  /**
   * ## IndexMixin.exists
   *
   * Check if the model exists in the index.
   *
   * @param model      a model
   * @return {Promise} promise of the asynchronous operation
   */
  exists: function(model, options) {
    if (model && !model.id) {
      return when.resolve(false);
    }
    return this._callAdapter('existsInIndex', options, model);
  },

  /**
   * ## IndexMixin.count
   *
   * Get the count of items in the index.
   *
   * @return {Promise} promise of the asynchronous operation
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
