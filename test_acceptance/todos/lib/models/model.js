var _ = require('lodash');
var when = require('when');
var Promises = require('backbone-promises');
var serverbone = require('../../../..');

var Model = serverbone.models.ACLModel.extend({
  type: 'model',
  initialize: function(attributes, options) {
    Model.__super__.initialize.apply(this, [attributes, options]);
  }
});


module.exports = Model;