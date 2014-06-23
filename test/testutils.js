var _ = require('lodash');
var Db = require('backbone-db-local');
exports.TestDb = Db;

exports.inAscendingOrder = function(arr) {
  var inOrder = _.every(arr, function(value, index, array) {
    return index === 0 || array[index - 1] >= value;
  });
  return inOrder;
};

exports.inDescendingOrder = function(arr) {
  var inOrder = _.every(arr, function(value, index, array) {
    return index === 0 || array[index - 1] <= value;
  });
  return inOrder;
};

exports.checkCollectionOrder = function(collection, sortAttribute, checkOptions, next) {
  var sortParam = checkOptions.order === 'descending' ? sortAttribute : '-' + sortAttribute;
  var fetchOptions = {
    sort: sortParam
  };
  collection
    .fetch(fetchOptions)
    .done(function() {
      if (checkOptions.length) collection.length.should.equal(checkOptions.length);
      var orderCheck = checkOptions.order === 'descending' ? exports.inDescendingOrder : exports.inAscendingOrder;
      var attrs = collection.pluck(sortAttribute);
      orderCheck(attrs).should.equal(true);
      next();
    }, next);
};