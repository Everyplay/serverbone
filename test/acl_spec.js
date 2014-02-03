var should = require('chai').should();
var _ = require('lodash');
var epm = require('..');

var Db = require('backbone-db');
var db = new Db('acl-test');

var BaseModel = epm.models.BaseModel.extend({
  sync: Db.sync.bind(db)
});

var UserModel = BaseModel.extend({
});

var TestModel = BaseModel.extend({
  schema: {
    owner: 'user_id',
    access: {
      read: ['owner'],
      write: ['admin']
    },
    properties: {
      name: {
        type: 'string',
        access: {
          read: ['owner', 'admin'],
          write: ['admin']
        }
      },
      internal_id: {
        type: 'string',
        access: {
          read: ['admin'],
          write: ['admin']
        }
      }
    }
  }
});

describe('Test ACL', function () {
  var anon = new UserModel({id: 'foo', admin: false});
  var owner = new UserModel({id: 'user_id', admin: false});
  var admin = new UserModel({id: 'admin_id', admin: true});
  var foo = new TestModel({id: 1, name: 'foo', internal_id: 'xyz'});

  it('should test hasPermission', function() {
    var acl = new epm.acl.AccessControl({
      read: ['owner', 'admin'],
      write: ['admin']
    });
    acl.hasPermission(['owner'], 'read').should.equal(true);
    acl.hasPermission(['owner'], 'write').should.equal(false);
    acl.hasPermission(['admin'], 'read').should.equal(true);
    acl.hasPermission(['admin'], 'write').should.equal(true);
    acl.hasPermission(['world'], 'read').should.equal(false);
  });

  it('should allow only owner to read resource', function() {
    foo.canAccess('read', anon).should.equal(false);
    foo.canAccess('read', owner).should.equal(true);
    foo.canAccess('write', owner).should.equal(false);
    foo.canAccess('write', admin).should.equal(true);
  });

  it('should check property permissions lists', function() {
    var userCanRead = foo.propertiesWithAccess('read', owner);
    userCanRead.length.should.equal(1);
    userCanRead[0].should.equal('name');
    var userCanWrite = foo.propertiesWithAccess('write', owner);
    userCanWrite.length.should.equal(0);

    var adminCanWrite = foo.propertiesWithAccess('write', admin);
    adminCanWrite.length.should.equal(2);
    adminCanWrite.should.include('name');
    adminCanWrite.should.include('internal_id');

    var worldCanRead = foo.propertiesWithAccess('read', anon);
    worldCanRead.length.should.equal(0);
  });

  it('toJSON should respect property permissions', function() {
    var ownerJson = foo.toJSON({user: owner});
    _.isEqual(ownerJson, {name: 'foo'}).should.equal(true);

    var adminJson = foo.toJSON({user: admin});
    _.isEqual(adminJson, {name: 'foo', internal_id: 'xyz'}).should.equal(true);

    var worldJson = foo.toJSON({user: anon});
    _.isEqual(worldJson, {}).should.equal(true);
  });

  it('it should not allow changing fields without permission', function(done) {
    foo.set({internal_id: 'abc', 'name': 'new name'});
    foo.save(foo.attributes, {user: owner})
      .then(function() {
        done(new Error('should not save'));
      })
      .otherwise(function(err) {
        should.exist(err);
        //TODO: check error
        done();
      });
  });

  it('admin should be allowed to write internal_id', function(done) {
    foo.set({internal_id: 'abc', 'name': 'new name'});
    foo.save(foo.attributes, {user: admin})
      .then(function() {
        done();
      })
      .otherwise(done);
  });

});


