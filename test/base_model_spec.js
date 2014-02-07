var _ = require('lodash');
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
  type:'video',
  schema: testSchema,
  sync: Db.sync.bind(testDb)
});

describe('BaseModel', function() {

  describe('Basic setup', function () {
    it('should return template values', function () {
      var cntx = {type: 'video', id: 1};
      var options = {type: '{type}', video_id: '{id}', kissa: 'cat'};
      var formattedProps = BaseModel.formatProperties.call(cntx, options);
      should.exist(formattedProps);
      formattedProps.type.should.equal('video');
      formattedProps.video_id.should.equal('1');
      formattedProps.kissa.should.equal('cat');
    });

    it('should throw an error if trying to save model without sync setup', function(next) {
      var FooModel = BaseModel.extend({});
      var f = new FooModel();
      f.save().done(function() {
        next(new Error('should not save'));
      }, function(err) {
        next();
      });
    });

    it('model should return its url', function() {
      var m = new TestModel();
      m.url();
    });
  });

  describe('CRUD', function () {
    var testId;

    it('should have initialized type', function () {
      var testModel = new TestModel();
      testModel.type.should.equal('video');
    });

    it('should save model', function (done) {
      var testModel = new TestModel({data: 2});
      should.exist(TestModel.prototype.sync);
      should.exist(testModel.sync);
      _.isFunction(TestModel.prototype.sync).should.be.ok;
      _.isFunction(testModel.sync).should.be.ok;
      testModel.isValid().should.equal(true);
      testModel.isNew().should.equal(true);
      var preSpy = sinon.spy(testModel, 'preSave');
      var afterSpy = sinon.spy(testModel, 'afterSave');
      testModel.save().done( function(model) {
        model.get('data').should.be.equal(2);
        model.url().should.be.ok;
        testId = model.get('id');
        testId.should.be.ok;
        preSpy.called.should.be.ok;
        afterSpy.called.should.be.ok;
        done();
      }, done);
    });

    it('should pass options to afterSave', function(next) {
      var testModel = new TestModel();
      var afterSpy = sinon.spy(testModel, 'afterSave');
      testModel
        .save(null, {foo: 'bar'})
        .done(function() {
          var opts = afterSpy.args[0][0];
          should.exist(opts);
          should.exist(opts.foo);
          next();
        }, next);
    });

    it('should change model attribute', function(next) {
      var testModel = new TestModel({id: testId});
      testModel.set('data', 99);
      testModel
        .save()
        .done(function(model) {
          model.get('data').should.equal(99);
          next();
        }, next);
    });

    it('should fetch model', function (next) {
      var testModel = new TestModel({id: testId});
      testModel.fetch().done(function(model){
        // depends values set in previous test
        testModel.get('data').should.be.equal(99);
        model.get('data').should.be.equal(99);
        next();
      }, next);
    });

    it('should inc a model attribute', function(next) {
      var testModel = new TestModel({id: testId});
      var opts = {
        inc: {
          attribute: 'data',
          amount: 1
        }
      };
      testModel
        .save(null, opts)
        .done(function() {
          testModel.get('data').should.equal(100);
          next();
        }, next);
    });

    it('should destroy model', function(next) {
      var testModel = new TestModel({id: testId});
      testModel
        .destroy()
        .done(function (u) {
          //console.log(u.toJSON());
          next();
        }, next);
    });

    it('should not fetch destroyed model', function (next) {
      var testModel = new TestModel({id: testId});
      testModel
        .fetch()
        .done(function() {
          assert.ok(false);
          next(new Error());
        }, function() {
          next();
        });
    });

  });
});

