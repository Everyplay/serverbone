var _ = require('lodash');
var serverbone = require('..');
var when = require('when');
var BaseModel = serverbone.models.BaseModel;
var FlatModel = serverbone.models.FlatModel;
var Db = require('backbone-db');
var database = new Db('test_database');
var IndexingTestDb = serverbone.db.IndexingTestDb;
var indexingDatabase = new IndexingTestDb('index_database');

var testSchema =  {
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
      references: {test_id:"id"},
      collection: serverbone.collections.BaseCollection.extend({
        model: BaseModel.extend({
          type:'foobar',
          db: database,
          sync: Db.sync.bind(database),
          schema: {}
        }),
        sync: Db.sync.bind(database),
        url: 'test_foobar_collection'
      })
    },
    customName: {
      type: 'relation',
      name: 'icanhazcustoms',
      mount: true,
      references: {test_id:"id"},
      collection: serverbone.collections.BaseCollection.extend({
        model: BaseModel.extend({
          type:'barfoo',
          db: database,
          sync: Db.sync.bind(database),
          schema: {}
        }),
        sync: Db.sync.bind(database),
        url: 'test_icanhazcustoms_collection'
      })
    }
  }
};

var TestModel = exports.TestModel = BaseModel.extend({
  type:'video',
  db: database,
  sync: Db.sync.bind(database),
  schema: testSchema
});

var protectedSchema = {
  owner: 'user_id',
  properties: {
    title: {
      required: true,
      type: 'string'
    }
  },
  access: {
    read: ['owner', 'admin'],
    write: ['admin']
  }
};

var ProtectedModel = exports.ProtectedModel = BaseModel.extend({
  type: 'video',
  db: database,
  sync: Db.sync.bind(database),
  schema: protectedSchema
});

var TestCollection = exports.TestCollection = serverbone.collections.BaseCollection.extend({
  model: TestModel,
  sync: Db.sync.bind(database),
  url: 'test_collection'
});

exports.ProtectedCollection = serverbone.collections.BaseCollection.extend({
  model: ProtectedModel,
  sync: Db.sync.bind(database)
});

var fooSchema =  {
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
  url: 'indexed_collection'
});

exports.TestValueIndexCollection = serverbone.collections.IndexCollection.extend(
  _.extend({}, serverbone.collections.ValueIndexMixin, {
    model: FooModel,
    type: FooModel.prototype.type,
    indexDb: indexingDatabase,
    indexKey: 'i:Value:{foo_id}:relation',
    sync: Db.sync.bind(database),
    url: 'indexed_collection'
  }
));

var TestJSONIndexCollection = exports.TestJSONIndexCollection = serverbone.collections.IndexCollection.extend(
  _.extend({}, serverbone.collections.JSONIndexMixin, {
    type: 'jsoncoll',
    indexDb: indexingDatabase,
    indexKey: 'i:Value:{foo_id}:relation',
    sync: Db.sync.bind(database),
    url: 'indexed_collection'
  }
));

var TestMultiIndexCollection = exports.TestMultiIndexCollection = TestJSONIndexCollection.extend(
  _.extend({}, serverbone.collections.MultiIndexMixin, {
    unionKey: 'i:Values:{foo_id}',
    initialize: function(models, options) {
      this.setupIndexes(options);
      TestMultiIndexCollection.__super__.initialize.apply(this, arguments);
    }
  }
));

var FailingModel = exports.FailingModel = TestModel.extend({
  preSave: function(options) {
    var deferred = when.defer();
    deferred.reject(new Error('foo reason'));
    return deferred.promise;
  }
});

var FailingCollection = exports.FailingCollection = TestCollection.extend({
  model: FailingModel
});


exports.FlatTestModel = FlatModel.extend({
  type: 'flatmodel',
  db: indexingDatabase,
  sync: Db.sync.bind(indexingDatabase),
  storedAttribute: 'foo'
});

exports.clearDb = function() {
  _.each(database.records, function(r) {
    database.store().removeItem(r, function(){});
  });
  database.records = [];
};