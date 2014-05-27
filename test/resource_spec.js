var testSetup = require('./test_setup');
var should = require('chai').should();
var express = require('express');
var request = require('supertest');
var sinon = require('sinon');
var util = require('util');
var _ = require('lodash');
var Promises = require('backbone-promises');
var serverbone = require('..');
var when = require('when');
var assert = require('assert');

var TestModel = testSetup.TestModel;
var ProtectedCollection = testSetup.ProtectedCollection;
var TestCollection = testSetup.TestCollection;
var FailingCollection = testSetup.FailingCollection;

describe('Test Resource', function () {
  var app;
  var id;
  var resource;
  var projRes;
  var sandbox;

  before(function (next) {
    testSetup.setupDbs(function(err, dbs) {
      if (!testSetup.unitTesting) {
        testSetup.setDb(TestModel, 'redis');
        testSetup.setDb(TestCollection, 'redis');
        testSetup.setDb(ProtectedCollection, 'redis');
        testSetup.setDb(FailingCollection, 'redis');
      }

      app = express();
      app.use(express.json());
      app.use(express.urlencoded());
      resource = new serverbone.Resource('test', {
        mountRelations: true,
        collection: TestCollection
      });
      var fooRes = new serverbone.Resource('foo', {
        collection: TestCollection
      });
      projRes = new serverbone.Resource('proj', {
        collection: testSetup.TestCollection2
      });
      var protRes = new serverbone.Resource('prot', {
        collection: ProtectedCollection
      });

      app.use('/test', resource.app);
      app.use('/foo', fooRes.app);
      app.use('/prot', protRes.app);
      app.use('/proj', projRes.app);
      resource.should.be.an.instanceof(serverbone.Resource);
      sandbox = sinon.sandbox.create();
      next();
    });
  });

  after(function (next) {
    sandbox.restore();
    testSetup.clearDb();
    setTimeout(next, 50);
  });

  describe('Internals', function () {
    after(function () {
      sandbox.restore();
      testSetup.clearDb();
    });

    it('should create an application & take model from collection if not provided', function (next) {
      var res = new serverbone.Resource('test', {
        collection: TestCollection
      });
      res.app.should.be.ok;
      next();
    });

    it('should create a parameter handler using models idAttribute', function (next) {
      var res = new serverbone.Resource('testing', {
        model: TestModel,
        collection: TestCollection
      });
      // bypass the actual resource to test just the param loader.
      res.app.get('/asd/:id', function (req, res, next) {
        req.model.should.be.ok;
        req.model.get(req.model.idAttribute).should.be.equal(123);
        res.send(req.model);
      });

      var model = new TestModel({
        id: 123,
        test: 'asdasd',
        title: 'foo'
      });

      model
        .save()
        .done(function () {
          request(res.app)
            .get('/asd/123')
            .end(function (err, res) {
              res.status.should.be.equal(200);
              res.body.id.should.equal(123);
              next();
            });
        }, next);
    });

    it('should forward all uncaught exceptions to the error handler', function (next) {
      var res = new serverbone.Resource('test', {
        collection: TestCollection,
        model: TestModel
      });
      res.app.should.be.ok;
      res.addRoute("GET", '/throwing_route', function (req, res, next) {
        var err = new Error('test error');
        err.status = 444;
        throw err;
      });
      request(res.app)
        .get('/throwing_route')
        .end(function (err, res) {
          res.status.should.be.equal(444);
          next();
        });
    });

    it('should map urls to resource', function (next) {
      var app = express();
      var opts = {
        collection: TestCollection
      };
      var res = new serverbone.Resource('test', opts);
      app.use('/api/v1/foo/test', res.app);
      res.app.should.be.ok;
      request(app)
        .get('/api/v1/foo/test')
        .end(function (err, res) {
          res.status.should.equal(200);
          next();
        });
    });

    it('should allow exteding resource', function (next) {
      var fooMiddleware = function () {
        return function (req, res, next) {
          req.user = {
            id: 1
          };
          next();
        };
      };

      var CustomResource = function (name, options, app) {
        options.customRoutes = [{
          path: '/foo/testpath',
          method: 'get',
          handlers: [
            _.bind(this.setup, this),
            _.bind(this.send, this)
          ]
        }];
        serverbone.Resource.call(this, name, options);
      };

      util.inherits(CustomResource, serverbone.Resource);

      CustomResource.prototype.setup = function (req, res, next) {
        this.val = 'bar2';
        next();
      };

      CustomResource.prototype.send = function (req, res) {
        res.json({
          foo: this.val,
          user: req.user
        });
      };

      CustomResource.prototype.initMiddlewares = function (options) {
        serverbone.Resource.prototype.initMiddlewares.call(this, options);
        this.app.use(fooMiddleware());
      };

      var app = express();
      var opts = {
        collection: TestCollection
      };
      var res = new CustomResource('cust', opts);
      app.use('/api/v1/cust', res.app);
      request(app)
        .get('/api/v1/cust/foo/testpath')
        .end(function (err, res) {
          res.status.should.equal(200);
          res.body.foo.should.equal('bar2');
          res.body.user.id.should.equal(1);
          next();
        });
    });
  });

  describe('CRUD', function () {

    after(function(next) {
      setTimeout(next, 50);
    });

    it('should create resource', function (next) {
      request(app)
        .post('/test')
        .send({
          title: 'bar'
        })
        .expect(200)
        .end(function (err, res) {
          should.exist(res.body);
          res.body.title.should.equal('bar');
          id = res.body.id;
          should.exist(id);
          next();
        });
    });

    it('should read model', function (next) {
      request(app)
        .get('/test/' + id)
        .expect(200)
        .end(function (err, res) {
          should.exist(res.body);
          res.body.id.should.equal(id);
          res.body.title.should.equal('bar');
          next();
        });
    });

    it('should read only specified fields of a model', function(next) {
      request(app)
        .get('/test/' + id + '?fields=id')
        .expect(200)
        .end(function (err, res) {
          should.exist(res.body);
          Object.keys(res.body).length.should.equal(1);
          should.exist(res.body.id);
          next();
        });
      });

    it('should read list of models', function (next) {
      request(app)
        .get('/test')
        .end(function (err, res) {
          res.status.should.equal(200);
          var models = res.body;
          should.exist(models);
          models.length.should.equal(1);
          var model = models[0];
          model.title.should.equal('bar');
          next();
        });
    });

    it('should update model with PUT', function (next) {
      request(app)
        .put('/test/' + id)
        .send({
          id: id,
          title: 'new title'
        })
        .end(function (err, res) {
          res.status.should.equal(200);
          res.body.title.should.equal('new title');
          next();
        });
    });

    it('should check that model title was updated with PUT', function (next) {
      request(app)
        .get('/test/' + id)
        .expect(200)
        .end(function (err, res) {
          should.exist(res.body);
          res.body.id.should.equal(id);
          res.body.title.should.equal('new title');
          next();
        });
    });

    it('should update attributes with PATCH', function (next) {
      request(app)
        .patch('/test/' + id)
        .send({
          title: 'another title',
          test: 'foo'
        })
        .end(function (err, res) {
          res.status.should.equal(200);
          res.body.test.should.equal('foo');
          next();
        });
    });

    it('should check that model attributes were changed with PATCH', function (next) {
      request(app)
        .get('/test/' + id)
        .expect(200)
        .end(function (err, res) {
          should.exist(res.body);
          res.body.id.should.equal(id);
          res.body.title.should.equal('another title');
          next();
        });
    });

    it('should return error if trying to update model with invalid values', function (next) {
      request(app)
        .patch('/test/' + id)
        .send({
          title: {
            foo: 'bar'
          }
        })
        .end(function (err, res) {
          res.status.should.equal(400);
          res.body.error.should.be.ok;
          next();
        });
    });

    it('should delete a model', function (next) {
      request(app)
        .del('/test/' + id)
        .end(function (err, res) {
          res.status.should.equal(200);
          next();
        });
    });

    it('should check that model got removed', function (next) {
      request(app)
        .get('/test')
        .end(function (err, res) {
          res.status.should.equal(200);
          var models = res.body;
          models.length.should.equal(0);
          next();
        });
    });

    it('should return error if trying to create resource with invalid values', function (next) {
      request(app)
        .post('/foo')
        .send({})
        .end(function (err, res) {
          res.status.should.equal(400);
          var body = res.body;
          body.error.should.equal('validation_error');
          next();
        });
    });

    it('should return error produced by preSave', function (next) {
      var res = new serverbone.Resource('fail', {
        collection: FailingCollection
      });

      request(res.app)
        .post('/fail')
        .send({})
        .end(function (err, res) {
          next();
        });
    });

    it('should grant access to resource', function (next) {
      request(app)
        .post('/prot')
        .send({
          title: 'bar'
        })
        .end(function (err, res) {
          res.status.should.equal(200);
          next();
        });
    });
  });

  describe('Resource listing', function () {
    it('should pass req.query options to Resource collection\'s fetch', function (next) {
      var spy = sandbox.spy(Promises.Collection.prototype, 'fetch');
      request(app)
        .get('/test?sort=title&limit=5&offset=5&after_id=99')
        .end(function (err, res) {
          res.status.should.equal(200);
          spy.called.should.equal(true);
          var args = spy.getCall(0).args[0];
          args.sort.should.equal('title');
          args.limit.should.equal(5);
          args.offset.should.equal(5);
          args.after_id.should.equal(99);
          sandbox.restore();
          next();
        });
    });
  });

  describe('Relations mounting', function () {
    var subresourceId;

    after(function (next) {
      setTimeout(next, 50);
    });

    it('resources for relations should have been created', function () {
      resource.relations.tests.should.be.ok;
      resource.relations.icanhazcustoms.should.be.ok;
    });

    it('should return mounted relation', function (next) {
      request(app)
        .get('/test/' + id + '/tests?sort=title&limit=5&offset=5')
        .end(function (err, res) {
          res.status.should.equal(200);
          next();
        });
    });

    it('should return mounted relation with custom name property', function (next) {
      request(app)
        .get('/test/' + id + '/icanhazcustoms?sort=title&limit=5&offset=5')
        .end(function (err, res) {
          res.status.should.equal(200);
          next();
        });
    });

    it('should have mounted a Model relation', function(next) {
      sandbox.stub(testSetup.EmptyModel.prototype, 'fetch', function() {
        return when.resolve();
      });
      request(app)
        .get('/test/' + id + '/modelrel')
        .end(function (err, res) {
          res.status.should.equal(200);
          next();
        });
    });

    it('should be able to create subresource with post', function(next) {
      request(app)
        .post('/test/' + id + '/tests')
        .send({foo: 'sub'})
        .end(function (err, res) {
          res.body.foo.should.equal('sub');
          subresourceId = res.body.id;
          next();
        });
    });

    it('should fetch created subresource', function(next) {
      request(app)
        .get('/test/' + id + '/tests/' + subresourceId)
        .end(function (err, res) {
          res.body.foo.should.equal('sub');
          next();
        });
    });

    it('should delete subresource', function(next) {
      request(app)
        .del('/test/' + id + '/tests/' + subresourceId)
        .end(function (err, res) {
          res.status.should.equal(200);
          next();
        });
    });

    it('should not fetch deleted subresource', function(next) {
      request(app)
        .get('/test/' + id + '/tests/' + subresourceId)
        .end(function (err, res) {
          res.status.should.equal(404);
          next();
        });
    });

    it('should have mounted relation as ListResource', function(next) {
      resource.relations.listrel.should.be.ok;
      resource.relations.listrel.should.be.an.instanceOf(serverbone.resources.ListResource);
      request(app)
        .get('/test/' + id + '/listrel')
        .end(function (err, res) {
          res.status.should.equal(200);
          next();
        });
    });

    it('should save empty model, used in next step', function() {
      var model = new testSetup.EmptyModel({id: 5});
      return model.save();
    });

    it('ListResource should`ve overriden put method', function(next) {
      request(app)
        .put('/test/' + id + '/listrel/5')
        .end(function (err, res) {
          res.status.should.equal(200);
          next();
        });
    });
  });

  describe('Expose schema', function () {
    it('should expose schema', function (next) {
      var resource = new serverbone.Resource('test', {
        exposeSchema: true,
        collection: TestCollection
      });

      request(resource.app)
        .get('/schema')
        .end(function (err, res) {
          assert.deepEqual(res.body, {
            "properties": {
              "id": {
                "type": "integer",
                "required": false
              },
              "title": {
                "type": "string",
                "required": true
              },
              "test": {
                "type": "string",
                "required": false
              },
              "tests": {
                "type": "array",
                "items": {
                  "$ref": "foobar"
                }
              },
              "customName": {
                "type": "array",
                "items": {
                  "$ref": "barfoo"
                }
              },
              "listRelation": {
                "type": "array",
                "items": {
                  "$ref": "barfoo"
                }
              },
              "modelRelation": {
                '$ref': 'barfoo'
              }
            }
          });

          res.status.should.equal(200);
          next();
        });
    });
  });

  describe('JSON', function() {

    before(function() {
      sandbox.stub(projRes.ModelClass.prototype, 'fetch', function(options) {
        var coll = new testSetup.TestCollection2();
        var model = new testSetup.TestModel2({id: 5});
        coll.add(model);
        this.set({
          title: 'bar',
          tests: coll
        });
        return when.resolve();
      });
    });

    after(function() {
      sandbox.restore();
    });

    it('should check default projection options', function() {
      var model = new projRes.ModelClass();
      var opts = model.defaultProjectionOptions();
      opts.projection.should.be.ok;
    });

    it('should include use default projection in output', function(next) {
      request(app)
        .get('/proj/1')
        .end(function (err, res) {
          var body = res.body;
          body.tests.length.should.equal(1);
          should.not.exist(body.customName);
          next();
        });
    });
  });

});