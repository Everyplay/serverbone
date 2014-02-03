var should = require('chai').should();
var when = require('when');
var testSetup = require('./test_setup');
var TestCollection = testSetup.TestValueIndexCollection;

describe('Test ValueIndexCollection', function () {
  var collection;

  before(function(done) {
    collection = new TestCollection();
    done();
  });

  after(function(done) {
    testSetup.clearDb();
    done();
  });

  it('value should not exists in index', function(done) {
    collection
      .exists('foo')
      .then(function(exists) {
        exists.should.equal(false);
        done();
      }).otherwise(done);
  });

  it('should add item to value index', function(done) {
    collection
      .addToIndex('foo')
      .then(function() {
        done();
      }).otherwise(done);
  });

  it('should check that added value exists in index', function(done) {
    collection
      .exists('foo')
      .then(function(exists) {
        exists.should.equal(true);
        done();
      }).otherwise(done);
  });

  it('should remove value from index', function(done) {
    collection
      .removeFromIndex('foo')
      .then(function() {
        done();
      }).otherwise(done);
  });

  it('value should not exists in index', function(done) {
    collection
      .exists('foo')
      .then(function(exists) {
        exists.should.equal(false);
        done();
      }).otherwise(done);
  });
});