/**
 * Stores JSON data in a sorted set
 */
var _ = require('lodash');
var nodefn = require('when/node');
var IndexMixin = require('./index_mixin');

var MultiIndexMixin = _.extend({}, IndexMixin, {
  // indexProperties or indexKeys must be defined:
  // indexProperties: [{value: 'xx'}, {value: 'yy'}]
  // - used for replacing templated values in indexKey
  // unionKey: 'xx'
  // - key for storing set union temporarily

  // setup index keys,
  // this must be called before constructor which replaces tokens in indexKey
  setupIndexes: function(options) {
    if (!this.indexKeys && (!options.indexProperties || !_.isArray(options.indexProperties))) {
      throw new Error('indexProperties Array must be given as options');
    }
    if (!this.indexKeys) {
      this.indexKeys = [];
      _.each(options.indexProperties, function(prop) {
        this.indexKeys.push(this._replaceTemplatedVals(this.indexKey, prop));
      }, this);
    } else {
      this.indexKeys = _.map(this.indexKeys, function(key) {
        return this._replaceTemplatedVals(key, options);
      }, this);
    }
    this.unionKey = this._replaceTemplatedVals(this.unionKey, options);
  },

  // override readFromIndex to read from multiple indexes
  readFromIndex: function(options) {
    if (!this.indexDb) {
      throw new Error('indexDb must be defined');
    }
    if (!this.indexDb.readFromIndexes) {
      throw new Error('indexDb does not support reading from multiple indexes');
    }
    options = options ? _.clone(options) : {};
    options.indexKeys = this.indexKeys;
    if (this.indexKey && options.indexKeys.indexOf(this.indexKey) === -1) {
      options.indexKeys.push(this.indexKey);
    }
    options.unionKey = this.unionKey;
    options.intersectionKey = this.intersectionKey;
    var args = [this, options];
    return nodefn.apply(_.bind(this.indexDb.readFromIndexes, this.indexDb), args);
  }

});

module.exports = MultiIndexMixin;
