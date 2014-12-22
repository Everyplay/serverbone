/**
 *
 * Mapping model's & collection's `CRUD` operations into `HTTP` verbs is done by using `Resource`.

 * Resource creates an [Express](http://expressjs.com) application with default routes created
 * that match the basic CRUD needs of a REST API.
 */
var _ = require('lodash');
var express = require('express');
var app = express.application;
var async = require('async');
var debug = require('debug')('serverbone:resource');
var Backbone = require('backbone');
var middleware = require('../middleware');
var serverbone = require('../');

/**
 * # Resource
 *
 * The `Resource` class provides Express CRUD route mapping for a
 * collection and its models. A `Resource` object can be mounted as an
 * Express sub application onto an HTTP path:
 * ```js
 * var app = express();
 * app.use(bodyParser.json());
 *
 * var moviesResource = new serverbone.Resource('movies', {
 *   collection: collections.Movies
 * });
 * // mount Movies resource into /movies
 * app.use('/movies', moviesResource.app);
 * ```
 * This will make the following routes available:
 *
 * - `GET /movies` maps to `fetch` on the collection class
 *   to fetch all models.
 * - `POST /movies` maps to `post` on the collection class
 *   to create a new model.
 * - `GET /movies/:id` Maps to `fetch` on the model class
 *   to fetch a model with the given `id`.
 * - `PUT /movies/:id` Maps to `update` on the model class
 *   to update a model with the given `id`.
 * - `DELETE /movies/:id` Maps to `delete` on the model class
 *   to delete a model with the given `id`.
 */
var Resource = module.exports = function (name, options) {
  this.name = name;
  this.app = express();
  this.relations = {};

  this.routes = {};
  options = options || {};

  // initialize this resouce's Collection & Model (both are required)
  this.CollectionClass = options.collection;
  if (!options.model && !this.CollectionClass) {
    throw new Error('collection must be defined in options');
  }
  this.ModelClass = options.model || this.CollectionClass.prototype.model;
  this.defaultProjectionOptions = options.defaultProjectionOptions;
  this.initializeResource(options);
  this.delegateEvents();
};

// Add Backbone.Events pub/sub functionality to Resource
_.extend(Resource.prototype, Backbone.Events);

/**
 * ## Resource.prototype.delegateEvents
 *
 * Setup event listeners. Maps events to methods, works similarly as in `Backbone.Model`.
 *
 * @param  {[type]} events [description]
 * @return {[type]}        [description]
 */
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
 * ## Resource.prototype.addRoute
 *
 * Add a custom route to this resource. The route will be handled before the
 * collection/model mapped routes created by `Resource`.
 *
 * Example:
 * ```js
 * resource.addRoute("GET", "/some_route", middleware,
 *   function(req, res, next) {
 *     res.send("HI!")
 *   });
 * ```
 *
 * @param {String} method enum GET,POST,PUT,DELETE,PATCH,HEAD
 * @param {String} route path where to mount
 * @param middleware list of Express-style middleware
 * @param {Function} handler the route handler
 * @api public
 **/
