var testSetup = require('./test_setup');
var should = require('chai').should();
var when = require('when');
var sequence = require('when/sequence');
var _ = require('lodash');
var TestCollection = testSetup.TestIndexCollection;
var SortedTestCollection = testSetup.SortedTestIndexCollection;

describe('Test IndexCollection', function() {
  var collection;
  var opts = {
    foo_id: 'foo'
  };

  before(function(next) {
    testSetup.setupDbs(function(err) {
      if (err) return next(err);
      if (!testSetup.unitTesting) {
        testSetup.setDb(TestCollection, 'redis');
        testSetup.setDb(TestCollection.prototype.model, 'redis');
      }
      collection = new TestCollection(null, opts);
      var fns = [
        collection.create({
          data: 'aaa'
        }),
        collection.create({
          data: 'bbb'
        })
      ];
      when
        .all(fns)
        .done(function() {
          next();
        }, next);
    });
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
            if (model.get('data') === 'aaa') return null;
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

  it('should add another model to the index', function() {
    return collection
      .create({data: 'ccc'})
      .then(function () {
        return collection.addToIndex(collection.at(1));
      });
  });

  it('should remove the index', function() {
    return collection
      .destroyAll()
      .then(function() {
        return collection.fetch();
      }).then(function() {
        collection.length.should.equal(0);
      });
  });

  describe('indexSort', function () {
    // sorted z-a
    var sortedCollection = new SortedTestCollection(null, opts);

    it('should honor the order when fetching', function () {
      return sequence([
        _.bind(sortedCollection.create, sortedCollection, {data: 'aaa'}),
        _.bind(sortedCollection.create, sortedCollection, {data: 'ccc'})
      ]).then(function () {
        return when.join(
          sortedCollection.addToIndex(sortedCollection.at(0)),
          sortedCollection.addToIndex(sortedCollection.at(1))
        );
      }).then(function () {
        return sortedCollection.fetch();
      }).then(function () {
        sortedCollection.length.should.equal(2);
        sortedCollection.at(0).get('data').should.equal('ccc');
        sortedCollection.at(1).get('data').should.equal('aaa');
      });
    });

    it('should add another model to the index', function() {
      sortedCollection = new SortedTestCollection(null, opts);
      return sortedCollection
        .create({data: 'bbb'})
        .then(function () {
          return sortedCollection.addToIndex(sortedCollection.at(0));
        });
    });

    it('should fetch the models in the sort order', function() {
      return sortedCollection
        .fetch()
        .then(function() {
          sortedCollection.length.should.equal(3);
          sortedCollection.at(0).get('data').should.equal('ccc');
          sortedCollection.at(1).get('data').should.equal('bbb');
          sortedCollection.at(2).get('data').should.equal('aaa');
        });
    });

    it('should remove the index', function() {
      return sortedCollection
        .destroyAll()
        .then(function() {
          return sortedCollection.fetch();
        }).then(function() {
          sortedCollection.length.should.equal(0);
        });
    });
  });
});
