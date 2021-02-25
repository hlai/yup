const DEBUG = false;
import ValidationError from '../ValidationError';

const once = cb => {
  let fired = false;
  return (...args) => {
    if (fired) return;
    fired = true;
    cb(...args);
  };
};

export default function runTests(options, cb) {
  let {
    endEarly,
    tests,
    args,
    value,
    errors,
    sort,
    path
  } = options;
  let callback = once(cb);
  let count = tests.length;
  const nestedErrors = [];
  errors = errors ? errors : [];
  if (!count) return errors.length ? callback(new ValidationError(errors, value, path)) : callback(null, value);
  let moreTests = true;

  function doTest(i) {
    const test = tests[i];
    DEBUG && console.log(`runTests : test:${i + 1} of ${tests.length}`);
    let maybePromise = test(args, function finishTestRun(err) {
      DEBUG && console.log(`finishTestRun : test:${i + 1} of ${tests.length} endEarly:${endEarly}`);

      if (err) {
        // always return early for non validation errors
        if (!ValidationError.isError(err)) {
          moreTests = false;
          return callback(err, value);
        }

        if (endEarly) {
          err.value = value;
          moreTests = false;
          return callback(err, value);
        }

        nestedErrors.push(err);
      }

      if (--count <= 0) {
        if (nestedErrors.length) {
          if (sort) nestedErrors.sort(sort); //show parent errors after the nested ones: name.first, name

          if (errors && errors.length) nestedErrors.push(...errors);
          errors = nestedErrors;
        }

        if (errors && errors.length) {
          callback(new ValidationError(errors, value, path), value);
          return;
        }

        callback(null, value);
      }
    });

    if (!moreTests) {
      return;
    }

    if (maybePromise && maybePromise.then) {
      maybePromise.then(() => {
        if (moreTests && ++i < tests.length) {
          doTest(i);
        }
      }).catch(err => {
        moreTests = false;
        cb(err);
      });
    } else {
      if (++i < tests.length) {
        doTest(i);
      }
    }
  }

  doTest(0);
}