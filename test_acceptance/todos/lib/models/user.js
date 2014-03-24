var Model = require('./model');
var UsersTodosCollection = require('../collections').UsersTodosCollection;
var User = module.exports = Model.extend({
  type: 'user',
  mongo_collection: 'users',
  schema: {
    permissions: {
      '*': ['read', 'create'],
      user: ['update', 'delete'],
      admin: ['*']
    },
    properties: {
      id: {
        type: 'any',
        permissions: {
          user: []
        }
      },
      username: {
        type: 'string',
        required: true
      },
      password: {
        type: 'string',
        permissions: {
          '*': ['create'],
          user: ['update']
        },
        required: true
      },
      todos: {
        type: 'relation',
        collection: UsersTodosCollection,
        references: {
          id: 'id'
        }
      }
    },
    indexes: [
      {property: 'username'}
    ]
  },
  // fake token generation
  getToken: function() {
    console.log(this.attributes);
    return this.id + ':' + this.get('username');
  }
});