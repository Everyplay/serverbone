//require('mocha-as-promised')();
var setup = require('./setup');
var rqst = require('./utils').request;

describe('Backbone TODO acceptance tests', function() {
  before(setup.before);
  after(setup.after);

  var user1;
  var user1Token;
  var user2;

  it('should be possible to create an user', function() {
      var userData = {
        username: 'foo',
        password: 'bar'
      };
      return rqst()
        .post('/users', userData)
        .then(function(res) {
          user1 = res.body;
          user1.should.have.property('username');
          user1.should.not.have.property('password');
          res.statusCode.should.equal(200);
        });
  });

  it('should be possible to login as user', function() {
      var userData = {
        username: 'foo',
        password: 'bar'
      };
      return rqst()
        .post('/users/login', userData)
        .then(function(res) {
          res.body.should.have.property('access_token');
          res.statusCode.should.equal(200);
          user1Token = res.body.access_token.split(':');
          user1Token.length.should.equal(2);
          user1Token[0].should.equal(user1.id.toString());
        });
  });
});