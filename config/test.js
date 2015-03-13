//
// Setup nconf to use (in-order):
//   1. Command-line arguments
//   2. Environment variables
//   3. A file located at 'path/to/config.json'
//

var cfg = require('nconf');
cfg.argv().env().use('memory');
cfg.set('listen_port', 3000);
cfg.set('redis_database', 3);
cfg.set('redis_port', 6379);
cfg.set('redis_host', 'localhost');
cfg.set('mongodb_port', 27017);
cfg.set('mongodb_host', 'localhost');

module.exports = cfg;
