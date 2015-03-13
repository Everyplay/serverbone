/**
 * # FlatModel
 *
 * FlatModel is a Model for storing flat strings/numbers.
 * Mainly used as a wrapper model when storing strings
 * or numbers in Redis.
 *
 * Example:
 *
 * ```js
 * var Flat = serverbone.models.FlatModel.extend({
 *    type: 'flat'
 * });
 * var f = new Flat('foo');
 * f.save();
 * ```
 *
 * then see Redis:
 * ```
 * 127.0.0.1:6379> keys *
 * 1) "flat:foo"
 * 127.0.0.1:6379> get flat:foo
 * "\"foo\""
 * ```
 */

var _ = require('lodash');
var nodefn = require('when/node');

var BaseModel = require('./base_model');

var FlatModel = BaseModel.extend({
  idAttribute: 'id',
  constructor: function(attributes, options) {
    if (!_.isString(attributes) && !_.isNumber(attributes)) {
      throw new Error('FlatModel attributes should be a string or number');
    }
    this.attributes = attributes = {
      id: attributes
    };
    return FlatModel.__super__.constructor.call(this, attributes, options);
  },

  toJSON: function() {
    return this.id;
  },

  /**
   * ## FlatModel.prototype.findKeys
   *
   * Find all models starting with given key. Basically calls redis `keys` with given key.
   *
   * @param  {String} startingWithKey find keys starting with
   * @returns {Promise} promise
   */
  findKeys: function(startingWithKey) {
    var options = {
      keys: startingWithKey
    };
    if (!this.db) {
      throw new Error('Db must be defined');
    }
    var args = [this, options];
    return nodefn.apply(_.bind(this.db.findKeys, this.db), args);
  }

});

module.exports = FlatModel;
