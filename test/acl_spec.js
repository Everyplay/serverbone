var setup = require('./test_setup');
require('chai').should();
var serverbone = require('..');
var ACL = serverbone.acl.ACL;
var ACLModel = setup.ACLModel;
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
      var user, admin, model, users;

      before(function(next) {
        setup.setupDbs(function() {
          users = new ACLUserCollection();
          users.create(null, {actor: SystemUser}).done(function(model) {
            user = model;
            users.create(null, {actor: SystemUser}).done(function(adm) {
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


      it('should save with an actor that has access', function() {
        model = new ACLModel({user_id: user.get(user.idAttribute)});
        return model.save(null, {actor: user});
      });

      it('should update with an actor that has access', function() {
        return model.save({description: 'test desription'}, {actor: user}).then(function() {
          var m = new ACLModel({id: model.get(model.idAttribute)});
          return m.fetch().then(function() {
            m.get('description').should.equal('test desription');
          });
        });
      });

      it('should destroy with an actor that has access', function() {
        return model.destroy(null, {actor: user});
      });

      it('should verify that the resource was deleted', function() {
        var m = new ACLModel({id: model.get(model.idAttribute)});
        return m.fetch().then(function() {
          return when.reject(new Error('should not fetch a deleted model'));
        }, function() {
          return when.resolve();
        });
      });
    });
  });
});


