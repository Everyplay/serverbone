var should = require('chai').should();
var epm = require('..');

describe('Error tests', function () {
  it('should create ValidationError with message string', function() {
    var err = new epm.errors.ValidationError('foo');
    err.message.should.equal('foo');
  });

  it('should create ValidationError with error array', function() {
    var validationError = new Error('foo');
    validationError.stack = 'foo';
    var err = new epm.errors.ValidationError({errors: [validationError]});
    err.message.should.equal('foo');
  });
});