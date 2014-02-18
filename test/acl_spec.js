var setup = require('./test_setup');
require('chai').should();
var serverbone = require('..');
var ACL = serverbone.acl.ACL;
var ACLModel = setup.ACLModel;
var ACLUserCollection = setup.ACLUserCollection;
var SystemUser = setup.SystemUser;

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

    describe.only('ACLModel', function () {
      var user, admin, model, users;

      before(function(next) {
        setup.setupDb(function() {
          console.log(SystemUser);
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

      it('should set read/update/delete to options.actions on save/fetch/destroy', function() {
        var m = new ACLModel({user_id: user.get(user.idAttribute)});

        return m.save(null, {actor: user}).then(function() {
          console.log();
        });
      });

       /* var orig = m.canAccess;



        return m.fetch({actor: m}).then(function() {
          console.log(actions);
          return m.save({test: 123},{actor: m}).then(function() {
            return m.save({id: 1,test: 123}, {actor: m}).then(function() {
              return m.destroy().then(function() {
                actions.length.should.equal(4);
              });
            });
          });
        });*/
    });

    describe('ACLCollection', function () {
      it('should set create to options.actions on create', function() {

      });
    });

  });
});


