var should = require('chai').should();
var serverbone = require('..');
var BaseModel = serverbone.models.BaseModel;
var assert = require('chai').assert;

var RedisDb = require('backbone-db-redis');
var testDb = require('../config/redis');
var redis = testDb.redis;

var testSchema = {
  id: 'schemas/test',
  type: 'object',
  properties: {
    data: {
      type: 'integer',
    }
  },
  indexes: [
    {property: 'data'}
  ]
};

var TestModel = BaseModel.extend({
  type: 'redistestmodel',
  schema: testSchema,
  sync: RedisDb.sync.bind(testDb),
  db: testDb,
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
  sync: RedisDb.sync.bind(testDb),
  url: function() {
    return this.type;
  }
});

var clearDb = function(next) {
  redis.keys('*redistestmodel*', function(err, keys) {
    keys.forEach(function(key) {
      redis.del(key);
    });
    next();
  });
};

describe('Integration Test: Redis sync', function () {
  after(function(next) {
    clearDb(function(err) {
      next(err);
    });
  });

  describe('#model', function() {
    var testId;
    it('should save model', function () {
      var testModel = new TestModel({data: 2});
      return testModel.save().then( function(model) {
        model.get('data').should.equal(2);
        testId = model.id;
        testId.should.be.ok;
      });
    });


    it('should fetch model', function () {
      var testModel = new TestModel({id: testId});
      return testModel.fetch();
    });

    it('should destroy model', function() {
      var testModel = new TestModel({id: testId});
      return testModel
      .destroy();
    });
  });

  describe('#collection', function() {
    var collection = new TestCollection();

    it('should create model', function() {
      return collection
        .create({data: 1});
    });

    it('should create another model', function() {
      return collection
        .create({data: 2});
    });

    it('should fetch all models', function() {
      return collection
        .fetch()
        .then(function() {
          collection.length.should.equal(2);
        });
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
