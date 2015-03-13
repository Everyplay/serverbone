var _ = require('lodash');
var IndexCollection = require('./index_collection');
var ACLIndexMixin = require('./acl_index_mixin');

var ACLIndexCollection = IndexCollection.extend(
  _.extend({}, ACLIndexMixin, {
    initialize: function() {
      ACLIndexCollection.__super__.initialize.apply(this, arguments);
      this.initACL();
    }
  })
);

module.exports = ACLIndexCollection;
