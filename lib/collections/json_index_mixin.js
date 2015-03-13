/**
 * Stores JSON data in a sorted set
 */
var _ = require('lodash');
var JSONModel = require('../models/json_model');
var IndexMixin = require('./index_mixin');
var ValueIndexMixin = require('./value_index_mixin');

var JSONIndexMixin = _.extend({}, ValueIndexMixin, {
  model: JSONModel,
  addToIndex: function(json, options) {
    var model = new this.model(json);
    return IndexMixin.addToIndex.call(this, model, options);
  },

  removeFromIndex: function(models, options) {
    return IndexMixin.removeFromIndex.call(this, models, options);
  },

  destroyAll: function(options) {
    return this._callAdapter('removeIndex', options);
  }
});

module.exports = JSONIndexMixin;
