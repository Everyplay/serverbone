/**
 * Mocks indexing Db adapter
 */
var _ = require('lodash');
var Db = require('backbone-db');
var debug = require('../utils/debug')('serverbone:utils:db:mock');
var async = require('async');

var IndexingTestDb = function TestDb() {
  var db = Db.apply(this, arguments);
  this.storage = db.storage;
  this.records = db.records;
};

_.extend(IndexingTestDb.prototype, Db.prototype, {
  addToIndex: function(collection, model, options, cb) {
    var self = this;
    debug.log('add ' + model.id + ' to ' + options.indexKey);
    this.store().getItem(options.indexKey, function(err, items) {
      if(!items) items = [];
      else items = JSON.parse(items);
      items.push(model.id);
      self.store().setItem(
        options.indexKey,
        JSON.stringify(items),
        function(err, res) {
          cb(err, model.toJSON(), res);
        });
    });
  },

  readFromIndex: function(collection, options, cb) {
    this.store().getItem(options.indexKey, function(err, ids) {
      ids = _.isString(ids) ? JSON.parse(ids) : ids;
      var models = [];
      _.each(ids, function(id) {
        models.push({id: id});
      });
      collection.set(models, options);
      return cb(err, models);
    });
  },

  readFromIndexes: function(collection, options, cb) {
    var fns = _.map(options.indexKeys, function(key) {
      var store = this.store();
      return function getItem(cb) {
        store.getItem(key, function(err, ids) {
          cb(err, ids);
        });
      };
    }, this);

    async.parallel(fns, function(err, results) {
      if(err) return cb(err);
      // join results
      var models = [];
      _.each(results, function(ids) {
        ids = _.isString(ids) ? JSON.parse(ids) : ids;
        _.each(ids, function(id) {
          models.push({id: id});
        });
      });
      collection.set(models, options);
      return cb(err, models);
    });
  },

  removeFromIndex: function(collection, models, options, cb) {
    var self = this;
    var ids = _.pluck(models, models[0].idAttribute);
    debug.log('removing ' + ids + ' from ' + options.indexKey);
    this.store().getItem(options.indexKey, function(err, items) {
      items = _.isString(items) ? JSON.parse(items) : items;
      items = _.reject(items, function(id) {
        return ids.indexOf(id) > -1;
      });
      self.store().setItem(
        options.indexKey,
        JSON.stringify(items),
        function(err, res) {
          cb(err, models, res);
        }
      );
    });
  },

  // removes everything from index
  removeIndex: function(collection, options, cb) {
    this.store().setItem(
      options.indexKey,
      JSON.stringify([]),
      function(err, res) {
        cb(err, [], res);
      }
    );
  },

  existsInIndex: function(collection, model, options, cb) {
    this.store().getItem(options.indexKey, function(err, ids) {
      ids = ids ? JSON.parse(ids) : [];
      cb(err, ids.indexOf(model.id) > -1);
    });
  },

  indexCount: function(collection, options, cb) {
    this.store().getItem(options.indexKey, function(err, ids) {
      ids = ids ? JSON.parse(ids) : [];
      cb(err, ids.length);
    });
  },

  // mock adapter only supports exact match
  findKeys: function(collection, options, cb) {
    var ids = [];
    this.store().getItem(options.keys, function(err, data) {
      if(data) ids.push(options.keys);
      cb(null, ids);
    });
  }
});

IndexingTestDb.sync = IndexingTestDb.prototype.sync;

module.exports = IndexingTestDb;