var _ = require('lodash');
var nodefn = require('when/node/function');
/**
 * Model for storing flat strings/numbers
 */
var BaseModel = require('./base_model');

var FlatModel = BaseModel.extend({
  idAttribute: 'id',
  constructor: function(attributes, options) {
    if(!_.isString(attributes) && !_.isNumber(attributes)) {
      throw new Error('FlatModel attributes should be a string or number');
    }
    this.attributes = attributes = {id: attributes};
    return FlatModel.__super__.constructor.call(this, attributes, options);
  },

  toJSON: function(options) {
    return this.id;
  },

  findKeys: function(startingWithKey) {
    var options = {keys: startingWithKey};
    if(!this.db) {
      throw new Error('Db must be defined');
    }
    var args = [this, options];
    return nodefn.apply(_.bind(this.db.findKeys, this.db), args);
  }

});

module.exports = FlatModel;
