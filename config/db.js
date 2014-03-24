var config = require('./');
var _ = require('lodash');
var redis;
exports.redis = function(cb) {
  if (redis) return cb(redis);
  var redisLib = require('redis');

  var client = redisLib.createClient(
    config.get('redis_port'),
    config.get('redis_host')
  );
  client.select(config.get('redis_database'));
  client.client('setname', __filename);

  var RedisDb = require('backbone-db-redis');
  redis = new RedisDb('serverbone-acceptance', client);
  cb(redis);
};

var mongodb, connectingMongo, cbs = [];
exports.mongodb = function(cb) {
  if (!connectingMongo && mongodb) {
    return cb(mongodb);
  } else if (connectingMongo && !mongodb) {
    return;
  }
  var MongoDB = require('backbone-db-mongodb');
  cbs.push(cb);
  connectingMongo = true;
  var connectionString = 'mongodb://'
    + config.get('mongodb_host')
    + ':' + config.get('mongodb_port')
    + '/tests-acceptance-serverbone';
  var MongoClient =  require('mongodb').MongoClient;
  MongoClient.connect(connectionString, function(err, database) {
    if (err) {
      console.error('Failed to connect to:', connectionString, err);
      return cb(err);
    }
    console.log('Using mongodb:', connectionString);
    mongodb = new MongoDB(database);
    connectingMongo = false;
    _.each(cbs, function(fn) {
      fn(mongodb);
    });
  });
};

exports.temp = function(cb) {
  var TempDB = require('backbone-db');
  cb(new TempDB('todos'));
};