Resource.prototype.addRoute = function () {
  debug('Add route %s', JSON.stringify(arguments));
  var method = arguments[0];
  var route = arguments[1];
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

  // create a default router for custom routes (which are executed before default routes)
  this.router = express.Router();
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
  var send = _.bind(this.sendJson, this);

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
    'delete': [buildModel, remove, send]
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

  if (options.exposeSchema) {
    this._initializeSchemaResponse();
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

Resource.prototype._initializeSchemaResponse = function () {
  var schema = this.ModelClass.prototype.schema;
  if (!schema) return;

  this.app.get('/schema', function (req, res, next) {
    var admin = false;

    if (req.actor && typeof req.actor.getRoles === 'function') {
      admin = req.actor.getRoles(req.actor).indexOf('admin') > -1;
    }

    var response = {};
    response.id = schema.id;
    response.description = schema.description;
    response.type = schema.type;
    response.permissions = schema.permissions;

    if (typeof schema.owner === 'function') {
      response.owner = schema.owner;
    }

    response.properties = {};

    function isCanRead(permissions) {
      if (!permissions) {
        return true;
      }

      if (permissions['*'] && permissions['*'].indexOf('read') > -1
        || permissions.user && permissions.user.indexOf('read') > -1) {
        return true;
      } else if (admin && permissions.admin.indexOf('read') > -1) {
        return true;
      }

      return false;
    }

    _.each(schema.properties, function (value, key) {
      var permissions = value.permissions || schema.permissions;

      if (!isCanRead(permissions)) {
        return;
      }

      var propertyInfo = {};

      if (value.type !== 'relation') {
        if (typeof value.type !== 'function') {
          propertyInfo.type = value.type.toString();
        } else {
          propertyInfo.type = 'complex';
        }

        if (typeof value.default !== 'function') {
          propertyInfo.default = value.default;
        }

        propertyInfo.required = !!value.required;
      } else {
        var ref = "";
        var relation;

        if (value.model) {
          relation = new value.model({});
        } else if (value.collection) {
          var col = new value.collection(null, {});
          relation = new col.model();
        }

        if (relation
          && relation.constructor
          && relation.constructor.prototype
          && relation.constructor.prototype.schema) {
          ref = relation.constructor.prototype.schema.id;
        }

        if (value.model) {
          propertyInfo.$ref = ref;
        } else if (value.collection) {
          propertyInfo.type = 'array';
          propertyInfo.items = {
            $ref: ref
          };
        }
      }

      propertyInfo.permissions = value.permissions;
      propertyInfo.description = value.description;

      response.properties[key] = propertyInfo;
    });

    res.send(response);
  });
};

/**
 * ## Resource.prototype._mountRelations
 *
 * Goes trough relations specified in the model schema and mounts all
 * relations as subresources. The schema should set the option
 * `mountRelations` to true and each relation must have the option `mount`
 * set to true if it should be mounted.
 *
 * @api private
 */
Resource.prototype._mountRelations = function () {
  var self = this;

  var schema = this.ModelClass.prototype.schema;
  if (!schema) return;

  var properties = schema.properties;
  if (!properties) return;

  Object.keys(properties).forEach(function (propertyName) {
    var property = properties[propertyName];
    var isCollection = typeof property.collection !== 'undefined';
    var isModel = typeof property.model !== 'undefined';

    var mountRelation = typeof property === 'object'
      && (isCollection || isModel)
      && property.mount === true;

    if (mountRelation) {
      var relationCollection = property.collection;
      var relationModel = property.model;
      var mountName = property.name || propertyName;

      var ResourceClass;

      if (_.isString(property.resourceType)) {
        if (property.resourceType === 'list') {
          ResourceClass = serverbone.resources.ListResource;
        }
      }

      if (_.isObject(property.resourceType)) {
        ResourceClass = property.resourceType;
      }

      if (!ResourceClass) ResourceClass = Resource;

      var resource = new ResourceClass(self.name + '_' + mountName, {
        collection: relationCollection,
        model: relationModel
      });

      resource._constructCollection = self._getConstuctCollectionFunction(propertyName);
      self.relations[mountName] = resource;

      self.app.all('/:id/' + mountName, function (req, res, next) {
        req.originalUrl = req.url;
        req.url = req.url.replace(req.params.id + '/' + mountName, '');
        if (req.model && req.model.promise) {
          req.model.promise.done(function() {
            resource.app.call(resource.app, req, res, next);
          }, function(err) {
            console.log(err);
            next(err);
          });
        } else {
          resource.app.call(resource.app, req, res, next);
        }
      });

      self.app.all('/:id/' + mountName + '/:relId', function(req, res, next) {
        req.originalUrl = req.url;
        req.url = req.url.replace(req.params.id + '/' + mountName + '/', '');
        delete req.params;
        if (req.model && req.model.promise) {
          req.model.promise.done(function() {
            resource.app.call(resource.app, req, res, next);
          }, function(err) {
            console.log(err);
            next(err);
          });
        } else {
          resource.app.call(resource.app, req, res, next);
        }
      });

    }
  });
};

/**
 * ## Resource.prototype._getConstuctCollectionFunction
 *
 * A helper method for [_mountRelations](#resource.prototype._mountrelations)
 * providing a function to override the `_constructCollection` method on a
 * resource mounted for a relation.
 *
 * @return {Function} the override function
 * @api private
 */
Resource.prototype._getConstuctCollectionFunction = function(propertyName) {
  return function (req) {
    var collection = req.model.get(propertyName);
    if (!collection) {
      throw new Error('cannot get ' + req.model.type + ' property:' + propertyName);
    }
    if (!collection.actor) collection.actor = req.actor;
    return collection;
  };
};

/**
 * ## Resource.prototype._addParameterHandler
 *
 * Adds an Express `app.param` handler for the `idAttribute` of this route's
 * model.
 *
 * The param handler creates a model instance, sets it as `req.model`,
 * and sets the model's `idAttribute` to the captured parameter value.
 * `req.model.fetch()` will be called and the returned promise set to
 * `req.model.promise`. The handler then calls `next()`.
 *
 * The promise can be used as follows:
 * ```js
 * req.model.promise.then(function() {
 *   res.send(req.model);
 * });
 * ```
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
      case 'POST':
        req.model = self._constructModel(req);
        req.model.set(req.model.idAttribute, id);
        break;
      default:
        return next(new Error('Unknown request method: ' + req.method));
    }
    next();
  });
};


/**
 * ## Resource.prototype._addErrorHandler
 *
 * Adds an Express application error handler for the mounted path.
 * This also puts the resource's application under its own error domain
 * that handles any uncaught exceptions relating to this resource.
 *
 * `this.app`'s middleware chain is already ran using a domain that forwards
 * all uncaught exceptions here.
 *
 * @api private
 */
Resource.prototype._addErrorHandler = function () {
  debug('Adding express errorhandler');
  var self = this;
  this.app.use(function (err, req, res, next) {
    return self.errorHandler(err, req, res, next);
  });
};

Resource.prototype.errorHandler = function(err, req, res, next) {
  return serverbone.utils.response.sendError(req, res, err);
};

/**
 * ## Resource.prototype._addRoute
 *
 * Adds a route to the Express application.
 *
 * @api private
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
  debug('%s AddRoute: %s %s', this.name, method, route);
  this.app[method].apply(this.app, args);
};

/**
 * ## Resource.prototype._addCustomRoute
 *
 * Adds a custom route to Resource.
 * The configuration format:
 *     {path: '/foo', method: 'get', handlers: [fn1, fn2]}
 *
 * @param {Object} routeConfig route configuration
 * @api private
 */
Resource.prototype._addCustomRoute = function (routeConfig) {
  var route = routeConfig.path;
  var args = [route].concat(routeConfig.handlers);
  this.app[routeConfig.method].apply(this.app, args);
};

// Instantiate new Model if POST, otherwise fetch existing
Resource.prototype.buildModel = function (req, res, next) {
  debug('buildModel method: %s, url: %s', req.method, req.url);
  switch (req.method) {
    case 'POST':
      res.locals.resource = this._constructModel(req, req.body);
      next();
      break;
    default:
      res.locals.resource = req.model;
      return this.fetchModel(req, res, next);
  }
};

Resource.prototype.fetchModel = function(req, res, next) {
  if (req.model.id && req.model.id !== 'undefined') {
    var projectionOptions = this.getProjectionOptions(req, res);
    var projection = projectionOptions.projection;
    var fetchOptions = this.getModelFetchOptions(req, res);
    debug('fetchModel', req.model.type, _.omit(fetchOptions, 'actor'), projection);
    req.model.promise = req.model.fetchRequired(projection, fetchOptions);
  } else {
    console.warn('id param missing', req.url);
    res.locals.resource = req.model;
    return next();
  }
  req.model.promise.done(
    function () {
      return next();
    },
    function handleError(err) {
      return next(err);
    }
  );
};

Resource.prototype.getModelFetchOptions = function(req, res) {
  var projectionOptions = this.getProjectionOptions(req, res);
  var fetchOptions = _.omit(projectionOptions, 'projection');
  var relationsToFetch = this.parseRelationToFetch(req, req.model);
  if (relationsToFetch) {
    fetchOptions.onlyRelations = relationsToFetch;
  }
  return fetchOptions;
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
  var model = new Class(data, {actor: req.actor});
  if (!model.collection) {
    model.collection = this._constructCollection(req);
  }
  return model;
};

Resource.prototype._constructCollection = function (req) {
  return new this.CollectionClass(null, {actor: req.actor});
};

// Fetch collection with given params
Resource.prototype.buildCollection = function (req, res, next) {
  res.locals.resource = req.collection = this._constructCollection(req);
  var fetchOptions = this._parseFetchOptions(req.query);
  fetchOptions.actor = fetchOptions.actor || req.actor;
  req.collection
    .fetch(fetchOptions)
    .done(function () {
      next();
    }, function (err) {
      next(err);
    });
};

// helper function to figure out which relations need to be fetched
Resource.prototype.getRequiredRelations = function(req) {
  var query = req.query || {};
  var model;
  if (req.collection) {
    model = new req.collection.model();
  } else {
    model = req.model;
  }

  if (!query.fields) {
    // fetch default relations based on projection options
    var defaults = _.result(model, 'defaultProjectionOptions');
    return defaults.requiredRelations;
  }

  var relationKeys = Object.keys(model.relationDefinitions);
  var fields = query.fields
    .split(',')
    .map(function(field) {
      return field.trim();
    });
  return _.intersection(fields, relationKeys);
};

Resource.prototype.parseRelationToFetch = function(req, resource) {
  var relations = resource.defaultRelationsToFetch ? resource.defaultRelationsToFetch() : null;
  if (req.query.include_relations === 'false') {
    relations = [];
  } else if (_.isString(req.query.include_relations) && req.query.include_relations.length) {
    relations = req.query.include_relations.split(',');
  }

  return relations;
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

/**
 * ## Resource.prototype.update
 *
 * Used in handling HTTP PUT or PATCH request on an `/:id` path identifying
 * a model instance.
 * Updates the model attributes based on request's JSON body.
 */
// Update Model attributes
Resource.prototype.update = function (req, res, next) {
  var attrs = req.body;
  req.model.set(attrs);
  next();
};

/**
 * ## Resource.prototype.create
 *
 * Used in handling an HTTP POST request on the resource root.
 * Creates a new model instance and saves it in the storage backend.
 */
Resource.prototype.create = function (req, res, next) {
  var collection = this._constructCollection(req);
  collection
    .create(req.body, {wait: true, actor: req.actor})
    .done(function (model) {
      res.locals.resource = model;
      next();
    }, function (err) {
      next(err);
    });
};

/**
 * ## Resource.prototype.save
 *
 * Used in handling HTTP PUT or PATCH request on an `/:id` path identifying
 * a model instance.
 * Saves the updated model in the storage backend.
 */
Resource.prototype.save = function (req, res, next) {
  //TODO: PATCH support
  req.model
    .save(null, {actor: req.actor})
    .done(function () {
      next();
    }, function (err) {
      next(err);
    });
};

/**
 * ## Resource.prototype.remove
 *
 * Used in handling an HTTP DELETE request on an `/:id` path identifying
 * a model instance.
 * Deletes the model.
 */
Resource.prototype.remove = function (req, res, next) {
  req.model
    .destroy({actor: req.actor})
    .done(function () {
      next();
    }, function (err) {
      next(err);
    });
};

/**
 * Parse projection options based on request
 */
Resource.prototype.getProjectionOptions = function(req, res) {
  var query = req.query || {};
  var projection;
  if (query.fields) {
    projection = {};
    projection.onlyFields = query.fields
      .split(',')
      .map(function(field) {
        return field.trim();
      });
  }
  if (!res.locals.resource) res.locals.resource = req.model;
  if (!res.locals.resource) {
    console.error('no resource found!');
    return this.sendError(req, res, new Error('Resource not found'));
  }

  // first default to local projectionOptions object which might be set by resource
  var projectionOptions = res.locals.resource.projectionOptions;

  // 2nd default to Model/Collection defaultProjectionOptions function
  if (!projectionOptions) {
    projectionOptions = res.locals.resource.defaultProjectionOptions
    ? res.locals.resource.defaultProjectionOptions()
    : null;
  }

  // 3rd resource may define default projection options
  if (!projectionOptions) {
    projectionOptions = this.defaultProjectionOptions;
  }

  // finally set defaults if no projectionOptions found
  if (!projectionOptions) {
    projectionOptions = {
      recursive: true
    };
  }

  if (projection) {
    projectionOptions.projection = projection;
  }

  if (!projectionOptions.actor) {
    projectionOptions.actor = req.actor;
  }

  return projectionOptions;
};

/**
 * Convert resource to JSON and send the response
 */
Resource.prototype.sendJson = function(req, res) {
  var projectionOptions = this.getProjectionOptions(req, res);
  var json = res.locals.resource.toJSON(projectionOptions);
  return res.json(json);
};
