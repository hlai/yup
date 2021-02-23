import ValidationError from '../ValidationError';
import { TestOptions } from './createValidation';
import { Callback } from '../types';

export type RunTest = (opts: TestOptions, cb: Callback) => void;

export type TestRunOptions = {
  endEarly?: boolean;
  tests: RunTest[];
  args?: TestOptions;
  errors?: ValidationError[];
  sort?: (a: ValidationError, b: ValidationError) => number;
  path?: string;
  value: any;
  sync?: boolean;
};

const once = <T extends (...args: any[]) => any>(cb: T) => {
  let fired = false;
  return (...args: Parameters<T>) => {
    if (fired) return;
    fired = true;
    cb(...args);
  };
};

export default async function runTests(options: TestRunOptions, cb: Callback): Promise<void> {
  let { endEarly, tests, args, value, errors, sort, path } = options;

  let callback = once(cb);
  let count = tests.length;
  const nestedErrors = [] as ValidationError[];
  errors = errors ? errors : [];

  if (!count)
    return errors.length
      ? callback(new ValidationError(errors, value, path))
      : callback(null, value);

  let stopMoreTest = false;
  for (let i = 0; i < tests.length; i++) {
    if (stopMoreTest) break;
    const test = tests[i];

    console.log(`runTests : test:${i + 1} of ${tests.length}`);
    // debugger
    const maybePromise: any = test(args!, function finishTestRun(err) {
      console.log(`finishTestRun : test:${i + 1} of ${tests.length} endEarly:${endEarly}`);
      if (err) {
        // always return early for non validation errors
        if (!ValidationError.isError(err)) {
          return callback(err, value);
        }
        if (endEarly) {
          err.value = value;
          stopMoreTest = true;
          return callback(err, value);
        }
        nestedErrors.push(err);
      }

      if (--count <= 0) {
        if (nestedErrors.length) {
          if (sort) nestedErrors.sort(sort);

          //show parent errors after the nested ones: name.first, name
          if (errors!.length) nestedErrors.push(...errors!);
          errors = nestedErrors;
        }

        if (errors!.length) {
          callback(new ValidationError(errors!, value, path), value);
          return;
        }

        callback(null, value);
      }
    });

    debugger
    if (maybePromise && maybePromise.then) {
      try {
        await maybePromise;
      } catch (err) {
        cb(err)
      }
    }
  }
}
