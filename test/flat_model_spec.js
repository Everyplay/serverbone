var should = require('chai').should();
var epm = require('..');
var testSetup = require('./test_setup');
var FlatModel = testSetup.FlatTestModel;


describe('FlatModel tests', function () {
  it('should create model for storing a string', function(done) {
    var model = new FlatModel('ffoo');
    model.toJSON().should.equal('ffoo');
    model
      .save()
      .then(function() {
        var model2 = new FlatModel('ffoo');
        model2
          .fetch()
          .then(function() {
            model.toJSON().should.equal('ffoo');
            done();
          }).otherwise(done);
      }).otherwise(done);
  });

  it('should read keys starting with given string', function(done) {
    var model = new FlatModel('');
    model
      .findKeys('ffoo')
      .then(function(keys) {
        keys.length.should.equal(1);
        done();
      }).otherwise(done);
  });
});