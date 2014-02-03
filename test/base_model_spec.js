var _ = require('lodash');
var sinon = require('sinon');
var should = require('chai').should();
var epm = require('..');
var BaseModel = epm.models.BaseModel;
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

    it('should throw an error if trying to save model without sync setup', function(done) {
      var FooModel = BaseModel.extend({});
      var f = new FooModel();
      try {
        f.save();
        assert(false);
      } catch(e) {
        done();
      }
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
      testModel.save().then(
        function(model) {
          model.get('data').should.be.equal(2);
          model.url().should.be.ok;
          testId = model.get('id');
          testId.should.be.ok;
          preSpy.called.should.be.ok;
          afterSpy.called.should.be.ok;
          done();
        }, assert.fail).otherwise(function(err) {
          done(err);
        });
    });

    it('should pass options to afterSave', function(done) {
      var testModel = new TestModel();
      var afterSpy = sinon.spy(testModel, 'afterSave');
      testModel
        .save(null, {foo: 'bar'})
        .then(function() {
          var opts = afterSpy.args[0][0];
          should.exist(opts);
          should.exist(opts.foo);
          done();
        }).otherwise(done);
    });

    it('should change model attribute', function(done) {
      var testModel = new TestModel({id: testId});
      testModel.set('data', 99);
      testModel
        .save()
        .then(function(model) {
          model.get('data').should.equal(99);
          done();
        })
        .otherwise(done);
    });

    it('should fetch model', function (done) {
      var testModel = new TestModel({id: testId});
      testModel.fetch().then(function(model){
        // depends values set in previous test
        testModel.get('data').should.be.equal(99);
        model.get('data').should.be.equal(99);
        done();
      }, assert.fail).otherwise(function(err) {
        done(err);
      });
    });

    it('should inc a model attribute', function(done) {
      var testModel = new TestModel({id: testId});
      var opts = {
        inc: {
          attribute: 'data',
          amount: 1
        }
      };
      testModel
        .save(null, opts)
        .then(function() {
          testModel.get('data').should.equal(100);
          done();
        }).otherwise(done);
    });

    it('should destroy model', function(done) {
      var testModel = new TestModel({id: testId});
      testModel
        .destroy()
        .then(function (u) {
          //console.log(u.toJSON());
          done();
        })
        .otherwise(done);
    });

    it('should not fetch destroyed model', function (done) {
      var testModel = new TestModel({id: testId});
      testModel
        .fetch()
        .then(function() {
          assert.ok(false);
        }).otherwise(function() {
          //TODO: check error
          done();
        });
    });

  });
});

