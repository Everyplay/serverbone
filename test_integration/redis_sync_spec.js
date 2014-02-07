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

var clearDb = function(cb) {
  redis.keys('*redistestmodel*', function(err, keys) {
    keys.forEach(function(key) {
      redis.del(key);
    });
    cb();
  });
};

describe('Integration Test: Redis sync', function () {
  after(function(done) {
    clearDb(function(err) {
      done(err);
    });
  });

  describe('#model', function() {
    var testId;
    it('should save model', function (next) {
      var testModel = new TestModel({data: 2});
      testModel.save().done( function(model) {
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
      .destroy().done(function (m) {
          //console.log(m.toJSON());
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
        }, next);
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
