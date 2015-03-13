require('./test_setup');
var sinon = require('sinon');
var should = require('chai').should();
var serverbone = require('..');
var BaseModel = serverbone.models.BaseModel;
var BaseCollection = serverbone.collections.BaseCollection;

var Db = require('backbone-db-local');
var testDb = new Db('testdb');

var User = BaseModel.extend({
  type: 'user',
  sync: Db.sync.bind(testDb),
  db: testDb
});

var testSchema = {
  id: 'schemas/test',
  type: 'object',
  properties: {
    data: {
      'type': 'integer'
    },
    user_id: {
      'type': 'integer'
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
  sync: Db.sync.bind(testDb),
  db: testDb
});

describe('BaseModelRelations', function() {
  var model;
  var sandbox;
  var user;

  before(function() {
    sandbox = sinon.sandbox.create();
    user = new User();
    return user.save();
  });

  after(function() {
    sandbox.restore();
  });

  it('should init relations', function() {
    model = new TestModel({
      user_id: user.id,
      data: 666
    });
    model.get('owner').get('id').should.equal(user.id);
  });

  it('should save model & its relations', function() {
    var spy = sandbox.spy(model.get('owner'), 'save');
    return model
      .saveAll()
      .then(function() {
        spy.called.should.equal(true);
      });
  });

  it('should fetch relations', function() {
    model = new TestModel({id: model.id});
    return model
      .fetchAll()
      .then(function() {
        should.exist(model.get('owner'));
      });
  });

  it('should fetch model', function() {
    model = new TestModel({id: model.id});
    return model
      .fetch()
      .then(function() {
        model.get('user_id').should.equal(user.id);
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

  it('should fetch required', function() {
    var m = new TestModel({id: model.id});
    return m
      .fetchRequired({
        onlyFields: ['data'],
        owner: ['id']
      })
      .then(function() {
        should.exist(m.get('data'));
        should.exist(m.get('owner'));
      });
  });

  it('should fetch relations with collection helper function', function() {
    var collection = new BaseCollection();
    var m = new TestModel({id: model.id});
    collection.add(m);
    return collection
      .fetchModelRelations()
      .then(function() {
        should.exist(m.get('owner'));
      });
  });

  it('should output json based on config', function() {
    var json = model.toJSON();
    Object.keys(json).length.should.equal(2);

    model.get('owner').set('name', 'Name');
    json = model.toJSON({
      recursive: true,
      projection: {
        owner: ['name']
      }
    });
    Object.keys(json).length.should.equal(3);
    should.not.exist(json.owner.id);
    should.exist(json.owner.name);

    // whitelisting
    json = model.toJSON({
      recursive: true,
      projection: {
        onlyFields: ['owner']
      }
    });
    should.exist(json.owner);
    should.not.exist(json.data);
    Object.keys(json).length.should.equal(1);

    // blacklisting
    json = model.toJSON({
      recursive: true,
      projection: {
        removeFields: ['owner']
      }
    });
    Object.keys(json).length.should.equal(2);
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
    var _user = new User({id: 1});
    return _user.fetchAll();
  });

  it('should be able to saveAll even if no relations defined', function() {
    var _user = new User();
    return _user.saveAll();
  });
});
