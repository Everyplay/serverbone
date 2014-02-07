var should = require('chai').should();
var when = require('when');
var testSetup = require('./test_setup');
var TestCollection = testSetup.TestValueIndexCollection;

describe('Test ValueIndexCollection', function () {
  var collection;

  before(function(next) {
    collection = new TestCollection();
    next();
  });

  after(function(next) {
    testSetup.clearDb();
    next();
  });

  it('value should not exists in index', function() {
    collection
      .exists('foo')
      .then(function(exists) {
        exists.should.equal(false);
      });
  });

  it('should add item to value index', function() {
    return collection
      .addToIndex('foo');
  });

  it('should check that added value exists in index', function() {
    return collection
      .exists('foo')
      .then(function(exists) {
        exists.should.equal(true);
      });
  });

  it('should remove value from index', function() {
    return collection
      .removeFromIndex('foo');
  });

  it('value should not exists in index', function() {
    return collection
      .exists('foo')
      .then(function(exists) {
        exists.should.equal(false);
      });
  });
});