/**
 * Mocks indexing Db adapter
 */
var _ = require('lodash');
var Db = require('backbone-db-local');
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
      if (err) return cb(err);
      if (!items) {
        items = [];
      } else {
        items = JSON.parse(items);
      }
      if (_.findIndex(items, {id: model.id}) >= 0) {
        // item was already existing
        return cb();
      }
      if (collection.indexSort) {
        // NB: the default order is reverse in BackboneDb backends
        var newItem = {id: model.id, score: -collection.indexSort(model)};
        var pos = _.sortedIndex(items, newItem, 'score');
        items.splice(pos, 0, newItem);
      } else {
        items.push({id: model.id});
      }
      self.store().setItem(
        options.indexKey,
        JSON.stringify(items),
        function(err, res) {
          cb(err, model.toJSON(), res);
        });
    });
  },

  readFromIndex: function(collection, options, cb) {
    this.store().getItem(options.indexKey, function(err, items) {
      if (err) return cb(err);
      if (!items) {
        return cb(null, []);
      }
      items = _.isString(items) ? JSON.parse(items) : items;
      if (options.sortOrder === 1) items.reverse();
      if (options.limit) {
        items = items.splice(options.offset || 0, options.limit);
      }
      var models = [];
      _.each(items, function(item) {
        models.push({
          id: item.id
        });
      });
      collection.set(models, options);
      return cb(null, models);
    });
  },

  readFromIndexes: function(collection, options, cb) {
    var indexesToRead = options.indexKeys;
    var fns = _.map(indexesToRead, function(key) {
      var store = this.store();
      return function getItem(cb) {
        store.getItem(key, function(err, items) {
          if (_.isString(items)) items = JSON.parse(items);
          cb(err, _.pluck(items, 'id'));
        });
      };
    }, this);

    async.parallel(fns, function(err, results) {
      if (err) return cb(err);
      // join results
      var models = [];
      var allIds = [];
      _.each(results, function(ids) {
        allIds = allIds.concat(ids);
      });
      _.each(_.uniq(_.compact(allIds)), function(id) {
        models.push({
          id: id
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
      items = _.reject(items, function(item) {
        return ids.indexOf(item.id) > -1;
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
    var store = this.store();

    function removeAfterBackup(err) {
      if (err) return cb(err);
      store.setItem(
        options.indexKey,
        JSON.stringify([]),
        function(err, res) {
          cb(err, [], res);
        }
      );
    }

    if (options.indexBackupKey) {
      store.getItem(options.indexKey, function(err, res) {
        if (err) return cb(err);
        store.setItem(options.indexBackupKey, res, removeAfterBackup);
      });
    } else {
      removeAfterBackup();
    }
  },

  existsInIndex: function(collection, model, options, cb) {
    this.store().getItem(options.indexKey, function(err, items) {
      items = items ? JSON.parse(items) : [];
      cb(err, _.findIndex(items, {id: model.id}) > -1);
    });
  },

  indexCount: function(collection, options, cb) {
    this.store().getItem(options.indexKey, function(err, items) {
      items = items ? JSON.parse(items) : [];
      cb(err, items.length);
    });
  },

  // mock adapter only supports exact match
  findKeys: function(collection, options, cb) {
    var ids = [];
    var keys = _.isFunction(collection.url) ? collection.url() : collection.url;
    keys += options.keys;
    debug.log('findKeys', keys);
    this.store().getItem(keys, function(err, data) {
      if (data) ids.push(keys);
      cb(null, ids);
    });
  }
});

IndexingTestDb.sync = IndexingTestDb.prototype.sync;

module.exports = IndexingTestDb;