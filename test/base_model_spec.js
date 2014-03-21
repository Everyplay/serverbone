var testSetup = require('./test_setup');
var _ = require('lodash');
var when = require('when');
var sinon = require('sinon');
var should = require('chai').should();
var serverbone = require('..');
var BaseModel = serverbone.models.BaseModel;
var assert = require('chai').assert;

var Db = require('backbone-db');
var testDb = new Db('testdb');

var testSchema = {
  id: 'schemas/test',
  type: 'object',
  properties: {
    data: {
      'type': 'integer',
    }
  }
};

var TestModel = BaseModel.extend({
  type: 'video',
  schema: testSchema,
  sync: Db.sync.bind(testDb)
});

describe('BaseModel', function() {

  describe('Basic setup', function() {
    it('should return template values', function() {
      var cntx = {
        type: 'video',
        id: 1
      };
      var options = {
        type: '{type}',
        video_id: '{id}',
        kissa: 'cat'
      };
      var formattedProps = BaseModel.formatProperties.call(cntx, options);
      should.exist(formattedProps);
      formattedProps.type.should.equal('video');
      formattedProps.video_id.should.equal('1');
      formattedProps.kissa.should.equal('cat');
    });

    it('should throw an error if trying to save model without sync setup', function() {
      var FooModel = BaseModel.extend({});
      var f = new FooModel();
      return f
        .save()
        .then(function() {
          return when.reject(new Error('should not save'));
        }, function(err) {
          return when.resolve();
        });
    });

    it('model should return its url', function() {
      var m = new TestModel();
      m.url();
    });

    it('should store changed attributes since last sync', function() {
      var m = new TestModel({foo: 'bar', data: 1});
      return m.save().then(function() {
        m.set('foo', 'next');
        m.set('data', 2);
        var changed = m.changedSinceSync();
        should.exist(changed.foo);
        should.exist(changed.data);
        changed.data.should.equal(2);
        return m.save().then(function() {
          m.set('data', 3);
          m.previousAttributes().data.should.equal(2);
          return m.save().then(function() {
            changed = m.changedSinceSync();
            Object.keys(changed).length.should.equal(0);
            return m.destroy();
          });
        });

      });
    });
  });

  describe('CRUD', function() {
    var testId;

    it('should have initialized type', function() {
      var testModel = new TestModel();
      testModel.type.should.equal('video');
    });

    it('should save model', function() {
      var testModel = new TestModel({
        data: 2
      });
      should.exist(TestModel.prototype.sync);
      should.exist(testModel.sync);
      _.isFunction(TestModel.prototype.sync).should.be.ok;
      _.isFunction(testModel.sync).should.be.ok;
      testModel.isValid().should.equal(true);
      testModel.isNew().should.equal(true);
      var preSpy = sinon.spy(testModel, 'preSave');
      var afterSpy = sinon.spy(testModel, 'afterSave');

      return testModel
        .save()
        .then(function(model) {
          model.get('data').should.be.equal(2);
          model.url().should.be.ok;
          testId = model.get('id');
          testId.should.be.ok;
          preSpy.called.should.be.ok;
          afterSpy.called.should.be.ok;
        });
    });

    it('should pass options to afterSave', function() {
      var testModel = new TestModel();
      var afterSpy = sinon.spy(testModel, 'afterSave');

      return testModel
        .save(null, {
          foo: 'bar'
        })
        .then(function() {
          var opts = afterSpy.args[0][0];
          should.exist(opts);
          should.exist(opts.foo);
        });
    });

    it('should change model attribute', function() {
      var testModel = new TestModel({
        id: testId
      });
      testModel.set('data', 99);
      return testModel
        .save()
        .then(function(model) {
          model.get('data').should.equal(99);
        });
    });

    it('should fetch model', function() {
      var testModel = new TestModel({
        id: testId
      });
      return testModel
        .fetch()
        .then(function(model) {
          console.log(model);
          // depends values set in previous test
          testModel.get('data').should.be.equal(99);
          model.get('data').should.be.equal(99);
        });
    });

    it('should inc a model attribute', function() {
      var testModel = new TestModel({
        id: testId
      });
      var opts = {
        inc: {
          attribute: 'data',
          amount: 1
        }
      };
      return testModel
        .save(null, opts)
        .then(function() {
          testModel.get('data').should.equal(100);
        });
    });

    it('should destroy model', function() {
      var testModel = new TestModel({
        id: testId
      });
      return testModel
        .destroy();
    });

    it('should not fetch destroyed model', function() {
      var testModel = new TestModel({
        id: testId
      });
      return testModel
        .fetch()
        .then(function() {
          assert.ok(false);
          return when.reject();
        }, function() {
          return when.resolve();
        });
    });

    it('should return 404 error when fetched Model is not found', function() {
      var testModel = new TestModel({id: 'foo'});
      return testModel
        .fetch()
        .then(function() {
          return when.reject('should not be found');
        }, function(err) {
          err.status.should.equal(404);
          return when.resolve();
        });
    });

    it('should return 404 if trying to destroy non-existent model', function() {
      var testModel = new TestModel({id: 'foo'});
      return testModel
        .destroy()
        .then(function() {
          return when.reject('should not be found');
        }, function(err) {
          err.status.should.equal(404);
          return when.resolve();
        });
    });
  });
});