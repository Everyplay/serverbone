var MongoClient =  require('mongodb').MongoClient;
var config = require('./');
var db;

var _openConnection = function(cb) {
  var connectionString = 'mongodb://'
    + config.get('mongodb_host')
    + ':' + config.get('mongodb_port')
    + '/tests-serverbone';

  MongoClient.connect(connectionString, function(err, database) {
    if (err) {
      return cb(err);
    }
    db = database;
    cb(null, db);
  });
};

exports.connect = function(cb) {
  if (db) return cb(null, db);
  _openConnection(cb);
};

