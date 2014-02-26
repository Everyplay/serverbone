var testSetup = require('./test_setup');
var should = require('chai').should();
var serverbone = require('..');
var FlatModel = testSetup.FlatTestModel;


describe('FlatModel tests', function () {
  var model;

  before(function(next) {
    testSetup.setupDbs(function(err, dbs) {
      if (!testSetup.unitTesting) {
        testSetup.setDb(FlatModel, 'redis');
      }

      next();
    });
  });

  after(function(next) {
    model.destroy().done(function() {
      next();
    }, next);
  });

  it('should create model for storing a string', function() {
    model = new FlatModel('ffoo');
    model.toJSON().should.equal('ffoo');
    return model
      .save()
      .then(function() {
        var model2 = new FlatModel('ffoo');
        return model2
          .fetch()
          .then(function() {
            model.toJSON().should.equal('ffoo');
          });
      });
  });

  it('should read keys starting with given string', function() {
    var model2 = new FlatModel('');
    return model2
      .findKeys('ffoo')
      .then(function(keys) {
        keys.length.should.equal(1);
      });
  });
});