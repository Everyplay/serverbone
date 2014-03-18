var testSetup = require('./test_setup');
var _ = require('lodash');
var sinon = require('sinon');
var should = require('chai').should();
var serverbone = require('..');
var BaseModel = serverbone.models.BaseModel;
var BaseCollection = serverbone.collections.BaseCollection;
var assert = require('chai').assert;
var when = require('when');

var Db = require('backbone-db');
var testDb = new Db('testdb');

var userSchema = {
  id: 'shemas/test-user',
  type: 'object',
  properties: {
    parent_id: {
      type: 'integer'
    },
    username: {
      type: 'string'
    },
    parent: {
      type: 'relation',
      '$ref': '#',
      references: {id: 'parent_id'}
    }
  }
};

var User = BaseModel.extend({
  type: 'user',
  sync: Db.sync.bind(testDb),
  schema: userSchema
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
      references: {
        id: 'user_id'
      }
    }
  }
};

var TestModel = BaseModel.extend({
  type: 'video',
  schema: testSchema,
  sync: Db.sync.bind(testDb)
});

describe('BaseModel Relations', function() {
  var model;
  var user;
  var parent;
  var sandbox;

  before(function() {
    sandbox = sinon.sandbox.create();
    parent = new User({username: 'parent'});
    return parent.save().then(function() {
      user = new User({username: 'user', parent_id: parent.id});
      return user.save();
    });
  });

  after(function() {
    sandbox.restore();
    return when.all([parent.destroy(), user.destroy()]);
  });

  it('should init relations', function() {
    model = new TestModel({
      user_id: 1,
      data: 666
    });
    model.get('owner').get('id').should.equal(1);
  });

  it('should save relations', function() {
    var spy = sandbox.spy(model.get('owner'), 'save');
    return model
      .saveAll()
      .then(function() {
        spy.called.should.equal(true);
      });
  });

  it('should fetch relations', function() {
    var spy = sandbox.spy(model.get('owner'), 'fetch');
    return model
      .fetchAll()
      .then(function() {
        spy.called.should.equal(true);
        model.get('owner').fetch.restore();
      });
  });

  it('should fetch only specified relations', function() {
    return model
      .fetchRelations({
        onlyRelations: ['owner']
      })
      .then(function() {
        should.exist(model.get('owner'));
      });
  });

  it.only('should fetch nested relations', function() {
    var m = new TestModel({
      user_id: user.id
    });
    return m.save().then(function() {
      return m
        .fetchAll({
          nestedRelations: [{relation: 'owner', properties: ['parent']}]
        })
        .then(function() {
          console.log(m.get('owner').get('parent').attributes);
          return m.destroy();
        });
    });
  });

  it('should fetch relations with collection helper function', function() {
    var collection = new BaseCollection();
    collection.add(model);
    var spy = sandbox.spy(model.get('owner'), 'fetch');
    return collection
      .fetchModelRelations()
      .then(function() {
        spy.called.should.equal(true);
        model.get('owner').fetch.restore();
      });
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

  it('should apply destroy fn to relations', function() {
    var spy = sandbox.spy(model.get('owner'), 'destroy');
    return model
      .applyToAll('destroy')
      .then(function() {
        spy.called.should.equal(true);
      });
  });

  it('should create model', function() {
    model = new TestModel({
      user_id: 1
    });
    return model.saveAll();
  });

  it('should call fetchAll before deleting', function() {
    model = new TestModel({
      id: model.id,
      user_id: 1
    });
    var spy = sandbox.spy(model, 'fetchAll');
    return model
      .destroy()
      .then(function() {
        spy.called.should.equal(true);
      });
  });

  it('should be able to fetchAll even if no relations defined', function() {
    var user = new User({id: 1});
    return user
      .fetchAll();
  });

  it('should be able to saveAll even if no relations defined', function(next) {
    var user = new User();
    return user.saveAll();
  });
});