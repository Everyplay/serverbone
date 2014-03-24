var Model = require('./model');
var User = require('./user');

var Todo = module.exports = Model.extend({
  // Default attributes for the todo
  // and ensure that each todo created has `title` and `completed` keys.
  defaults: {
    completed: false
  },
  schema: {
    permissions: {
      '*': ['read', 'create'],
      user: ['update', 'delete']
    },
    properties: {
      id: {
        type: 'number',
        permissions: {
          user: []
        }
      },
      title: {
        type: 'string',
        default: ''
      },
      completed: {
        type: 'boolean',
        default: false
      },
      user_id: {
        type: 'number',
        required: true
      },
      user: {
        type: 'relation',
        model: User,
        references: {
          id: 'user_id'
        }
      }
    }
  },
    // index following properties:
  indexes: [{
    property: 'user_id'
  }]
});