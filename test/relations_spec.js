var _ = require('lodash');
var sinon = require('sinon');
var should = require('chai').should();
var serverbone = require('..');
var BaseModel = serverbone.models.BaseModel;
var BaseCollection = serverbone.collections.BaseCollection;
var assert = require('chai').assert;

var Db = require('backbone-db');
var testDb = new Db('testdb');

var User = BaseModel.extend({
  type: 'user',
  sync: Db.sync.bind(testDb)
});

var testSchema = {
  id: 'schemas/test',
  type: 'object',
  properties: {
    data: {
      'type': 'integer',
    },
    owner: {
      type: 'relation',
      model: User,
      references: {id: 'user_id'}
    }
  }
};

var TestModel = BaseModel.extend({
  type:'video',
  schema: testSchema,
  sync: Db.sync.bind(testDb)
});

describe('BaseModel Relations', function() {
  var model;
  var sandbox;

  before(function() {
    sandbox = sinon.sandbox.create();
  });

  after(function() {
    sandbox.restore();
  });

  it('should init relations', function() {
    model = new TestModel({user_id: 1, data: 666});
    model.get('owner').get('id').should.equal(1);
  });

  it('should save relations', function(next) {
    var spy = sandbox.spy(model.get('owner'), 'save');
    model
      .saveAll()
      .done(function() {
        spy.called.should.equal(true);
        next();
      }, next);
  });

  it('should fetch relations', function(next) {
    var spy = sandbox.spy(model.get('owner'), 'fetch');
    model
      .fetchAll()
      .done(function() {
        spy.called.should.equal(true);
        model.get('owner').fetch.restore();
        next();
      }, next);
  });

  it('should fetch relations with collection helper function', function(next) {
    var collection = new BaseCollection();
    collection.add(model);
    var spy = sandbox.spy(model.get('owner'), 'fetch');
    collection
      .fetchModelRelations()
      .done(function() {
        spy.called.should.equal(true);
        model.get('owner').fetch.restore();
        next();
      }, next);
  });

  it('should output json based on config', function() {
    var json = model.toJSON();
    Object.keys(json).length.should.equal(1);

    model.get('owner').set('name', 'Name');
    json = model.toJSON({
      recursive: true,
      projection: {
        owner: ['name']
      }
    });
    Object.keys(json).length.should.equal(2);
    should.not.exist(json.owner.id);
    should.exist(json.owner.name);

    //whitelisting
    json = model.toJSON({
      recursive: true,
      projection: {
        onlyFields: ['owner']
      }
    });
    should.exist(json.owner);
    should.not.exist(json.data);
    Object.keys(json).length.should.equal(1);

    //blacklisting
    json = model.toJSON({
      recursive: true,
      projection: {
        removeFields: ['owner']
      }
    });
    Object.keys(json).length.should.equal(1);
    should.not.exist(json.owner);
    should.exist(json.data);
  });

  it('should apply destroy fn to relations', function(next) {
    var spy = sandbox.spy(model.get('owner'), 'destroy');
    model
      .applyToAll('destroy')
      .done(function() {
        spy.called.should.equal(true);
        next();
      }, next);
  });

  it('should create model', function(next) {
    model = new TestModel({user_id: 1});
    model
      .saveAll()
      .done(function() {
        next();
      }, next);
  });

  it('should call fetchAll before deleting', function(next) {
    model = new TestModel({id: model.id, user_id: 1});
    var spy = sandbox.spy(model, 'fetchAll');
    model
      .destroy()
      .done(function() {
        spy.called.should.equal(true);
        next();
      }, next);
  });

  it('should be able to fetchAll even if no relations defined', function(next) {
    var user = new User();
    user
      .fetchAll()
      .done(function() {
        next();
      }, next);
  });

  it('should be able to saveAll even if no relations defined', function(next) {
    var user = new User();
    user
      .saveAll()
      .done(function() {
        next();
      }, next);
    });
});
