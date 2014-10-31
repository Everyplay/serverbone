var setup = require('./test_setup');
var should = require('chai').should();
var serverbone = require('..');
var ACL = require('serverbone-acl').ACL;
var ACLModel = setup.ACLModel;
var ACLCollection = setup.ACLCollection;
var ACLUser = setup.ACLUser;
var ACLUserCollection = setup.ACLUserCollection;
var SystemUser = setup.SystemUser;
var when = require('when');
var sequence = require('when/sequence');

describe('Test ACL', function () {
  describe('Access Roles', function () {
    var acl;

    before(function () {
      acl = new ACL({
        'owner': ['write', 'read', 'update'],
        '*': ['read']
      });
    });

    after(function (next) {
      setTimeout(next, 50);
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

    describe('ACLModel access with roles', function() {
      var TestUser = ACLUser.extend({
      });

      var schema = {
        properties: {
          id: {
            type: 'integer'
          },
          user_id: {
            type: 'integer'
          },
          user: {
            type: 'relation',
            model: TestUser,
            roles: ['owner', 'test_role'],
            references: {
              id: 'user_id'
            }
          }
        }
      };

      var TestModel = ACLModel.extend({
        type: 'acl-test-model',
        schema: schema
      });

      var actor;
      var model;

    });


    describe('ACLModel', function () {
      var user, admin, model, users, actor, aclmodel;

      before(function(next) {
        this.timeout(5000);
        setup.setupDbs(function() {
          users = new ACLUserCollection(null, {actor: SystemUser});
          users.create().done(function(model) {
            user = model;
            users.create().done(function(adm) {
              admin = adm;
              next();
            }, next);
          }, next);
        });
      });

      after(function(next) {
        setup.clearDb();
        setTimeout(next, 50);
      });

      beforeEach(function() {
        actor = new ACLModel({id: 1234});
        aclmodel = new ACLModel({user_id: 1234}, {actor: SystemUser});
        return aclmodel.save();
      });

      it('should set actor and action on fetch', function(next) {
        var options = {};
        aclmodel.save().done(function() {
          aclmodel.fetch(options).done(function() {
            options.action.should.equal('read');
            options.should.have.property('actor');
            aclmodel = new ACLModel({id: aclmodel.id}, {actor: SystemUser});
              options = {};
              aclmodel.fetch(options).done(function() {
              options.action.should.equal('read');
              options.should.have.property('actor');
              next();
            });
          });
        });
      });

      it('should set actor and action on save', function() {
        var opt = {};
        function destroy() {
          return aclmodel
            .destroy(opt)
            .then(function() {
            });
        }
        function testOpts() {
          return aclmodel
            .save(null, opt)
            .then(function() {
              opt.action.should.equal('update');
              opt.should.have.property('actor');
            });
        }
        function saveAsSystem() {
          aclmodel = new ACLModel();
          opt = {actor: SystemUser};
          return aclmodel
            .save(null, opt)
            .then(function() {
              opt.action.should.equal('create');
              opt.should.have.property('actor');
            });
        }
        function updateAsSystem() {
          opt = {actor: SystemUser};
          aclmodel = new ACLModel({id: 123123}, {actor: SystemUser});
          return aclmodel
            .save(null, opt)
            .then(function() {
              opt.action.should.equal('update');
              opt.should.have.property('actor');
            });
        }

        return sequence([
          testOpts,
          destroy,
          saveAsSystem,
          destroy,
          updateAsSystem,
          destroy
        ]);
      });

      it('should set actor and action on destroy', function() {
        var options = {actor: SystemUser};
        return aclmodel.destroy(options).then(function() {
          options.action.should.equal('destroy');
          options.should.have.property('actor');
          options = {actor: SystemUser};
          aclmodel = new ACLModel(null, {actor: SystemUser});
          options = {actor: SystemUser};
          return aclmodel.save(null, options).then(function() {
            options = {actor: SystemUser};
            return aclmodel.destroy(options).then(function() {
              options.action.should.equal('destroy');
              options.should.have.property('actor');
              aclmodel = new ACLModel({id: 123123}, {actor: SystemUser});
              options = {};
              return aclmodel.save(null, options).then(function() {
                options = {actor: SystemUser};
                return aclmodel.destroy(options).then(function() {
                  options.action.should.equal('destroy');
                  options.should.have.property('actor');
                });
              });
            });
          });
        });
      });

      it('should save with an actor that has access', function() {
        model = new ACLModel({
          user_id: user.get(user.idAttribute),
          description: 'foo'
        });
        var acl = model.acl;
        return model
          .save(null, {actor: user})
          .then(function() {
            model.acl.permissions['*'].should.equal(acl.permissions['*']);
          });
      });

      it('should update with an actor that has access', function() {
        var options = {actor: user};
        return model.save({description: 'test desription'}, options).then(function() {
          var m = new ACLModel({id: model.get(model.idAttribute)});
          return m.fetch({actor: user}).then(function() {
            m.get('description').should.equal('test desription');
          });
        });
      });

      it('should have given read access to everyone', function() {
        var anon = new ACLModel({id: 666});
        return model
          .fetch({actor: anon})
          .then(function() {
            should.exist(model.get('description'));
            var json = model.toJSON({actor: anon});
            should.exist(json.description);
          });
      });

      it('should have not given delete access to everyone', function() {
        var anon = new ACLModel({id: 666});
        return model
          .destroy({actor: anon})
          .then(function() {
            return when.reject(new Error('should not have access to destroy'));
          }, function(err) {
            err.statusCode.should.equal(403);
            should.exist(err);
          });
      });

      it('should destroy with an actor that has access', function() {
        return model.destroy({actor: user});
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

  describe('ACLModel Roles', function() {
    var TestUser = ACLUser.extend({
    });

    var schema = {
      properties: {
        id: {
          type: 'integer'
        },
        user_id: {
          type: 'integer'
        },
        user: {
          type: 'relation',
          model: TestUser,
          roles: ['owner', 'test_role'],
          references: {
            id: 'user_id'
          }
        },
        foo: {
          virtual: true
        },
        bar: {
          virtual: true,
          permissions: {
            '*': [],
            owner: [],
            admin: []
          }
        }
      },
      permissions: {
        admin: ['*'],
        owner: ['read'],
        'dynamic_{user_id}': ['update']
      }
    };

    var TestModel = ACLModel.extend({
      type: 'acl-test-model',
      schema: schema,
      virtualProperties: {
        foo: {
          get: function() {
            return 123;
          }
        },
        bar: {
          get: function() {
            return 'bar';
          }
        }
      }
    });

    var actor;
    var model;

    before(function() {
      // need system user as the actor save effectively is an update with the id set.
      actor = new TestUser({id: 1234}, {actor: SystemUser});
      model = new ACLModel({user_id: actor.id}, {actor: actor});
      return when.all([actor.save(), model.save()]);
    });

    after(function() {
      var fns = [
        actor.destroy({actor: SystemUser}),
      ];
      return when.all(fns);
    });

    // roles are added from relation name + .roles array in relation options
    it('should generate roles based on model relation & settings', function() {
      var aclmodel = new TestModel({
        id: 1,
        user_id: actor.id
      });
      // test that dynamic role key was replaced
      should.exist(aclmodel.acl.permissions['dynamic_' + actor.id]);
      var roles = aclmodel.getRoles(actor);
      roles.indexOf('owner').should.be.above( -1 );
      roles.indexOf('user').should.be.above( -1 );
      roles.indexOf('test_role').should.be.above( -1 );
      aclmodel = new TestModel({id: 1, user_id: 22});
      roles = aclmodel.getRoles(actor);
      roles.indexOf('owner').should.equal( -1 );
    });

    it('should check access to virtualProperties', function() {
      var m = new TestModel({id: 2, user_id: actor.id});
      m.get('foo').should.equal(123);
      var json = m.toJSON({includeVirtualProperties: true, actor: actor});
      json.foo.should.equal(123);
      should.not.exist(json.bar);
    });

    it('should not be able to update description if not owner', function() {
      model.set('description', 'foo');
      return model
        .save(null, {actor: new TestUser({id: 222})})
        .then(function() {
          return new Error('should not be able to save');
        }, function(err) {
          err.statusCode.should.equal(403);
        });
    });

    it('should be able to update description if owner', function() {
      model.set('description', 'allowed desc');
      return model.save({actor: actor});
    });

    it('should not be able to delete if not owner', function() {
      return model
        .destroy({actor: new TestUser({id: 33})})
        .then(function() {
          return new Error('should not be able to destroy');
        }, function(err) {
          err.statusCode.should.equal(403);
        });
    });

    it('should be able to delete if owner', function() {
      return model.destroy();
    });
  });

});


