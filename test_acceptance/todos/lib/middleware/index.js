var User = require('../models/user');

exports.accessToken = function(opt) {
  return function(req, res, next) {
    if (req.actor) next();
    req.actor = new User();
    var token = req.query.access_token;
    if (!token) {
      token = req.headers.authorization;
    }
    if (!token) {
     /* var error = new Error('not authorized');
      error.statusCode = 401;
      return next(error);*/
      return next();
    }
    var userInfo = token.split(':');
    req.actor.set({id: userInfo[0]});
    req.actor.actor = req.actor;
    req.actor.fetch().done(function() {
      next();
    }, next);
  };
};