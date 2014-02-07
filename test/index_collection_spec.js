var should = require('chai').should();
var when = require('when');
var testSetup = require('./test_setup');
var TestCollection = testSetup.TestIndexCollection;

describe('Test IndexCollection', function () {
  var collection;
  var opts = {foo_id: 'foo'};

  before(function(next) {
    collection = new TestCollection(null, opts);
    var fns = [
      collection.create({data: 'aaa'}),
      collection.create({data: 'bbb'})
    ];
    when.all(fns).then(function() {
      next();
    }, next);
  });

  after(function(next) {
    testSetup.clearDb();
    next();
  });

  it('should index a new item', function(next) {
    collection
      .addToIndex(collection.at(0))
      .done(function() {
        next();
      }, next);
  });

  it('should index another item', function(next) {
    collection
      .addToIndex(collection.at(1))
      .done(function() {
        next();
      }, next);
  });

  it('should read ids from index', function(next) {
    collection = new TestCollection(null, opts);
    collection
      .readFromIndex()
      .done(function() {
        collection.length.should.equal(2);
        collection.pluck('id').length.should.equal(2);
        next();
      }, next);
  });

  it('should get count from index', function(next) {
    collection = new TestCollection(null, opts);
    collection
      .count()
      .done(function(count) {
        count.should.equal(2);
        next();
      }, next);
  });

  it('should fetch models', function(next) {
    collection = new TestCollection(null, opts);
    collection
      .fetch()
      .done(function() {
        collection.length.should.equal(2);
        collection.at(0).get('data').should.equal('aaa');
        next();
      }, next);
  });

  it('should apply dynamic filters if defined', function(next) {
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
      .done(function() {
        dynamicCollection.length.should.equal(1);
        dynamicCollection.at(0).get('data').should.not.equal('aaa');
        next();
      }, next);
  });

  it('should check that model exists in index', function(next) {
    var model = collection.at(0);
    should.exist(model);
    collection
      .exists(model)
      .done(function(exists) {
        exists.should.equal(true);
        next();
      }, next);
  });

  it('should remove model from index', function(next) {
    var model = collection.at(0);
    should.exist(model);
    collection
      .removeFromIndex(model)
      .done(function() {
        collection.length.should.equal(1);
        next();
      }, next);
  });

  it('should fetch models after removing item', function(next) {
    collection = new TestCollection(null, opts);
    collection
      .fetch()
      .done(function() {
        collection.length.should.equal(1);
        collection.at(0).get('data').should.not.equal('aaa');
        next();
      }, next);
  });

});