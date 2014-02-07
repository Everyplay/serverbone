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

  it('value should not exists in index', function(next) {
    collection
      .exists('foo')
      .done(function(exists) {
        exists.should.equal(false);
        next();
      }, next);
  });

  it('should add item to value index', function(next) {
    collection
      .addToIndex('foo')
      .done(function() {
        next();
      }, next);
  });

  it('should check that added value exists in index', function(next) {
    collection
      .exists('foo')
      .done(function(exists) {
        exists.should.equal(true);
        next();
      }, next);
  });

  it('should remove value from index', function(next) {
    collection
      .removeFromIndex('foo')
      .done(function() {
        next();
      }, next);
  });

  it('value should not exists in index', function(next) {
    collection
      .exists('foo')
      .done(function(exists) {
        exists.should.equal(false);
        next();
      }, next);
  });
});