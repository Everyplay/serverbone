var redis = require('redis');
var config = require('./');
var client = redis.createClient(
  config.get('redis_port'),
  config.get('redis_host')
);
client.select(config.get('redis_database'));
client.client('setname', __filename);

var RedisDb = require('backbone-db-redis');
var store = new RedisDb('serverbone-tests', client);
console.log('Using redis store:', config.get('redis_database'));
module.exports = store;