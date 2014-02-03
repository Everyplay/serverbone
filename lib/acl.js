var _ = require('lodash');

var AccessControl = function AccessControl(permissions) {
  this.permissions = permissions;
};

_.extend(AccessControl.prototype, {
  hasPermission: function(roles, action) {
    var permittedRoles = this.permissions[action];
    return _.intersection(permittedRoles, roles).length > 0;
  },
});

exports.AccessControl = AccessControl;

exports.AdminOnly = {
  read: ['admin'],
  write: ['admin']
};