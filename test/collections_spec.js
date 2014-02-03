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

  after(function(done) {
    testSetup.clearDb();
    done();
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
    it('should create models', function(done) {
      // TODO: test create when failing validation
      collection.create({test: '1', title: 'foo1'}).then(function(model) {
        model.id.should.be.ok;
        done();
      }, function(err) {
        done(err);
      }).otherwise(done);
    });

    it('should create another model', function(done) {
      collection.create({test: '2', title: 'foo2'}).then(function(model) {
        collection.length.should.equal(2);
        model.id.should.be.ok;
        done();
      }).otherwise(done);
    });

    it('should fetch 2 models', function(done) {
      collection.fetch().then(function() {
        collection.length.should.equal(2);
        testId = collection.at(1).id;
        testId.should.be.ok;
        collection.at(1).get('test').should.equal('2');
        done();
      }).otherwise(done);
    });

    it('should load models created through the collection', function(done) {
      var m = new collection.model({id: testId});
      m.fetch().then(
        function() {
          m.get('id').should.equal(testId);
          done();
        }
      ).otherwise(done);
    });


    it('should destroy model', function(done) {
      var m = collection.at(1);
      testId = m.id;
      m
        .destroy()
        .then(function() {
          collection.length.should.equal(1);
          done();
        })
        .otherwise(done);
    });

    it('should verify that model was destroyed', function(done) {
      var m = new collection.model({id: testId});
      m.fetch()
        .then(function() {
          assert.ok(false);
        }, function(err) {
          err.should.be.instanceOf(Error);
          done();
        })
        .otherwise(function(err) {
          done(err);
        });
    });

    it('should fail creating if model preSave fails', function(done) {
      var coll = new FailingCollection();
      coll
        .create()
        .then(function() {
          assert.ok(false);
          done();
        }).otherwise(function(err) {
          err.message.should.equal('foo reason');
          done();
        }).otherwise(done);
    });

    it('should destroy all models from collection', function(done) {
      collection.length.should.equal(1);
      collection
        .destroyAll()
        .then(function() {
          collection.length.should.equal(0);
          done();
        }).otherwise(done);
    });

    it('should check that models were removed', function(done) {
      collection
        .fetch()
        .then(function() {
          collection.length.should.equal(0);
          done();
        }).otherwise(done);
    });
  });

});