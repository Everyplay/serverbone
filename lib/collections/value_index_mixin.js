/**
 * wrap IndexMixin fns so Strings/numbers can be stored in the index
 */
var _ = require('lodash');
var debug = require('debug')('serverbone:collections:ValueIndexCollection');
var IndexMixin = require('./index_mixin');
var Model = require('backdash').Model;


var ValueIndexMixin = _.extend({}, IndexMixin, {
  addToIndex: function(str, options) {
    var model = new Model({id: str}, options);
    return IndexMixin.addToIndex.call(this, model, options);
  },

  removeFromIndex: function(strs, options) {
    var singular = !_.isArray(strs);
    strs = singular ? [strs] : _.clone(strs);
    var models = _.map(strs, function(str) {
      return new Model({id: str}, options);
    });
    return IndexMixin.removeFromIndex.call(this, models, options);
  },

  exists: function(str, options) {
    debug('check if "' + str + '" exists in index');
    var model = new Model({id: str}, options);
    return IndexMixin.exists.call(this, model, options);
  },

  fetch: function(options) {
    return IndexMixin.readFromIndex.call(this, options);
  }

});

module.exports = ValueIndexMixin;
