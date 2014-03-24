//
// Setup nconf to use (in-order):
//   1. Command-line arguments
//   2. Environment variables
//   3. A file located at 'path/to/config.json'
//
var serverbone = require('..');
var cfg = new serverbone.models.BaseModel();
cfg.set('listen_port', 3000);
cfg.set('redis_database',3);
cfg.set('redis_port', 6379);
cfg.set('redis_host', 'localhost');
cfg.set('mongodb_port', 27017);
cfg.set('mongodb_host', 'localhost');
cfg.set('base_url', 'http://127.0.0.1:' + cfg.get('listen_port'));
console.log('test config loaded');

module.exports = cfg;
