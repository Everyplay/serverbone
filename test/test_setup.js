//require('pretty-monitor').start();
var _ = require('lodash');
var when = require('backbone-promises').when;
var MongoDb = require('backbone-db-mongodb');
var blueprint = require('backbone-blueprint');
var env = process.env.ENV || 'test';
var unitTesting = exports.unitTesting = (env === 'test');

var serverbone = require('..');
var BaseModel = serverbone.models.BaseModel;
var BaseCollection = serverbone.collections.BaseCollection;
var ACLModel = serverbone.models.ACLModel;
var ACLCollection = serverbone.collections.ACLCollection;
var FlatModel = serverbone.models.FlatModel;
var mongo = require('../config/mongo');
var redisTestDb = require('../config/redis');
var Db = require('backbone-db-local');
var database = new Db('test_database');
var IndexingTestDb = serverbone.db.IndexingTestDb;
var indexingDatabase = new IndexingTestDb('index_database');

var BaseModel = serverbone.models.BaseModel;
var BaseCollection = serverbone.collections.BaseCollection;
var ACLModel = serverbone.models.ACLModel;
var FlatModel = serverbone.models.FlatModel;
var acl = serverbone.acl;

var EmptyModel = exports.EmptyModel = BaseModel.extend({
  type: 'barfoo',
  db: database,
  sync: Db.sync.bind(database),
  schema: {id: 'barfoo'}
});

var testSchema = {
  owner: 'user_id',
  properties: {
    id: {
      type: 'integer'
    },
    title: {
      required: true,
      type: 'string'
    },
    test: {
      type: 'string'
    },
    tests: {
      type: 'relation',
      mount: true,
      references: {
        test_id: 'id'
      },
      collection: serverbone.collections.BaseCollection.extend({
        model: BaseModel.extend({
          type: 'foobar',
          db: database,
          sync: Db.sync.bind(database),
          schema: {id: 'foobar'}
        }),
        sync: Db.sync.bind(database),
        db: database,
        url: 'test_foobar_collection'
      })
    },
    customName: {
      type: 'relation',
      name: 'icanhazcustoms',
      mount: true,
      references: {
        test_id: 'id'
      },
      collection: serverbone.collections.BaseCollection.extend({
        model: EmptyModel,
        sync: Db.sync.bind(database),
        db: database,
        url: 'test_icanhazcustoms_collection'
      })
    },
    listRelation: {
      type: 'relation',
      name: 'listrel',
      mount: true,
      resourceType: 'list',
      references: {
        foo_id: 'id'
      },
      collection: serverbone.collections.IndexCollection.extend({
        model: EmptyModel,
        sync: Db.sync.bind(database),
        db: database,
        indexDb: indexingDatabase,
        url: 'test_list_relation',
        indexKey: '{foo_id}_list'
      })
    },
    modelRelation: {
      type: 'relation',
      mount: true,
      name: 'modelrel',
      model: EmptyModel,
      references: {
        id: 'id'
      }
    }
  }
};

var projectionSchema = blueprint.Schema.extendSchema(testSchema, {
  defaultProjectionOptions: {
    projection: {
      onlyFields: ['title', 'tests']
    },
    recursive: true
  }
});


var TestModel = exports.TestModel = BaseModel.extend({
  type: 'video',
  db: database,
  sync: Db.sync.bind(database),
  schema: testSchema
});

exports.TestModel2 = TestModel.extend({
  type: 'test2',
  schema: projectionSchema
});

exports.TestCollection2 = serverbone.collections.BaseCollection.extend({
  model: exports.TestModel2,
  sync: Db.sync.bind(database),
  db: database,
  url: 'test_collection2'
});


var protectedSchema = {
  owner: 'user_id',
  properties: {
    title: {
      required: true,
      type: 'string'
    }
  },
  permissions: {
    admin: ['*'],
    owner: ['read']
  }
};

var ProtectedModel = exports.ProtectedModel = BaseModel.extend({
  type: 'protected',
  db: database,
  sync: Db.sync.bind(database),
  schema: protectedSchema
});

var TestCollection = exports.TestCollection = serverbone.collections.BaseCollection.extend({
  model: TestModel,
  sync: Db.sync.bind(database),
  db: database,
  url: 'test_collection'
});

exports.ProtectedCollection = serverbone.collections.BaseCollection.extend({
  model: ProtectedModel,
  sync: Db.sync.bind(database),
  db: database
});

var fooSchema = {
  properties: {
    id: {
      type: 'integer'
    },
    data: {
      type: 'string'
    }
  }

};
var FooModel = exports.FooModel = BaseModel.extend({
  type: 'indexed_foo',
  schema: fooSchema,
  db: database,
  sync: Db.sync.bind(database)
});

exports.TestIndexCollection = serverbone.collections.IndexCollection.extend({
  model: FooModel,
  type: FooModel.prototype.type,
  indexDb: indexingDatabase,
  indexKey: 'i:Foo:{foo_id}:relation',
  sync: Db.sync.bind(database),
  db: database,
  url: 'indexed_collection'
});

exports.TestValueIndexCollection = serverbone.collections.IndexCollection.extend(
  _.extend({}, serverbone.collections.ValueIndexMixin, {
    model: FooModel,
    type: FooModel.prototype.type,
    db: database,
    sync: Db.sync.bind(database),
    indexDb: indexingDatabase,
    indexKey: 'i:Value:{foo_id}:relation',
    url: 'indexed_collection'
  }));

