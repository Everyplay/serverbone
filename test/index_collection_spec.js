var should = require('chai').should();
var when = require('when');
var testSetup = require('./test_setup');
var TestCollection = testSetup.TestIndexCollection;

describe('Test IndexCollection', function () {
  var collection;
  var opts = {foo_id: 'foo'};

  before(function() {
    collection = new TestCollection(null, opts);
    var fns = [
      collection.create({data: 'aaa'}),
      collection.create({data: 'bbb'})
    ];
    return when.all(fns);
  });

  after(function(next) {
    testSetup.clearDb();
    next();
  });

  it('should index a new item', function() {
    return collection.addToIndex(collection.at(0));
  });

  it('should index another item', function() {
    return collection.addToIndex(collection.at(1));
  });

  it('should read ids from index', function() {
    collection = new TestCollection(null, opts);
    return collection
      .readFromIndex()
      .then(function() {
        collection.length.should.equal(2);
        collection.pluck('id').length.should.equal(2);
      });
  });

  it('should get count from index', function() {
    collection = new TestCollection(null, opts);
    return collection
      .count()
      .then(function(count) {
        count.should.equal(2);
      });
  });

  it('should fetch models', function() {
    collection = new TestCollection(null, opts);
    return collection
      .fetch()
      .then(function() {
        collection.length.should.equal(2);
        collection.at(0).get('data').should.equal('aaa');
      });
  });

  it('should apply dynamic filters if defined', function() {
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
    return dynamicCollection
      .fetch()
      .then(function() {
        dynamicCollection.length.should.equal(1);
        dynamicCollection.at(0).get('data').should.not.equal('aaa');
      });
  });

  it('should check that model exists in index', function() {
    var model = collection.at(0);
    should.exist(model);
    return collection
      .exists(model)
      .then(function(exists) {
        exists.should.equal(true);
      });
  });

  it('should remove model from index', function() {
    var model = collection.at(0);
    should.exist(model);
    return collection
      .removeFromIndex(model)
      .then(function() {
        collection.length.should.equal(1);
      });
  });

  it('should fetch models after removing item', function() {
    collection = new TestCollection(null, opts);
    return collection
      .fetch()
      .then(function() {
        collection.length.should.equal(1);
        collection.at(0).get('data').should.not.equal('aaa');
      });
  });

});