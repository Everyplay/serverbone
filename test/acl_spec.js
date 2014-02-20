var setup = require('./test_setup');
require('chai').should();
var serverbone = require('..');
var ACL = serverbone.acl.ACL;
var ACLModel = setup.ACLModel;
var ACLCollection = setup.ACLCollection;
var ACLUserCollection = setup.ACLUserCollection;
var SystemUser = setup.SystemUser;
var when = require('when');

describe('Test ACL', function () {
    describe('Access Roles', function () {
    var acl;
    before(function () {
      acl = new ACL({
        'owner': ['write', 'read', 'update'],
        '*': ['read']
      });
    });
    it('should be possible to make ACL assertions agains roles and actions', function () {
      acl.assert('owner', 'write').should.equal(true);
      acl.assert('public', 'write').should.equal(false);
      acl.assert('owner', 'delete').should.equal(false);
      acl.assert('read').should.equal(true);
      acl.assert('write').should.equal(false);
    });
    it('should be possible to add more rules with .allow', function () {
      acl.grant({
        'owner': ['delete'],
        'admin': ['*']
      });
      acl.assert('admin', 'write').should.equal(true);
      acl.assert('admin', 'read').should.equal(true);
      acl.assert('admin', 'nonexisting').should.equal(true);
      acl.assert('owner', 'delete').should.equal(true);
    });
    it('should be possible to grant and revoke access', function () {
      acl.grant({
        'tester': ['read', 'write'],
        'owner': ['read', 'write', 'delete']
      });
      acl.assert('owner', 'delete').should.equal(true);
      acl.revoke('owner');
      acl.assert('owner', 'delete').should.equal(false);
      acl.grant({
        'owner': ['delete']
      });
      acl.assert('owner', 'delete').should.equal(true);
      acl.revoke(['owner', 'user', 'tester']);
      acl.assert('owner', 'delete').should.equal(false);
    });
    it('should recognice the "*" selector in roles and permissions', function () {
      acl.grant({
        'test': '*'
      });
      acl.assert('test', 'anything').should.equal(true);
      acl.assert('test2', 'anything').should.equal(false);
      acl.grant({
        '*': 'abolish'
      });
      acl.assert('anyone', 'abolish').should.equal(true);
      acl.assert('anyone', 'destroye').should.equal(false);
    });

    describe('ACLModel', function () {
      var user, admin, model, users, actor, aclmodel;

      before(function(next) {
        setup.setupDb(function() {
          users = new ACLUserCollection(null, {actor: SystemUser});
          users.create().done(function(model) {
            user = model;
            users.create(null).done(function(adm) {
              admin = adm;
              next();
            }, next);
          }, next);
        });
      });

      after(function(next) {
        setup.clearDb();
        next();
      });

      beforeEach(function() {
        actor = new ACLModel({id: 1234});
        aclmodel = new ACLModel(null, {actor: actor});
      });

      it('should set actor and action on fetch', function() {
        var options = {};
        aclmodel.fetch(options);
        options.action.should.equal('read');
        options.should.have.property('actor');
        options.actor.get('id').should.equal(actor.id);
        options = {actor: actor};
        aclmodel = new ACLModel(null);
        aclmodel.fetch(options).done();
        options.action.should.equal('read');
        options.should.have.property('actor');
        options.actor.get('id').should.equal(actor.id);
      });

      it('should set actor and action on save', function() {
        var options = {};
        aclmodel.save(null, options).done();
        options.action.should.equal('create');
        options.should.have.property('actor');
        options.actor.get('id').should.equal(actor.id);
        aclmodel.destroy(null, options).done();
        options = {actor: actor};
        aclmodel = new ACLModel(null);
        aclmodel.save(null, options).done();
        options.action.should.equal('create');
        options.should.have.property('actor');
        options.actor.get('id').should.equal(actor.id);
        aclmodel.destroy(null, options).done();
        options = {actor: actor};
        aclmodel = new ACLModel({id: 123123});
        aclmodel.save(null, options);
        options.action.should.equal('update');
        options.should.have.property('actor');
        options.actor.get('id').should.equal(actor.id);
        aclmodel.destroy(options).done();
      });

      it('should set actor and action on destroy', function() {
        var options = {};
        aclmodel.destroy(options);
        options.action.should.equal('destroy');
        options.should.have.property('actor');
        options.actor.get('id').should.equal(actor.id);
        options = {actor: actor};
        aclmodel = new ACLModel(null);
        aclmodel.destroy(options).done();
        options.action.should.equal('destroy');
        options.should.have.property('actor');
        options.actor.get('id').should.equal(actor.id);
        options = {actor: actor};
        aclmodel = new ACLModel({id: 123123});
        aclmodel.destroy(options).done();
        options.action.should.equal('destroy');
        options.should.have.property('actor');
        options.actor.get('id').should.equal(actor.id);
        aclmodel.destroy(options).done();
      });

      it('should save with an actor that has access', function() {
        model = new ACLModel({user_id: user.get(user.idAttribute)});
        return model.save(null, {actor: user});
      });

      it('should update with an actor that has access', function() {
        console.log(model, model.isNew(), model.get('description'));
        var options = {actor: user};
        return model.save({description: 'test desription'}, options).then(function() {
          console.log(options);
          var m = new ACLModel({id: model.get(model.idAttribute)});
          return m.fetch({actor: user}).then(function() {
            m.get('description').should.equal('test desription');
          });
        });
      });

      it('should destroy with an actor that has access', function() {
        return model.destroy(null, {actor: user});
      });

      it('should verify that the resource was deleted', function() {
        var m = new ACLModel({id: model.get(model.idAttribute)});
        return m.fetch({actor: user}).then(function() {
          return when.reject(new Error('should not fetch a deleted model'));
        }, function() {
          return when.resolve();
        });
      });
    });
  });

  describe('ACLCollection tests', function() {
    var model, collection, actor;
    beforeEach(function() {
      model = new ACLCollection.prototype.model({id: 12345});
      actor = new ACLCollection.prototype.model({id: 12346});
      collection = new ACLCollection(null, {actor: actor});
    });
    it('should set correct action and actor for fetch', function() {
      var options = {};
      collection.fetch(options);
      options.action.should.equal('fetch');
      options.should.have.property('actor');
      options.actor.get('id').should.equal(actor.id);
      options = {actor: actor};
      collection = new ACLCollection(null);
      collection.fetch(options);
      options.action.should.equal('fetch');
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
      collection.destroyAll(options);
      options.action.should.equal('destroy');
      options.should.have.property('actor');
      options.actor.get('id').should.equal(actor.id);
      options = {actor: actor};
      collection = new ACLCollection(null);
      collection.destroyAll(options);
      options.action.should.equal('destroy');
      options.should.have.property('actor');
      options.actor.get('id').should.equal(actor.id);
    });
  });
});


