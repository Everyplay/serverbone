/**
 * Resource class for list style resources,
 * thus collection is IndexMixin based
 */

var util = require('util');
var Resource = require('./resource');

var ListResource = function(name, options, app) {
  Resource.call(this, name, options, app);
};
util.inherits(ListResource, Resource);

ListResource.prototype.create = function(req, res, next) {
  throw new Error('create is not implemented');
};

// override default update -> addToIndex instead of update
ListResource.prototype.update = function(req, res, next) {
  var data = req.model;
  var collection = new this.CollectionClass(null, {actor: req.actor || req.accessToken});
  collection
    .addToIndex(req.model)
    .done(function () {
      next();
    }, next);
};

// override default remove -> removeFromIndex instead of destroy
ListResource.prototype.remove = function(req, res, next) {
  var collection = new this.CollectionClass(null, {actor: req.actor || req.accessToken});
  collection
    .removeFromIndex(req.model)
    .done(function () {
      next();
    }, next);
};


module.exports = ListResource;

