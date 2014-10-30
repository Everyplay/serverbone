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
      status: err.statusCode
    };
  } else {
    resp = err.toJSON();
  }
  res.status(err.statusCode).json(resp);
};