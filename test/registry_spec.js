var testSetup = require('./test_setup');
var should = require('chai').should();
var sinon = require('sinon');
var serverbone = require('..');
var BaseModel = serverbone.models.BaseModel;
var Db = require('backbone-db');
var TestDB = new Db('registry_db');

describe('Registry tests', function() {
  var sandbox;

  var TestModel = BaseModel.extend({
    type: 'video',
    sync: Db.sync.bind(TestDB),
    afterSave: function() {
      var res = TestModel.__super__.afterSave.apply(this, arguments);
      if (this.options.registry) {
        this.options.registry.set(this);
      }
      return res;
    }
  });

  beforeEach(function() {
    sandbox = sinon.sandbox.create();
  });

  afterEach(function() {
    sandbox.restore();
  });

  it('should set value to Registry', function() {
    var model = new TestModel({
      test: 'foo'
    });
    var registry = new serverbone.Registry();
    registry.set(model);
    var cachedModel = registry.get(model.type, model.id);
    should.exist(cachedModel);
  });

  it('should cache model when saving', function() {
    var registry = new serverbone.Registry();
    var set = sandbox.spy(registry, 'set');

    var model = new TestModel({
      title: 'bar'
    }, {
      registry: registry
    });
    model.isValid().should.equal(true);
    return model
      .save()
      .then(function() {
        should.exist(model.id, 'Model id was missing');
        set.called.should.equal(true);
        var cachedModel = registry.get(model.type, model.id);
        should.exist(cachedModel, 'cached model did not exist');
        cachedModel.should.be.an.instanceOf(TestModel);
        cachedModel.get('title').should.equal('bar');
      });
  });
});