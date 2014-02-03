var should = require('chai').should();
var when = require('when');
var testSetup = require('./test_setup');
var TestCollection = testSetup.TestIndexCollection;

describe('Test IndexCollection', function () {
  var collection;
  var opts = {foo_id: 'foo'};

  before(function(done) {
    collection = new TestCollection(null, opts);
    var fns = [
      collection.create({data: 'aaa'}),
      collection.create({data: 'bbb'})
    ];
    when.all(fns).then(function() {
      done();
    }).otherwise(done);
  });

  after(function(done) {
    testSetup.clearDb();
    done();
  });

  it('should index a new item', function(done) {
    collection
      .addToIndex(collection.at(0))
      .then(function() {
        done();
      }).otherwise(done);
  });

  it('should index another item', function(done) {
    collection
      .addToIndex(collection.at(1))
      .then(function() {
        done();
      }).otherwise(done);
  });

  it('should read ids from index', function(done) {
    collection = new TestCollection(null, opts);
    collection
      .readFromIndex()
      .then(function() {
        collection.length.should.equal(2);
        collection.pluck('id').length.should.equal(2);
        done();
      }).otherwise(done);
  });

  it('should get count from index', function(done) {
    collection = new TestCollection(null, opts);
    collection
      .count()
      .then(function(count) {
        count.should.equal(2);
        done();
      }).otherwise(done);
  });

  it('should fetch models', function(done) {
    collection = new TestCollection(null, opts);
    collection
      .fetch()
      .then(function() {
        collection.length.should.equal(2);
        collection.at(0).get('data').should.equal('aaa');
        done();
      }).otherwise(done);
  });

  it('should apply dynamic filters if defined', function(done) {
    var DynamicCollection = TestCollection.extend({
      filterModels: function() {
        var deferred = when.defer();
        var self = this;

        function resolve() {
          var models = self.filter(function(model) {
            if(model.get('data') === 'aaa') return null;
            return model;
          });
          self.reset(models);
          deferred.resolve();
        }
        setTimeout(resolve, 10);
        return deferred.promise;
      }
    });
    var dynamicCollection = new DynamicCollection(null, opts);
    dynamicCollection
      .fetch()
      .then(function() {
        dynamicCollection.length.should.equal(1);
        dynamicCollection.at(0).get('data').should.not.equal('aaa');
        done();
      }).otherwise(done);
  });

  it('should check that model exists in index', function(done) {
    var model = collection.at(0);
    should.exist(model);
    collection
      .exists(model)
      .then(function(exists) {
        exists.should.equal(true);
        done();
      }).otherwise(done);
  });

  it('should remove model from index', function(done) {
    var model = collection.at(0);
    should.exist(model);
    collection
      .removeFromIndex(model)
      .then(function() {
        collection.length.should.equal(1);
        done();
      }).otherwise(done);
  });

  it('should fetch models after removing item', function(done) {
    collection = new TestCollection(null, opts);
    collection
      .fetch()
      .then(function() {
        collection.length.should.equal(1);
        collection.at(0).get('data').should.not.equal('aaa');
        done();
      }).otherwise(done);
  });

});