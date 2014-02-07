var should = require('chai').should();
var serverbone = require('..');
var testSetup = require('./test_setup');
var FlatModel = testSetup.FlatTestModel;


describe('FlatModel tests', function () {
  it('should create model for storing a string', function(next) {
    var model = new FlatModel('ffoo');
    model.toJSON().should.equal('ffoo');
    model
      .save()
      .then(function() {
        var model2 = new FlatModel('ffoo');
        return model2
          .fetch()
          .then(function() {
            model.toJSON().should.equal('ffoo');
          });
      }).done(function() {
        next();
      }, next);
  });

  it('should read keys starting with given string', function(next) {
    var model = new FlatModel('');
    model
      .findKeys('ffoo')
      .done(function(keys) {
        keys.length.should.equal(1);
        next();
      }, next);
  });
});