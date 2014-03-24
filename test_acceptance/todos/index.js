var _ = require('lodash');
var todos = exports.todos = require('./lib');
var User = todos.models.User;
var Todo = todos.models.Todo;
var Users = todos.collections.Users;
var Todos = todos.collections.Users;

exports.app = require('./app');


exports.init = function(cb) {
  var db = require('../../config/db');
  var done = _.after(3, cb);

  db.redis(function(client) {
    Todo.prototype.db = client;
    Todo.prototype.sync = client.sync;
    Todos.prototype.db = client;
    Todos.prototype.sync = client.sync;
    done();
  });
  
  db.mongodb(function(db) {
    User.prototype.db = db;
    User.prototype.sync = db.sync;
    Users.prototype.db = db;
    Users.prototype.sync = db.sync;
    done();
  });
  exports.app.init(done);
};
