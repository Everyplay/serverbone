// # Serverbone

// # Introduction

// [Serverbone.js](http://serverbonejs.org/) is a server-side Rest API framework that supports multiple data stores on Node.js. Especially, you can combine multiple data stores such as a document store (e.g. MongoDB using [backbone-db-mongodb](https://github.com/Everyplay/backbone-db-mongodb)), and a key-value store for indexes (e.g. Redis using [backbone-db-redis](https://github.com/Everyplay/backbone-db-redis)). The project is based on the following modules:

// - [Backbone DB](https://github.com/Everyplay/backbone-db): provides interface for interacting with databases
// - [Backbone Promises](https://github.com/Everyplay/backbone-promises): serverbone APIs use Promises/A+ conventions.
// - [Backbone Blueprint](https://github.com/Everyplay/backbone-blueprint): JSON schema parsing & validation, etc.

// The goals of the framework are:
//
// - Define models using JSON configuration (based on JSON Schema, implemented by [backbone-blueprint](https://github.com/Everyplay/backbone-blueprint))
// - Mount models & collections CRUD easily into HTTP verbs by using Resource. E.g. HTTP POST should call Model.create.
// - Provide basis for implementing resource level fine grained ACL

exports.acl = require('./acl');
exports.db = require('./db');
exports.collections = require('./collections');
exports.errors = require('./errors');
exports.middleware = require('./middleware');
exports.models = require('./models');
exports.resources = require('./resources');
exports.Resource = exports.resources.Resource;
exports.utils = require('./utils');