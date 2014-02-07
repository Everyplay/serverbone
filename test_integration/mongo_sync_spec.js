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
      type: 'string'
    },
    id: {
      type: 'string'
    }
  },
  indexes: [
    {property: 'data'}
  ]
};

var type = 'mongotestmodel';
var TestModel = BaseModel.extend({
  type: type,
  schema: testSchema,
  mongo_collection: type,
  url: function() {
    var key = this.type;
    if(!this.isNew()) {
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

describe('Integration Test: MongoDb sync', function () {
  before(function(done) {
    mongo.connect(function(err, _db) {
      if(err) {
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
    it('should save model', function (next) {
      var testModel = new TestModel({data: 2});
      testModel.save().then( function(model) {
        model.get('data').should.equal(2);
        testId = model.id;
        testId.should.be.ok;
        next();
      }, next);
    });


    it('should fetch model', function (next) {
      var testModel = new TestModel({id: testId});
      testModel.fetch().done(function(model){
        next();
      }, next);
    });

    it('should destroy model', function(next) {
      var testModel = new TestModel({id: testId});
      testModel
        .destroy()
        .done(function (m) {
          next();
        }, next);
    });
  });

  describe('#collection', function() {
    var collection = new TestCollection();

    it('should create model', function(next) {
      collection
        .create({data: 1})
        .done(function(m) {
          next();
        }, next);
    });

    it('should create another model', function(next) {
      collection
        .create({data: 2})
        .done(function(m) {
          next();
        }, next);
    });

    it('should fetch all models', function(next) {
      collection
        .fetch()
        .done(function() {
          collection.length.should.equal(2);
          next();
        });
    });

    it('should fetch models filtered with options', function(next) {
      var opts = {
        where: {
          data: 2
        },
        limit: 1,
        offset: 0
      };
      collection
      .fetch(opts)
      .done(function() {
        collection.length.should.equal(1);
        var m = collection.at(0);
        should.exist(m);
        m.get('data').should.equal(2);
        next();
      }, next);
    });
  });
});
