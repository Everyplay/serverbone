var Collection = require('./collection');

var Users = Collection.extend({
  type: 'users',
  model: require('../models/user')
});

exports.Users = Users;