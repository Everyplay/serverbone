var when = require('when');
var sequence = require('when/sequence');
var parallel = require('when/parallel');

// return a promise that resolves immediately
exports.emptyPromise = function() {
  var deferred = when.defer();
  deferred.resolve();
  var promise = deferred.promise;
  return promise;
};

// apply given when concurrency function, resolving with results from given index
function runAll(whenFn, fns, resolveIdx) {
  var deferred = when.defer();
  whenFn(fns)
    .then(
      function(results) {
        deferred.resolve(results[resolveIdx]);
      },
      function(err) {
        deferred.reject(err);
      }
    );
  return deferred.promise;
}

// run fns in sequence resolving with results from given index
exports.runInSequence = function(fns, resolveIdx) {
  return runAll(sequence, fns, resolveIdx);
};

exports.runParallel = function(fns, resolveIdx) {
  return runAll(parallel, fns, resolveIdx);
};

// handle calling sequence with backbone style (wrapped) options
exports.wrapToSequence = function(fns, resolveIdx, options, ctx) {
  if(!options || !options.success) return exports.runInSequence(fns, resolveIdx);
  var deferred = when.defer();
  sequence(fns)
    .then(
      function(results) {
        var res = results[resolveIdx];
        if(options.success) {
          options.success.apply(null, res);
        }
      },
      function(err) {
        if(options.error) {
          options.error.call(null, ctx, err);
        }
      }
    );
  return deferred.promise;
};