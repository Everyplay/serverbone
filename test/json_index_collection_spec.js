var testSetup = require('./test_setup');
var should = require('chai').should();
var _ = require('lodash');
var when = require('when');
var sequence = require('when/sequence');
var TestCollection = testSetup.TestJSONIndexCollection;
var TestMultiIndexCollection = testSetup.TestMultiIndexCollection;
var serverbone = require('..');
var JSONModel = serverbone.models.JSONModel;

describe('Test JSONIndexCollection', function () {
  var collection;
  var data = [
    {
      foo: 'bar',
      hello: 'world'
    },
    {
      foo: 'bar1',
      hello: 'world1'
    },
    {
      foo: 'bar2',
      hello: 'world2'
    }
  ];

  before(function(next) {
    testSetup.setupDbs(function(err, dbs) {
      if (!testSetup.unitTesting) {
        testSetup.setDb(TestCollection, 'redis');
        testSetup.setDb(TestCollection.prototype.model, 'redis');
      }

      collection = new TestCollection(null, {foo_id: 1});
      next();
    });
  });

  after(function(next) {
    testSetup.clearDb();
    next();
  });

  it('should create JSONModel instance', function() {
    var model = new JSONModel({foo: 'bar', hello: 'world'});
    model.get('foo').should.equal('bar');
    var json = model.toJSON();
    json.hello.should.equal('world');
  });

  it('should add JSON values to index', function() {
    var fns = _.map(data, function(row) {
      return _.bind(collection.addToIndex, collection, row);
    });
    return sequence(fns);
  });

  it('should fetch all values', function() {
    return collection
      .fetch()
      .then(function() {
        collection.length.should.equal(3);
        var json = collection.toJSON();
        var barFound = _.some(json, function(m) {
          return m.foo === 'bar';
        });
        var world1Found = collection.some(function(m) {
          return m.get('hello') === 'world1';
        });
        barFound.should.equal(true);
        world1Found.should.equal(true);
      });
  });

  it('should add values to another index', function(next) {
    var anotherColl = new TestCollection(null, {foo_id: 2});
    return anotherColl.addToIndex({foo: 'barx'});
  });

  it('should read values from both indexes', function() {
    var multiColl = new TestMultiIndexCollection(null, {
      foo_id: 1,
      indexProperties: [{foo_id: 1}, {foo_id: 2}]
    });
    multiColl.indexKey.should.equal('i:Value:1:relation');
    multiColl.unionKey.should.equal('i:Values:1');
    multiColl.indexKeys.length.should.equal(2);
    multiColl.indexKeys[1].should.equal('i:Value:2:relation');
    return multiColl
      .readFromIndex()
      .then(function() {
        multiColl.length.should.equal(4);
      });
  });

  it('should remove all values from index', function() {
    collection = new TestCollection(null, {foo_id: 1});
    var fns = [
      _.bind(collection.destroyAll, collection),
      _.bind(collection.fetch, collection)
    ];
    return sequence(fns)
      .then(function() {
        collection.length.should.equal(0);
      });
  });

});