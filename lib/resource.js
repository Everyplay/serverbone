/**
 * Resource routing. Handles mapping Models & Collections into routes.
 */
var _ = require('lodash');
var serverbone = require('./');
var express = require('express');
var middleware = require('./middleware');
var app = express.application;
var async = require('async');
var debug = require('debug')('serverbone:resource');
var Backbone = require('backbone');

var Resource = module.exports = function (name, options) {
  this.name = name;
  this.app = express();
  this.relations = {};

  // custom routes are added before this.app.router this we use the router before any.
  // it is set in initMiddlewares
  this.router = express();

  this.routes = {};
  options = options || {};
  // initialize this resouce's Collection & Model (both are required)

  this.CollectionClass = options.collection;
  if (!this.CollectionClass) throw new Error('collection must be defined in options');
  this.ModelClass = options.model || this.CollectionClass.prototype.model;
  this.initializeResource(options);
  this.delegateEvents();
};

_.extend(Resource.prototype, Backbone.Events);

Resource.prototype.delegateEvents = function (events) {
  if (!(events || (events = _.result(this, 'events')))) return this;
  debug('delegating events %s', JSON.stringify(events));
  for (var key in events) {
    var method = events[key];

    if (!_.isFunction(method)) method = this[events[key]];
    if (!method) continue;

    var match = key.match(/^(\S+)\s*(.*)$/),
      eventName = match[1],
      selector = match[2];

    method = _.bind(method, this);
    if (selector === '') {
      debug('Listening event %s on self', eventName);
      this.on(eventName, method);
    } else if (this[eventName] && _.isFunction(this[eventName].on)) {
      debug('Listening event %s on self.%s.on', selector, eventName);
      this[eventName].on(selector, method);
    }
  }
  return this;
};

/**
 * addRoute
 *
 * Add custom route to this resource, it will be handled before the created model routes
 * @param method {String} enum GET,POST,PUT,DELETE,PATCH,HEAD
 * @param route {String}
 * @param middleare list
 *
 * example:
 *
 * addRoute("GET", "/some_route", middleware, function(req, res, next) {
 *   res.send("HI!")
 * })
 *
 * @api public
 **/
Resource.prototype.addRoute = function () {
  debug('Add route %s', JSON.stringify(arguments));
  var method = arguments[0];
  var route = arguments[1];
  // GET, route_path, mw1, mw2 ....
  var fnList = [route].concat([].slice.call(arguments).slice(2));
  this.router[method.toLowerCase()].apply(this.router, fnList);
};

// middlewares are processed for each request
Resource.prototype.initMiddlewares = function (options) {
  // setup error domain first, always.
  this.app.use(function (req, res, next) {
    next();
  });
  this.app.use(middleware.domain());
  this.app.use(this.router);
};

Resource.prototype.initializeResource = function (options) {
  options = options || {};
  var self = this;
  var apiHandlers = {};
  var buildModel = _.bind(this.buildModel, this);
  var buildCollection = _.bind(this.buildCollection, this);
  var update = _.bind(this.update, this);
  var create = _.bind(this.create, this);
  var save = _.bind(this.save, this);
  var remove = _.bind(this.remove, this);
  var send = serverbone.utils.response.sendJson;

  //init middlewares etc. first
  this.initMiddlewares();
  this._addParameterHandler();

  // Setup crud API routes
  // Chained method handlers per method
  apiHandlers = {
    list: [buildCollection, send],
    get: [buildModel, send],
    post: [buildModel, create, send],
    put: [buildModel, update, save, send],
    patch: [buildModel, update, save, send],
    'delete': [buildModel, remove, send],
  };

  apiHandlers = _.chain(apiHandlers)
    .extend(options.apiHandlers)
    .value();

  this.apiHandlers = apiHandlers;

  // Setup custom routes if any
  if (options.customRoutes) {
    options.customRoutes.forEach(function (config) {
      self._addCustomRoute(config);
    });
  }

  // bind each array of handlers to the proper HTTP verb.
  Object.keys(apiHandlers).forEach(function (method) {
    self._addRoute(method);
  });

  if (options.mountRelations === true) {
    // mount collection relations
    this._mountRelations();
  }

  // error handling must be last
  this._addErrorHandler();
};

/**
 * _mountRelations
 *
 * Goes trough relation specified in the model schema and mounts all relations to collections
 */
Resource.prototype._mountRelations = function () {
  var self = this;

  var schema = this.ModelClass.prototype.schema;
  if (!schema) return;

  var properties = schema.properties;
  if (!properties) return;

  Object.keys(properties).forEach(function (propertyName) {
    var property = properties[propertyName];
    if (typeof property === 'object'
        && typeof property.collection !==  'undefined'
        && property.mount === true) {
      var relationCollection = property.collection;
      var mountName = property.name || propertyName;
      var resource = new Resource(self.name + "_" + mountName, {
        collection: relationCollection
      });

      resource._constructCollection = function (req) {
        return req.model.get(propertyName);
      };

      self.relations[mountName] = resource;

      self.app.all('/:id/' + mountName, function (req, res, next) {
        req.originalUrl = req.url;
        req.url = req.url.replace(req.params.id + "/" + mountName, "");
        resource.app.call(resource.app, req, res, next);
      });
    }
  });
};

