/**
 * # JSONModel
 *
 * `JSONModel` Wraps Backbone.Model so that encoded JSON data can be stored
 * in the id attribute (e.g. in Redis).
 *
 * Not meant to be used as is but as a Model for Collections using `JSONIndexMixin`.
 *
 * e.g.
 * ```js
 * var j = new JSONModel({
 *   id: '{"foo":"bar"}'
 * });
 * j.get('foo');
 * 'bar'
 * ```
 */
var _ = require('lodash');
var Model = require('backbone').Model;
var BaseModel = require('./base_model');

var JSONModel = Model.extend({
  constructor: function(attributes, options) {
    if (!_.isObject(attributes)) {
      throw new Error('attributes should be an object');
    }
    if (!attributes.id) {
      attributes = JSON.stringify(attributes);
      this.attributes = attributes = {
        id: attributes
      };
    }
    return JSONModel.__super__.constructor.call(this, attributes, options);
  },

  get: function(attr) {
    var id = this.id;
    var attributes = JSON.parse(id);
    return attributes[attr];
  },

  toJSON: function() {
    return JSON.parse(this.id);
  }

});

JSONModel.setDbDriver = BaseModel.setDbDriver;
module.exports = JSONModel;
