var env = process.env.NODE_ENV || 'development';

var sendError = exports.sendError = function(req, res, err) {
  var resp;
  if (!err.statusCode) err.statusCode = err.status || 500;

  if (err.statusCode >= 500) {
    if(env !== 'test') console.error(err.stack || err.toString());
    if(env === 'production') err.message = 'Internal Server Error';
  }

  res.writeHead(err.statusCode, { 'Content-Type': 'application/json' });

  resp = JSON.stringify({
    message: err.message,
    status: 'error'
  });

  res.end(req.method ===  'HEAD' ? null : resp);
};

exports.sendJson = function(req, res) {
  if (!res.locals.resource) res.locals.resource = req.model;
  if (!res.locals.resource) {
    console.error('no resource found!');
    return sendError(req, res, new Error('Resource not found'));
  }
  var json = res.locals.resource.toJSON();
  return res.json(json);
};


