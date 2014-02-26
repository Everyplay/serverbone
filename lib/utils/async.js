var when = require('when');
var sequence = require('when/sequence');
var parallel = require('when/parallel');

// return a promise that resolves immediately
exports.emptyPromise = function(value) {
  return when.resolve(value);
};

// apply given when concurrency function, resolving with results from given index
function runAll(whenFn, fns, resolveIdx) {
  //var deferred = when.defer();
  return whenFn(fns)
    .then(
      function(results) {
        return results[resolveIdx];
      },
      function(err) {
        return when.reject(err);
      }
  );
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
  if (!options || !options.success) return exports.runInSequence(fns, resolveIdx);
  //var deferred = when.defer();
  return sequence(fns)
    .then(
      function(results) {
        var res = results[resolveIdx];
        if (options.success) {
          options.success.call(null, res);
        }
        return res;
      },
      function(err) {
        if (options.error) {
          options.error.call(null, ctx, err);
        }
        return err;
      }
  );
  //return deferred.promise;
};