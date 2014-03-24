var Todo = require('../models/todo');
var Collection = require('./collection');

exports.Todos = Collection.extend({
    // Reference to this collection's model.
  type: 'todos',
  model: Todo
});

exports.UserTodos = exports.Todos.extend({
  defaultOptions: {
    where: {
      user_id: '{user_id}'
    }
  }
});
