var should = require('chai').should();
var serverbone = require('..');
var testSetup = require('./test_setup');
var FlatModel = testSetup.FlatTestModel;


describe('FlatModel tests', function () {
  it('should create model for storing a string', function() {
    var model = new FlatModel('ffoo');
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
    var model = new FlatModel('');
    return model
      .findKeys('ffoo')
      .then(function(keys) {
        keys.length.should.equal(1);
      });
  });
});