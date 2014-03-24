var serverbone = require('../../..');
var _ = require('lodash');
var middleware = require('./middleware');

var Users = exports.Users = function() {
  serverbone.resources.Resource.apply(this, arguments);
  console.log('adding route');
  this.addRoute('POST', '/login', _.bind(this.login, this));
};

 _.extend(Users.prototype, serverbone.resources.Resource.prototype, {
  login: function(req, res, next) {
    if(!req.body || !req.body.username || !req.body.password) {
      return next(new Error('missing parameters'));
    }
    console.log('LOGN',req.body);
    var user = new this.ModelClass({username: req.body.username}, {actor: req.actor});
    user.fetch().done(function() {
      console.log(user);
      res.send({access_token: user.getToken()});
    }, next);
  },
  initMiddlewares: function() {
    //monster, but call parent :D
    serverbone.resources.Resource.prototype.initMiddlewares.apply(this, arguments);
    this.app.use(middleware.accessToken());
  }
 });


console.log(Users.prototype);
