#!/usr/bin/env node
var config = require('../config');
var request = require('request');
var checkPath = config.get('base_url') + '/check';

function doCheck(iteration, next) {
  request.get(checkPath, function(error, res, body) {
    if (body === 'OK') return next();
    if (iteration > 9) {
      console.error('Cannot start server.');
      process.exit(1);
    }
    setTimeout(doCheck.bind(this, iteration + 1, next), 200);
  });
}

doCheck(0, function() {
  process.exit(0);
});
