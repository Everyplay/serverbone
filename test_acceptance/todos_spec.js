require('mocha-as-promised')();
var setup = require('./setup');
var rqst = require('./utils').request;

describe('Backbone TODO acceptance tests', function() {
  before(setup.before);
  after(setup.after);

  var user1;
  var user2;

  it('should be possible to create an user', function() {
      var userData = {
        username: 'foo',
        password: 'bar'
      };
      return rqst()
        .post('/users', userData)
        .then(function(res) {
          res.statusCode.should.equal(200);
        }).otherwise(function(err) {
          console.error(err);
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
          console.log("GOT",res);
          res.statusCode.should.equal(200);
        }).otherwise(function(err) {
          console.error(err);
        });
  });
});