var TestJSONIndexCollection = exports.TestJSONIndexCollection = serverbone.collections.IndexCollection.extend(
  _.extend({}, serverbone.collections.JSONIndexMixin, {
    type: 'jsoncoll',
    indexDb: indexingDatabase,
    indexKey: 'i:Value:{foo_id}:relation',
    db: database,
    sync: Db.sync.bind(database),
    url: 'indexed_collection',
    getProjectionOptionsFromModel: function() {
      return;
    }
  }));

var TestMultiIndexCollection = exports.TestMultiIndexCollection = TestJSONIndexCollection.extend(
  _.extend({}, serverbone.collections.MultiIndexMixin, {
    unionKey: 'i:Values:{foo_id}',
    initialize: function(models, options) {
      this.setupIndexes(options);
      TestMultiIndexCollection.__super__.initialize.apply(this, arguments);
    }
  }));

var FailingModel = exports.FailingModel = TestModel.extend({
  preSave: function() {
    var promise = when.reject(new Error('foo reason'));
    return promise;
  }
});

exports.FailingCollection = TestCollection.extend({
  model: FailingModel
});

exports.ACLUser = ACLModel.extend({
  type: 'user',
  db: database,
  sync: database.sync,
  schema: {
    permissions: {
      '*': ['create'],
      owner: ['read', 'update', 'destroy', 'create'],
      admin: ['*']
    },
    properties: {
      id: {
        type: 'integer',
        permissions: {
          owner: ['read'],
          admin: ['*']
        }
      },
      name: {
        type: 'string',
        permissions: {
          owner: ['update','read'],
          admin: ['*']
        }
      },
      models: {
        type: 'relation',
        collection: exports.ACLModelCollection,
        references: {'id': 'id'}
      }
    }
  },
  getRoles: function(model) {
    var roles = exports.ACLUser.__super__.getRoles.apply(this, arguments);
    var sameType = acl.type(this.type);
    var sameId = acl.property('id','id');
    if (sameType(model) && sameId(this, model)) roles.push('owner');
    return roles;
  }
});

exports.ACLUserCollection = ACLCollection.extend({
  model: exports.ACLUser,
  db: database,
  sync: database.sync
});

exports.ACLModel = ACLModel.extend({
  type: 'acl_model',
  db: database,
  sync: database.sync,
  schema: {
    permissions: {
      user: ['read', 'update', 'destroy', 'create'],
      owner: ['read', 'update', 'destroy', 'create'],
      '*': ['read','create'],
      admin: ['*']
    },
    properties: {
      id: {
        type: 'integer'
      },
      internal_id: {
        type: 'string',
        permissions: {
          admin: ['*'],
          '*': [],
          user: [],
          owner: []
        }
      },
      user_id: {
        type: 'integer',
      },
      user: {
        type: 'relation',
        roles: ['owner','user'],
        references: {
          id: 'user_id'
        },
        model: exports.ACLUser
      },
      description: {
        type: 'test',
        default: 'desc',
        permissions: {
          user: ['read','update','create']
        }
      }
    }
  }
});

exports.ACLCollection = ACLCollection.extend({
  model: exports.ACLModel,
  db: database,
  sync: database.sync
});

exports.ACLModelCollection = ACLCollection.extend({
  model: exports.ACLModel,
  db: database,
  sync: database.sync
});

exports.TestValueIndexCollection = serverbone.collections.IndexCollection.extend(
  _.extend({}, serverbone.collections.ValueIndexMixin, {
    model: FooModel,
    type: FooModel.prototype.type,
    indexDb: indexingDatabase,
    indexKey: 'i:Value:{foo_id}:relation',
    db: database,
    sync: Db.sync.bind(database),
    url: 'indexed_collection'
  }));


exports.ACLIndexCollection = serverbone.collections.ACLIndexCollection.extend({
  model: exports.ACLModel,
  indexDb: indexingDatabase,
  indexKey: 'i:Value:{foo_id}:relation',
  db: database,
  sync: Db.sync.bind(database),
  url: 'acl_indexed_collection',
  permissions: {
    admin: ['*'],
    owner: ['create', 'update'],
    '*': ['read']
  }
});

exports.AdminACLCollection = exports.ACLCollection.extend({
  permissions: {
    admin: ['*'],
    '*': []
  }
});

exports.SystemUser = new exports.ACLUser();
exports.SystemUser.addRoles(['system', 'admin']);

exports.FlatTestModel = FlatModel.extend({
  type: 'flatmodel',
  db: indexingDatabase,
  sync: Db.sync.bind(indexingDatabase),
  storedAttribute: 'foo'
});

var dbs = {};
exports.setupDbs = function(cb) {
  mongo.connect(function(err, _db) {
    if (err) {
      return cb(err);
    }
    var db = _db;
    var mongoTestDb = new MongoDb(db);
    dbs = {
      mongo: mongoTestDb,
      redis: redisTestDb
    };
    cb(null, dbs);
  });
};

/**
 * Override Model's Db settings
 * @param {[type]} ModelClass
 * @param {[type]} dbId       'redis', 'mongo'
 */
exports.setDb = function(ModelClass, dbId, indexDbId) {
  var db = dbs[dbId];
  var indexDb = dbs[indexDbId || dbId];

  ModelClass.setDbDriver({
    db: db,
    sync: db.sync,
    indexDb: indexDb
  });
};

exports.clearDb = function() {
  _.each(database.records, function(r) {
    database.store().removeItem(r, function() {});
  });
  database.records = [];
  if (!unitTesting) {
    redisTestDb.redis.flushdb();
  }
};