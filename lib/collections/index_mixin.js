/**
 * A helper mixin for storing indices.
 * Indices can e.g. use a [Backbone DB](https://github.com/Everyplay/backbone-db)
 * adapter different from the main Collection.
 */
var _ = require('lodash');
var sequence = require('when/sequence');
var IndexedCollectionMixin = require('backbone-db-indexing-adapter').IndexedCollectionMixin;

/**
 * # IndexMixin
 *
 * A mixin for collections, providing support for storing property and
 * relation indices in a separate storage backend. Extends
 * (backbone-db-indexing-adapter)[https://github.com/Everyplay/backbone-db-indexing-adapter]'s
 * IndexedCollectionMixin
 *
 * Application developers may find it more convenient to use
 * [IndexCollection](./index_collection.js.html#indexcollection) or
 * specialized extensions of `IndexMixin` rather than use this mixin directly.
 */
var IndexMixin = _.extend({}, IndexedCollectionMixin, {

  /**
   * ## IndexMixin.fetch
   *
   * Fetch IDs from the index first, then models from the main storage.
   * If the option `idsOnly` is true, fetch only the IDs.
   *
   * @param {Object} [options] the options
   * @returns {Promise} promise of the asynchronous operation
   */
  fetch: function(options) {
    options = options || {};
    if (!this.modelsFetch) throw new Error('modelsFetch function must be implemented');
    var fns = [
      _.bind(this.readFromIndex, this, options)
    ];
    if (!options.skipModelsFetch) {
      fns.push(_.bind(this.modelsFetch, this, options));
    }
    return sequence(fns);
  }

});

module.exports = IndexMixin;
