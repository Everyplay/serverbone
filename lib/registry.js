/**
 * Internal storage for models
 */
var LRU = require('lru-cache');

function _cacheKey(type, id) {
  return type + ':' + id;
}

function _modelKey(model) {
  return _cacheKey(model.type, model.id);
}

var Registry = function () {
  var cacheOptions = {
    max: 500
  };

  this._cache = LRU(cacheOptions);
};

Registry.prototype.get = function(type, id) {
  return this._cache.get(_cacheKey(type, id));
};

// Add a model to the cache if it has not already been set
Registry.prototype.set = function (model) {
  return this._cache.set(_modelKey(model), model);
};

Registry.prototype.del = function (type, id) {
  return this._cache.del(_cacheKey(type, id));
};

Registry.prototype.clear = function () {
  this._cache.reset();
};

module.exports = Registry;