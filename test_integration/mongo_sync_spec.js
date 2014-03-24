var should = require('chai').should();
var serverbone = require('..');
var BaseModel = serverbone.models.BaseModel;
var assert = require('chai').assert;

var MongoDb = require('backbone-db-mongodb');
var mongo = require('../config/mongo');
var db;
var testDb;

var testSchema = {
  id: 'schemas/test',
  type: 'object',
  properties: {
    data: {
      type: 'integer',
    },
    _id: {
      type: 'any'
    },
    id: {
      type: 'any'
    }
  },
  indexes: [{
    property: 'data'
  }]
};

var type = 'mongotestmodel';
var TestModel = BaseModel.extend({
  type: type,
  schema: testSchema,
  mongo_collection: type,
  url: function() {
    var key = this.type;
    if (!this.isNew()) {
      key += ':' + this.get(this.idAttribute);
    }
    return key;
  }
});

var TestCollection = serverbone.collections.BaseCollection.extend({
  type: TestModel.prototype.type + 's',
  model: TestModel,
  db: testDb,
  sync: MongoDb.sync.bind(testDb),
  mongo_collection: type,
  url: function() {
    return this.type;
  }
});

var clearDb = function(done) {
  db.collection(type).remove(done);
};

describe('Integration Test: MongoDb sync', function() {
  before(function(done) {
    mongo.connect(function(err, _db) {
      if (err) {
        console.error(err);
        return done(err);
      }
      db = _db;
      testDb = new MongoDb(db);
      TestModel.prototype.db = testDb;
      TestModel.prototype.sync = MongoDb.sync.bind(testDb);
      TestCollection.prototype.db = testDb;
      TestCollection.prototype.sync = MongoDb.sync.bind(testDb);
      done();
    });
  });

  after(function(done) {
    clearDb(function(err) {
      done(err);
    });
  });

  describe('#model', function() {
    var testId;

    it('should save model', function() {
      var testModel = new TestModel({
        data: 2
      });
      return testModel.save().then(function(model) {
        model.get('data').should.equal(2);
        testId = model.id;
        testId.should.be.ok;
      });
    });

    it('should fetch model', function() {
      var testModel = new TestModel({
        id: testId
      });
      return testModel.fetch();
    });

    it('should destroy model', function() {
      var testModel = new TestModel({
        id: testId
      });
      return testModel
        .destroy();
    });
  });

  describe('#collection', function() {
    var collection = new TestCollection();

    it('should create model', function() {
      return collection
        .create({
          data: 1
        });
    });

    it('should create another model', function() {
      return collection
        .create({
          data: 2
        });
    });

    it('should fetch all models', function() {
      return collection
        .fetch();
    });

    it('should fetch models filtered with options', function() {
      var opts = {
        where: {
          data: 2
        },
        limit: 1,
        offset: 0
      };
      return collection
        .fetch(opts)
        .then(function() {
          collection.length.should.equal(1);
          var m = collection.at(0);
          should.exist(m);
          m.get('data').should.equal(2);
        });
    });
  });
});