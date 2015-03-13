var _ = require('lodash');
var when = require('when');
var sequence = require('when/sequence');
var BaseCollection = require('./base_collection');
var IndexMixin = require('./index_mixin');

/**
 * # IndexCollection
 *
 * Collection which stores indexes separately. It is a convenience base class
 * that uses [IndexMixin](./index_mixin.js.html#indexmixin) to store collection
 * indexes in a dedicated storage backend.
 */
var IndexCollection = BaseCollection.extend(
  _.extend({}, IndexMixin, {
    defaultOptions: {
      where: {
        id: {
          $in: '{ids}'
        }
      }
    },

    initialize: function(models, options) {
      IndexCollection.__super__.initialize.apply(this, arguments);
      this.indexKey = this._replaceTemplatedVals(this.indexKey, options);
    },

    /**
     * Ids were fetched from index, read models from the main store
     * @returns {Promise} promise
     */
    modelsFetch: function() {
      var self = this;
      var ids = _.map(this.pluck('id'), function(id) {
        return isNaN(id) ? id : Number(id);
      });
      if (!ids.length) {
        return when.resolve();
      }

      this.defaultOptions = {
        where: {
          id: {
            $in: ids
          }
        }
      };
      var fns = [_.bind.apply(null, [IndexCollection.__super__.fetch, this].concat(arguments))];
      if (this.filterModels) fns.push(_.bind(this.filterModels, this));
      return sequence(fns)
        .then(function() {
          // need to sort models here, since there is no way to guarantee of order of documents
          // fetched from MongoDB /w $in query
           self.models = self.sortBy(self.comparator || function(model) {
             return ids.indexOf(model.id);
           }, this);
        });
    }
  })
);
IndexCollection.setDbDriver = BaseCollection.setDbDriver;
module.exports = IndexCollection;
