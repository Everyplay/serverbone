var setup = require('./test_setup');
var should = require('chai').should();
var serverbone = require('..');
var when = require('when');
var _ = require('lodash');
var ACLCollection = setup.ACLCollection;
var ACLIndexCollection = setup.ACLIndexCollection;

describe('ACLCollection tests', function() {
  describe('actor options', function() {
    var model, collection, actor;

    after(function(next) {
      collection.length.should.equal(0);
      setTimeout(next, 50);
    });

    beforeEach(function() {
      model = new ACLCollection.prototype.model({id: 12345});
      actor = new ACLCollection.prototype.model({id: 12346});
      actor.addRoles('owner'); // TODO: fix roles
      collection = new ACLCollection(null, {actor: actor});
    });

    it('should set correct action and actor for fetch', function() {
      var options = {};
      collection.fetch(options);
      options.action.should.equal('read');
      options.should.have.property('actor');
      options.actor.get('id').should.equal(actor.id);
      options = {actor: actor};
      collection = new ACLCollection(null);
      collection.fetch(options);
      options.action.should.equal('read');
      options.should.have.property('actor');
      options.actor.get('id').should.equal(actor.id);
    });

    it('should set correct action and actor for create', function() {
      var options = {};
      collection.create(null, options);
      options.action.should.equal('create');
      options.should.have.property('actor');
      options.actor.get('id').should.equal(actor.id);
      options = {actor: actor};
      collection = new ACLCollection(null);
      collection.create(null, options);
      options.action.should.equal('create');
      options.should.have.property('actor');
      options.actor.get('id').should.equal(actor.id);
    });

    it('should set correct action and actor for destroyAll', function() {
      var options = {};
      var promise = collection.destroyAll(options);
      options.action.should.equal('destroy');
      options.should.have.property('actor');
      options.actor.get('id').should.equal(actor.id);
      options = {actor: actor};
      return promise;
    });
  });


  describe('ACLIndexCollection tests', function() {
    var collection;
    var actor;

    before(function() {
      actor = new ACLCollection.prototype.model({id: 12346});
      collection = new ACLIndexCollection(null, {actor: actor});
    });

    it('should not allow addToIndex', function() {
      var model = new collection.model();
      return collection
        .addToIndex(model)
        .then(function() {
          return when.reject(new Error('should have no access'));
        }, function(err) {
          err.statusCode.should.equal(403);
        });
    });

    it('should allow addToIndex', function() {
      var model = actor;
      return collection
        .addToIndex(model, {actor: actor})
        .then(function() {
          collection.length.should.equal(1);
        });
    });

    it('should read from index', function() {
      return collection
        .readFromIndex()
        .then(function() {
          collection.length.should.equal(1);
        });
    });

    it('should remove from index', function() {
      var model = actor;
      return collection
        .removeFromIndex(model, {actor: actor})
        .then(function() {
          collection.length.should.equal(0);
        });
    });

    it('should have no access to destroyAll', function() {
      return collection
        .destroyAll()
        .then(function() {
          return when.reject(new Error('Should have no access to destroyAll'));
        }, function(err) {
          return when.resolve();
        });
    });
  });

  describe('AdminACLCollection tests', function() {
    var collection;
    var normal;
    var admin;

    before(function() {
      normal = new ACLCollection.prototype.model({id: 12346});
      admin = new ACLCollection.prototype.model({id: 12346});
      admin.roles = ['admin'];
      collection = new setup.AdminACLCollection();
    });

    it('should not allow user without admin role to fetch', function() {
      return collection
        .fetch({actor: normal})
        .then(function() {
          return when.reject('should not be allowed to read');
        }, function(err) {
          err.statusCode.should.equal(403);
        });
    });

    it('admin should be able to fetch', function() {
      return collection
        .fetch({actor: admin})
        .then(function() {

        });
    });
  });
});