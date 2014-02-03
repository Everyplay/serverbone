# Everyplay models [![TravisCI][travis-img-url]][travis-ci-url] [![Coveralls][coveralls-img-url]][coveralls-url]

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

BaseModel extends [backbone-blueprint](https://github.com/mikkolehtinen/backbone-blueprint)'s ValidatingModel providing e.g. Model lifecycle conventions, ACL related functionality & CRUD helpers.

### FlatModel

Model for storing strings/numbers. Meant to be used together with ValueIndexMixin.

### JSONModel

Model for storing raw JSON data in the id field. Meant to be used together /w JSONIndexMixin.

## ACL

TODO

## Registry

Helper for caching model/collection data. Currently wip & not in use.

## Resource

Provides mapping Model/Collection CRUD operation into HTTP verbs, thus adding routes into express application.

## Utils

#### async

Helpers for running async functions.

#### response_utils

Handles sending JSON/error responses.

 
