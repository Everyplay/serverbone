var User = require('../models/user');

exports.accessToken = function(opt) {
  return function(req, res, next) {
    if(req.actor) next();
    var token = req.query.access_token;
    if(!token) {
      token = req.headers.authorization;
    }
    if(!token) {
     /* var error = new Error('not authorized');
      error.statusCode = 401;
      return next(error);*/
      return next();
    }
    console.log('got token', token);
    var userInfo = token.split(':');
    req.actor = new User({id: userInfo[0]});
    req.actor.actor = req.actor;
    req.actor.fetch().done(function() {
      next();
    }, next);
  };
};