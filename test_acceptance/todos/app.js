var express = require('express');
var serverbone = require('../..');
var todos = require('./');
var config = require('../../config');

exports.init = function(cb) {
  var app = express();
//var collections = require('../collections');
  var TodoApp = todos.todos;
  var TodosResource = new serverbone.resources.Resource('todos', {
    collection: TodoApp.collections.Todos,
    mountRelations: true
  });

  var UsersResource = new TodoApp.resources.Users('users', {
    collection: TodoApp.collections.Users,
    mountRelations: true
  });

  app.use(express.json());

  app.get('/check', function(req, res, next) {
    res.send('OK');
  });
  app.use('/users', UsersResource.app);
  app.use('/todos', TodosResource.app);
  app.listen(config.get('listen_port'), function() {
    cb();
  });
};

if (!module.parent) {
  todos.init(function() {
    console.log('Todos application running');
  });
}