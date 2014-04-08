var env = process.env.NODE_ENV || 'development';

var sendError = exports.sendError = function(req, res, err) {
  var resp;
  if (!err.statusCode) err.statusCode = err.status || 500;

  if (err.statusCode >= 500) {
    if (env.indexOf('test') === -1) console.error(err.stack || err.toString());
    if (env === 'production') err.message = 'Internal Server Error';
  }

  if (!err.toJSON) {
    resp = {
      error: 'error',
      error_description: err.message,
      status: this.statusCode
    };
  } else {
    resp = err.toJSON();
  }

  res.json(err.statusCode, resp);
};

exports.sendJson = function(req, res) {
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
    return sendError(req, res, new Error('Resource not found'));
  }

  var projectionOptions = res.locals.resource.defaultProjectionOptions
    ? res.locals.resource.defaultProjectionOptions()
    : null;

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

  var json = res.locals.resource.toJSON(projectionOptions);
  return res.json(json);
};