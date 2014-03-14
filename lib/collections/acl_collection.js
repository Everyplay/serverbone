var BaseCollection = require('./base_collection');
var ACLModel = require('../models/acl_model');
var _ = require('lodash');

var ACLCollection = BaseCollection.extend({
  model: ACLModel,
  initialize: function(models, options) {
    ACLCollection.__super__.initialize.apply(this, arguments);
    if (options && options.actor) {
      this.actor = options.actor;
    }
  },
  create: function(data, options) {
    options = options || {};
    options.action = 'create';
    options.actor = options.actor || this.actor;
    return ACLCollection.__super__.create.call(this, data, options);
  },
  fetch: function(options) {
    options = options || {};
    options.action = 'fetch';
    options.actor = options.actor || this.actor;
    return ACLCollection.__super__.fetch.call(this, options);
  },
  destroyAll: function(options) {
    options = options || {};
    options.action = 'destroy';
    options.actor = options.actor || this.actor;
    return ACLCollection.__super__.destroyAll.call(this, options);
  }
});

module.exports = ACLCollection;