/**
 * Adds express app.param handler for this routes model.idAttribute
 *
 * The param handler creates a model instance to req.model and sets the models idAttribute to the captured param.
 * req.model.fetch() will be called and the returned promise set to req.model.promise then calls next().
 *
 * example:
 *
 * req.model.promise.then(function() {
 *   res.send(req.model);
 * });
 *
 * @api private
 */
Resource.prototype._addParameterHandler = function () {
  var self = this;
  this.app.param('id', function (req, res, next, id) {
    switch (req.method) {
    case 'GET':
    case 'DELETE':
    case 'PUT':
    case 'PATCH':
      req.model = self._constructModel(req);
      req.model.set(req.model.idAttribute, id);
      req.model.promise = req.model.fetch();
      break;
    default:
      return next(new Error('Unknown request method: ' + req.method));
    }
    next();
  });
};


/**
 * _addErrorHandler
 *
 * Adds express application error handler also adds this application under its own error domain that handles any
 * uncaught exceptions relating to this resource.
 *
 * this.app middleware chain is already ran using domain that forwards all uncaught exceptions here.
 */
Resource.prototype._addErrorHandler = function () {
  debug('Adding express errorhandler');
  this.app.use(function (err, req, res, next) {
    return serverbone.utils.response.sendError(req, res, err);
  });
};

/**
 * _addRoute adds route to express application
 */
Resource.prototype._addRoute = function (method) {
  var methodHandlers = this.apiHandlers[method];
  var route = '/';
  if (method !== 'post' && method !== 'list') route += ':id';
  if (method === 'list') method = 'get';
  this.routes[method] = {
    method: method,
    path: route
  };
  var args = [route].concat(methodHandlers);
  debug('AddRoute: %s %s', method, route);
  this.app[method].apply(this.app, args);
};

/**
 * Adds a custom route to Resource
 * @param {Object} routeConfig, fmt:
 * {path: '/foo', method: 'get', handlers: [fn1, fn2]}
 */
Resource.prototype._addCustomRoute = function (routeConfig) {
  var route = routeConfig.path;
  var args = [route].concat(routeConfig.handlers);
  this.app[routeConfig.method].apply(this.app, args);
};

// Instantiate new Model if POST, otherwise fetch existing
Resource.prototype.buildModel = function(req, res, next) {
  debug('buildModel method: %s, url: %s', req.method, req.url);
  switch (req.method) {
    case 'POST':
      res.locals.resource = req.model = this._constructModel(req, req.body);
      debug('model added to res.local.resource: %s', JSON.stringify(req.model));
      next();
      break;
    default:
      req.model.promise.then(
        function() {
          return next();
        },
        function handleError(err) {
          return next(err);
        }
      );
  }
};

Resource.prototype._getModelClass = function (req) {
  var Class;
  if (this.ModelClass) {
    Class = this.ModelClass;
  } else if (this.CollectionClass && this.CollectionClass.prototype.model) {
    Class = this.CollectionClass.prototype.model;
  } else {
    Class = this._constructCollection(req).model;
  }

  return Class;
};

Resource.prototype._constructModel = function (req, data) {
  var Class = this._getModelClass(req);
  return new Class(data);
};

Resource.prototype._constructCollection = function (req) {
  return new this.CollectionClass();
};

// Fetch collection with given params
Resource.prototype.buildCollection = function (req, res, next) {
  res.locals.resource = req.collection = this._constructCollection(req);
  var fetchOptions = this._parseFetchOptions(req.query);
  req.collection
    .fetch(fetchOptions)
    .done(function () {
      next();
    }, next);
};

// Parse & convert options for collection.fetch
Resource.prototype._parseFetchOptions = function (sentOptions) {
  var opts = {};
  if (sentOptions.sort) opts.sort = sentOptions.sort;
  if (sentOptions.limit) opts.limit = parseInt(sentOptions.limit, 10);
  if (sentOptions.offset) opts.offset = parseInt(sentOptions.offset, 10);
  if (sentOptions.before_id) opts.before_id = sentOptions.before_id;
  if (sentOptions.after_id) opts.after_id = sentOptions.after_id;
  return opts;
};

// Update Model attributes
Resource.prototype.update = function (req, res, next) {
  var attrs = req.body;
  req.model.set(attrs);
  next();
};

// Create new model
Resource.prototype.create = function (req, res, next) {
  this._constructCollection(req).create(req.model.toJSON())
  .done(function (model) {
    res.locals.resource = req.model = model;
    next();
  }, next);
};

// Save updated model or update changed attributes with PATCH
Resource.prototype.save = function (req, res, next) {
  //TODO: PATCH support
  req.model
    .save()
    .done(function () {
      next();
    }, next);
};

// Destroy Model
Resource.prototype.remove = function (req, res, next) {
  req.model
    .destroy()
    .done(function () {
      next();
    }, next);
};