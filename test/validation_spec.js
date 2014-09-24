var testSetup = require('./test_setup');
var should = require('chai').should();
var serverbone = require('..');
var BaseModel = serverbone.models.BaseModel;

var testSchema = {
  owner: 'user_id',
  properties: {
    status: {
      required: true,
      type: 'integer'
    },
    data: {
      contains: 'a'
    }
  }
};

var TestModel = BaseModel.extend({
  schema: testSchema
});


describe('Test validation against schema', function() {

  it('should give validation error if required attribute is missing', function() {
    var foo = new TestModel();
    var error = foo.validate();
    should.exist(error);
    var json = error.toJSON();
    json.error.should.equal('status is required');
    json.error_description.should.equal('status is required');
  });

  it('should give validation error if data has wrong type', function() {
    var foo = new TestModel({
      status: 'foo'
    });
    var error = foo.validate();
    should.exist(error);
    error.description.should.equal('status is not of a type(s) integer');
  });

  it('should pass validation with correct data', function() {
    var foo = new TestModel({
      status: 1
    });
    var errors = foo.validate();
    should.not.exist(errors);
  });

  it('should add custom validator', function() {
    TestModel.prototype.validator.attributes.contains = function validateContains(instance, schema, options, ctx) {
      if (typeof instance !== 'string') return;
      if (typeof schema.contains !== 'string') throw new Error('"contains" expects a string');
      if (instance.indexOf(schema.contains) < 0) {
        return 'does not contain the string ' + JSON.stringify(schema.contains);
      }
    };
    var foo = new TestModel({
      status: 1,
      data: 'o'
    });
    var error = foo.validate();
    should.exist(error);
  });

});