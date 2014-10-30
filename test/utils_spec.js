var testSetup = require('./test_setup');
var _ = require('lodash');
var sinon = require('sinon');
var should = require('chai').should();
var serverbone = require('..');

describe('Utils tests', function() {
  var model;
  var sandbox;

  before(function() {
    sandbox = sinon.sandbox.create();
  });

  after(function() {
    sandbox.restore();
  });

  it('should sendError', function() {
    var req = {};
    var res = {
      json: function() {},
      status: function() {
        return res;
      }
    };
    var err = new Error('Foo error');
    serverbone.utils.response.sendError(req, res, err);
  });
});
