var should = require('chai').should();
var assert = require('chai').assert;
var testSetup = require('./test_setup');
var TestCollection = testSetup.TestCollection;
var FailingCollection = testSetup.FailingCollection;
var TemplatedCollection = TestCollection.extend({
  defaultOptions: {
    where: {
      users: '{user_id}'
    }
  }
});
var PlatformCollection = TestCollection.extend({
  defaultOptions: {
    where: {
      foo: false,
      platforms: {
        $in: '{platforms}'
      }
    }
  }
});

describe('BaseCollection tests', function () {
  var testId;
  var collection = new TestCollection();

  after(function(next) {
    testSetup.clearDb();
    next();
  });

  describe('Setup', function() {
    it('should create collection instance', function () {
      should.exist(collection.length);
      collection.length.should.equal(0);
    });

    it('should replace templated properties', function() {
      TemplatedCollection.prototype.defaultOptions.where.users.should.equal('{user_id}');
      var col = new TemplatedCollection([], {user_id: 1});
      col.defaultOptions.where.users.should.equal(1);
    });

    it('should setup default filtering options', function() {
      var col = new PlatformCollection(null, {platforms: ['android']});
      col.defaultOptions.where.platforms.$in[0].should.equal('android');
    });

    it('should get the url for collection', function() {
      var col = new PlatformCollection(null, {platforms: ['foo']});
      col.url.should.be.ok;
    });
  });

  describe('CRUD', function() {
    it('should create models', function(next) {
      // TODO: test create when failing validation
      collection.create({test: '1', title: 'foo1'}).done(function(model) {
        model.id.should.be.ok;
        next();
      }, next);
    });

    it('should create another model', function(next) {
      collection.create({test: '2', title: 'foo2'}).done(function(model) {
        collection.length.should.equal(2);
        model.id.should.be.ok;
        next();
      }, next);
    });

    it('should fetch 2 models', function(next) {
      collection.fetch().done(function() {
        collection.length.should.equal(2);
        testId = collection.at(1).id;
        testId.should.be.ok;
        collection.at(1).get('test').should.equal('2');
        next();
      }, next);
    });

    it('should load models created through the collection', function(next) {
      var m = new collection.model({id: testId});
      m.fetch().done( function() {
        m.get('id').should.equal(testId);
        next();
      }, next);
    });

    it('should destroy model', function(next) {
      var m = collection.at(1);
      testId = m.id;
      m.destroy()
        .done(function() {
          collection.length.should.equal(1);
          next();
        }, next);
    });

    it('should verify that model was destroyed', function(next) {
      var m = new collection.model({id: testId});
      m.fetch().done(function() {
          assert.ok(false);
          next(new Error());
        }, function(err) {
          err.should.be.instanceOf(Error);
          next();
        });
    });

    it('should fail creating if model preSave fails', function(next) {
      var coll = new FailingCollection();
      coll
        .create()
        .done(function() {
          assert.ok(false);
          next(new Error());
        }, function(err) {
          err.message.should.equal('foo reason');
          next();
        });
    });

    it('should destroy all models from collection', function(next) {
      collection.length.should.equal(1);
      collection
        .destroyAll()
        .done(function() {
          collection.length.should.equal(0);
          next();
        }, next);
    });

    it('should check that models were removed', function(next) {
      collection
        .fetch()
        .done(function() {
          collection.length.should.equal(0);
          next();
        }, next);
    });
  });

});