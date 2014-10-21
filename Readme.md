# Serverbone [![TravisCI][travis-img-url]][travis-ci-url] [![Coverage Status][coveralls-img-url]][coveralls-url]

[travis-img-url]: https://travis-ci.org/Everyplay/serverbone.png?branch=master
[travis-ci-url]: https://travis-ci.org/Everyplay/serverbone
[coveralls-img-url]: https://coveralls.io/repos/Everyplay/serverbone/badge.png?branch=master
[coveralls-url]: https://coveralls.io/r/Everyplay/serverbone

# Introduction

[Serverbone.js](http://serverbonejs.org/) is a server-side Rest API framework that support multiple data stores on Node.js. Especially, you can combine multiple data stores such as a document store (e.g. MongoDB using [backbone-db-mongodb](https://github.com/Everyplay/backbone-db-mongodb)), and a key-value store for indexes (e.g. Redis using [backbone-db-redis](https://github.com/Everyplay/backbone-db-redis)). The project is based on the following modules:

- [Backbone DB](https://github.com/Everyplay/backbone-db): provides interface for interacting with databases
- [Backbone Promises](https://github.com/Everyplay/backbone-promises): serverbone APIs use Promises/A+ conventions.
- [Backbone Blueprint](https://github.com/Everyplay/backbone-blueprint): JSON schema parsing & validation, etc.

The goals of the framework are:
- Define models using JSON configuration (based on JSON Schema, implemented by [backbone-blueprint](https://github.com/Everyplay/backbone-blueprint))
- Mount models & collections CRUD easily into HTTP verbs by using Resource. E.g. HTTP POST should call Model.create.
- Provide basis for implementing resource level fine grained ACL

# Examples

- [serverbone-example](https://github.com/mikkolehtinen/serverbone-example)

## How to develop

### Testing

  ``` shell
  make test
  ```

### View code coverage reports

  ``` shell
  make check-coverage
  open coverage/lcov-report/index.html
  ```

# Architecture

## Collections

### BaseCollection

Base Collection for most other Collections

### IndexCollection

Deprecated

### IndexMixin

Mixin for creating collections, that can have their indexes stored in other databases from the main db of the Collection.

### JSONIndexMixin

Mixin for Collections that store JSON data in model's id field.

### MultiIndexMixin

Mixin for reading values from multiple indexes, i.e. joins multiple Redis sets.

### ValueIndexMixin

Mixin for Collections that store plain strings into Redis sets.

## Models

### BaseModel

BaseModel extends [backbone-blueprint](https://github.com/Everyplay/backbone-blueprint)'s ValidatingModel providing e.g. Model lifecycle conventions, ACL related functionality & CRUD helpers.

### FlatModel

Model for storing strings/numbers. Meant to be used together with ValueIndexMixin.

### JSONModel

Model for storing raw JSON data in the id field. Meant to be used together /w JSONIndexMixin.

## ACL

ACL permissions are defined in the Model's schema as  `role: [actions]`. Permissions may be defined in Model level (which applies to all properties) or per property (which overrides Model level permissions). For example:

	permissions: {
  		admin: ['*'],
  		owner: ['update', 'destroy'],
  		'*': ['read', 'create']
	}

This would give `admin` role permission to all verbs. `owner` can update & destroy Model. Finally `world` (indicated by `*`) can read models & create new Model instances. How roles are defined is up to the application to implement. You should override Model's `getRoles` for implementing custom functionality.

## Resource

Provides mapping Model/Collection CRUD operation into HTTP verbs, thus adding routes into express application. By default the following routes are added:


#### GET /

Maps to Collection.fetch.

#### POST /

Maps to Collection.post (creates a new model).

#### GET /:id

Maps to Model.fetch (fetches model with given id).

#### PUT /:id

Maps to Model.update (updates model with given id).

#### DELETE /:id

Maps to Model.delete (delete model with given id).


## Utils

#### async

Helpers for running async functions.

#### response_utils

Handles sending JSON/error responses.

 
