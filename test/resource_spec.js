var should = require('chai').should();
var express = require('express');
var request = require('supertest');
var sinon = require('sinon');
var util = require('util');
var _ = require('lodash');
var serverbone = require('..');

var testSetup = require('./test_setup');
var TestModel = testSetup.TestModel;
var ProtectedCollection = testSetup.ProtectedCollection;
var TestCollection = testSetup.TestCollection;
var FailingCollection = testSetup.FailingCollection;

describe('Test Resource', function () {
  var app;
  var id;
  var resource;

  before(function () {
    app = express();
    app.use(express.json());
    app.use(express.urlencoded());
    resource = new serverbone.Resource('test', {
      collection: TestCollection
    });
    var fooRes = new serverbone.Resource('foo', {
      collection: TestCollection
    });
    app.use('/test', resource.app);
    app.use('/foo', fooRes.app);
    var protRes = new serverbone.Resource('prot', {
      collection: ProtectedCollection
    });
    app.use('/prot', protRes.app);
    resource.should.be.an.instanceof(serverbone.Resource);
    //app.resources.test.should.be.an.instanceof(serverbone.Resource);
  });

  after(function () {
    testSetup.clearDb();
  });

  describe('Internals', function () {
    after(function () {
      testSetup.clearDb();
    });

    it('should create an application & take model from collection if not provided', function (done) {
      var res = new serverbone.Resource('test', {
        collection: TestCollection
      });
      res.app.should.be.ok;
      done();
    });

    it('should create a parameter handler using models idAttribute', function (done) {
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
      model.save().then(function () {
        request(res.app)
          .get('/asd/123')
          .end(function (err, res) {
            res.status.should.be.equal(200);
            res.body.test.should.be.equal('asdasd');
            done();
          });
      }).otherwise(done);
    });

    it('should forward all uncaught exceptions to the error handler', function (done) {
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
          done();
        });
    });

    it('should map urls to resource', function (done) {
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
          done();
        });
    });

    it('should allow exteding resource', function (done) {
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
          done();
        });
    });
  });

  describe('CRUD', function () {
    it('should create resource', function (done) {
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
          done();
        });
    });

    it('should read resource', function (done) {
      request(app)
        .get('/test/' + id)
        .expect(200)
        .end(function (err, res) {
          should.exist(res.body);
          res.body.id.should.equal(id);
          res.body.title.should.equal('bar');
          done();
        });
    });

    it('should read list of models', function (done) {
      request(app)
        .get('/test')
        .end(function (err, res) {
          res.status.should.equal(200);
          var models = res.body;
          should.exist(models);
          models.length.should.equal(1);
          var model = models[0];
          model.title.should.equal('bar');
          done();
        });
    });

    it('should update model with PUT', function (done) {
      request(app)
        .put('/test/' + id)
        .send({
          id: id,
          title: 'new title'
        })
        .end(function (err, res) {
          res.status.should.equal(200);
          res.body.title.should.equal('new title');
          done();
        });
    });

    it('should check that model title was updated with PUT', function (done) {
      request(app)
        .get('/test/' + id)
        .expect(200)
        .end(function (err, res) {
          should.exist(res.body);
          res.body.id.should.equal(id);
          res.body.title.should.equal('new title');
          done();
        });
    });

    it('should update attributes with PATCH', function (done) {
      request(app)
        .patch('/test/' + id)
        .send({
          title: 'another title',
          test: 'foo'
        })
        .end(function (err, res) {
          res.status.should.equal(200);
          res.body.test.should.equal('foo');
          done();
        });
    });

    it('should check that model attributes were changed with PATCH', function (done) {
      request(app)
        .get('/test/' + id)
        .expect(200)
        .end(function (err, res) {
          should.exist(res.body);
          res.body.id.should.equal(id);
          res.body.title.should.equal('another title');
          done();
        });
    });

    it('should return error if trying to update model with invalid values', function (done) {
      request(app)
        .patch('/test/' + id)
        .send({
          title: {
            foo: 'bar'
          }
        })
        .end(function (err, res) {
          res.status.should.equal(400);
          res.body.status.should.equal('error');
          res.body.message.should.be.ok;
          done();
        });
    });

    it('should delete a model', function (done) {
      request(app)
        .del('/test/' + id)
        .end(function (err, res) {
          res.status.should.equal(200);
          done();
        });
    });

    it('should check that model got removed', function (done) {
      request(app)
        .get('/test')
        .end(function (err, res) {
          res.status.should.equal(200);
          var models = res.body;
          models.length.should.equal(0);
          done();
        });
    });

    it('should return error if trying to create resource with invalid values', function (done) {
      request(app)
        .post('/foo')
        .send({})
        .end(function (err, res) {
          res.status.should.equal(400);
          res.body.message.should.be.ok;
          done();
        });
    });

    it('should return error produced by preSave', function (done) {
      var res = new serverbone.Resource('fail', {
        collection: FailingCollection
      });

      request(res.app)
        .post('/fail')
        .send({})
        .end(function (err, res) {
          done();
        });
    });

    it('should grant access to resource', function (done) {
      request(app)
        .post('/prot')
        .send({
          title: 'bar'
        })
        .end(function (err, res) {
          res.status.should.equal(200);
          done();
        });
    });
  });

  describe('Resource listing', function () {

    it('should pass req.query options to Resource collection\'s fetch', function (done) {
      var spy = sinon.spy(resource.collection, 'fetch');
      request(app)
        .get('/test?sort=title&limit=5&offset=5')
        .end(function (err, res) {
          res.status.should.equal(200);
          spy.called.should.equal(true);
          var args = spy.getCall(0).args[0];
          args.sort.should.equal('title');
          args.limit.should.equal(5);
          args.offset.should.equal(5);
          done();
        });
    });
  });

});