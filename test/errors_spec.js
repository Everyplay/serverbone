var testSetup = require('./test_setup');
var should = require('chai').should();
var serverbone = require('..');

describe('Error tests', function () {
  it('should create ValidationError with message string', function() {
    var err = new serverbone.errors.ValidationError('foo');
    err.description.should.equal('foo');
  });

  it('should create ValidationError with error array', function() {
    var validationError = new Error('foo');
    validationError.stack = 'foo';
    var err = new serverbone.errors.ValidationError({errors: [validationError]});
    err.description.should.equal('foo');
  });
});