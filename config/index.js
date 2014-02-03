var env = process.env.NODE_ENV || 'test';
var conf = require('./' + env);
module.exports = conf;