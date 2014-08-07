var debug = require('debug')('serverbone:acl');
var _ = require('lodash');

/**
 * Serverbone ACL
 *
 * Serverbone ACL provides a simple inline RBAC that can be easily extented to be used with normal user/pass
 * authentication or token based authentication.
 *
 * Roles can be granted several ways,
 *
 * - Directly to a model (like User model instance) via .grant(roles)
 * - Based on schema relations, grant 'owner, user' to user model that has its id in this.get('user_id') as seen below.
 * - via overriding getRoles(model) in ACLModel subclass, like seen also below.
 *
 * var MyModel = BaseModel.extend({
 *   schema: {
 *     permissions: {
 *       "*": ["read","create"],
 *       owner: ["update","delete"],
 *       admin: ["*"]
 *     },
 *     properties: {
 *       hidden_id: {
 *         type: "integer",
 *         permissions: {
 *           "*": [], owner:[]
 *         }
 *       },
 *       hiddent_text: {
 *         type: "string",
 *         permissions: {
 *           "*": [],
 *           "hidden": ["read","update"]
 *         }
 *       },
 *       user_id: {"type":"integer"},
 *       user: {
 *         "type": "relation",
 *         "roles": ["owner"],
 *         "references": {
 *           id: 'user_id'
 *         }
 *       }
 *     }
 *   },
 *   getRoles: function(model) {
 *     // returns function that matches model type against 'user'
 *     var isUser = acl.type('user');
 *     // returns function that matches this.get('hidden_id') against model.get('hidden_id')
 *     var isIdMatch = acl.property('hidden_id', 'hidden_id');
 *     var roles = [];
 *     if(isUser(model) && isIdMatch(this, model)) {
 *       // grant model 'hidden' role against this model to allow access to hidden_text
 *       roles.push('hidden');
 *     }
 *     return roles;
 *   }
 * });
 *
 */

// Default role permission sets that are implicit
var Permissions = {
  owner: ['read', 'update'],
  admin: ['*'],
  '*': ['create', 'read']
};

/**
 * Create new ACL with passed in roles and attached permissions.
 *
 * permissions are in the form of {"role":["action1","action2"]}
 *
 * @param {Object} permissions
 */
exports.ACL = function (permissions) {
  // Permissions map roles to array of actions: {"user":["read"],"admin":["write"]}
  this.permissions = _.extend({}, Permissions, permissions);
 // debug('new ACL: %s', JSON.stringify(this.permissions));
};


_.extend(exports.ACL.prototype, {
  /**
   * allows additional permissions for this acl
   *
   * @param  {Object} permissions
   *
   */
  grant: function (permissions) {
    _.merge(this.permissions, permissions, function (a, b) {
      return _.isArray(a) ? a.concat(b) : undefined;
    });
    return this;
  },
  /**
   * Revoke a role
   *
   * @param  {String|Array} roles a role or roles to revoke
   * @api public
   *
   * @return {ACL}      this for chaining
   */
  revoke: function (roles) {
    if (!Array.isArray(roles)) {
      roles = [roles];
    }
    this.permissions = _.reduce(this.permissions, function (result, actions, key) {
      if (roles.indexOf(key) === -1) {
        result[key] = actions;
      }
      return result;
    }, {});
    return this;
  },
  /**
   * Assert access to this acl's 'action' with role(s)
   *
   * Can I write here with these roles?
   *
   *
   * @param  {String|Array} roles
   * @param  {String} action
   *
   * @example
   *
   * var ownerReading = acl.assert(['*','owner'], 'read')
   * var someoneWriting = acl.assert(['*']‚ 'write')
   *
   * @return {Boolean}
   */
  assert: function (roles, action) {
    var self = this;
    if (!action) {
      action = roles;
      roles = ['*'];
    }
    if (!Array.isArray(roles)) {
      roles = [roles];
    }
    roles.push('*');
    debug('asseting %s to perform %s against %s', roles.join(','), action, JSON.stringify(this.permissions));
    var matches = _.filter(roles, function (role) {
      var actions = self.permissions[role] || self.permissions['*'];
      debug('Asserting %s -> %s agains %s: %s', role, action, JSON.stringify(actions),
      actions.indexOf(action) !== -1 || actions.indexOf('*') !== -1);

      return actions.indexOf(action) !== -1 || actions.indexOf('*') !== -1;
    });
    return matches.length > 0;
  }
});

/**
 * Asserts actorModel.type == type || actorModel.get('type') == type
 *
 * @param  {[type]} type
 * @return {[type]}
 */
exports.type = function (type) {
  return function (actor) {
    if (!actor) return false;
    return actor.has('type') ? actor.get('type') === type : actor.type === type;
  };
};

/**
 * Asserts actorModel.has(key) && actorModel.get(key) === value
 *
 * @param  {String} attr
 * @param  {Object} value
 * @api public
 * @return {Boolean}
 */
exports.attribute = function (attr, value) {
  return function (model, actor) {
    debug('Asserting actor.get(%s) -> %s == %s', attr, actor.get(attr), value);
    return actor.has(attr) && actor.get(attr) === value;
  };
};

/**
 * Asserts model.has(key) && actorModel.has(key) && actorModel.get(key) === model.get(key)
 *
 * @param  {String} key
 * @param  {Object} actorKey
 * @api public
 * @return {Boolean}
 */
exports.property = function (key, actorKey) {
  return function (model, actor) {
    debug('Asserting model.get(%s) against actor.get(%s) -> %s == %s', key, actorKey,
      model.get(key), actor.get(actorKey));
    return actor.has(actorKey) && model.has(key) && model.get(key) === actor.get(actorKey);
  };
};


exports.AdminOnly = {
  admin: ['*'],
  user: [],
  owner: []
};

exports.adminAndOwner = {
  admin: ['*'],
  owner: ['update','read']
};
