/**
 * Resource class for list style resources,
 * thus collection is IndexMixin based
 */
var when = require('when');
var util = require('util');
var Resource = require('./resource');

var ListResource = function(name, options, app) {
  Resource.call(this, name, options, app);
};
util.inherits(ListResource, Resource);

ListResource.prototype._addParameterHandler = function () {
  var self = this;
  this.app.param('id', function(req, res, next, id) {
    self.listModel = self._constructModel(req);
    self.listModel.set(req.model.idAttribute, id);
    // no need to load parent model
    req.model.promise = when.resolve();
    next();
  });
};

ListResource.prototype.create = function(req, res, next) {
  throw new Error('create is not implemented');
};

// override default update -> addToIndex instead of update
ListResource.prototype.update = function(req, res, next) {
  var data = this.listModel;
  var collection = this._constructCollection(req);
  collection
    .addToIndex(data)
    .done(function () {
      req.model = res.locals.resource = data;
      next();
    }, next);
};

// override default remove -> removeFromIndex instead of destroy
ListResource.prototype.remove = function(req, res, next) {
  var data = this.listModel;
  var collection = this._constructCollection(req);
  collection
    .removeFromIndex(data)
    .done(function () {
      req.model = res.locals.resource = data;
      next();
    }, next);
};

ListResource.prototype.save = function (req, res, next) {
  next();
};


module.exports = ListResource;

