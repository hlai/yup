const DEBUG=false;
import mapValues from 'lodash/mapValues';
import ValidationError from '../ValidationError';
import Ref from '../Reference';
import {
  ValidateOptions,
  Message,
  InternalOptions,
  Callback,
  ExtraParams,
} from '../types';
import Reference from '../Reference';
import type { AnySchema } from '../schema';

export type CreateErrorOptions = {
  path?: string;
  message?: Message<any>;
  params?: ExtraParams;
  type?: string;
};

export type TestContext<TContext = {}> = {
  path: string;
  options: ValidateOptions<TContext>;
  parent: any;
  schema: any; // TODO: Schema<any>;
  resolve: <T>(value: T | Reference<T>) => T;
  createError: (params?: CreateErrorOptions) => ValidationError;
};

export type TestFunctionWas<T = unknown, TContext = {}> = (
  this: TestContext<TContext>,
  value: T,
  context: TestContext<TContext>,
) => boolean | ValidationError | Promise<boolean | ValidationError>;

export type TestFunction<T = unknown, TContext = {}> = TestFunctionWas<T, TContext> & { async?: boolean };

export type TestOptions<TSchema extends AnySchema = AnySchema> = {
  value: any;
  path?: string;
  label?: string;
  options: InternalOptions;
  originalValue: any;
  schema: TSchema;
  sync?: boolean;
};

export type TestConfig<TValue = unknown, TContext = {}> = {
  name?: string;
  message?: Message<any>;
  test: TestFunction<TValue, TContext>;
  params?: ExtraParams;
  exclusive?: boolean;
};

export type Test = ((opts: TestOptions, cb: Callback) => void) & {
  OPTIONS: TestConfig;
};

export default function createValidation(config: {
  name?: string;
  test: TestFunction;
  params?: ExtraParams;
  message?: Message<any>;
}) {
  function validate<TSchema extends AnySchema = AnySchema>(
    {
      value,
      path = '',
      label,
      options,
      originalValue,
      sync,
      ...rest
    }: TestOptions<TSchema>,
    cb: Callback,
  ) {
    const { name, test, params, message } = config;
    let { parent, context } = options;

    DEBUG && console.log(`validate,`, name);

    function resolve<T>(item: T | Reference<T>) {
      return Ref.isRef(item) ? item.getValue(value, parent, context) : item;
    }

    function createError(overrides: CreateErrorOptions = {}) {
      const nextParams = mapValues(
        {
          value,
          originalValue,
          label,
          path: overrides.path || path,
          ...params,
          ...overrides.params,
        },
        resolve,
      );

      const error = new ValidationError(
        ValidationError.formatError(overrides.message || message, nextParams),
        value,
        nextParams.path,
        overrides.type || name,
      );
      error.params = nextParams;
      return error;
    }

    let ctx = {
      path,
      parent,
      type: name,
      createError,
      resolve,
      options,
      originalValue,
      ...rest,
    };

    DEBUG && console.log(`validation func : test: ${name}  async: ${test.async}`);

    let result;
    if (test.async) {
        try {
            result = test.call(ctx, value, ctx);
            if (result instanceof Promise ) {
                result.then((validOrError) => {
                    if (ValidationError.isError(validOrError)) cb(validOrError);
                    else if (!validOrError) cb(createError());
                    else cb(null, validOrError);
                }).catch((err) => {
                  DEBUG && console.log(`in createValidation : caught test error`, err);
                    cb(err);
                });
                return result;
            } else {
                throw new Error("Async function did not return a Promise!")
            }
        } catch (err) {
            cb(err);
        }
        return;
    }

    try {
      result = test.call(ctx, value, ctx);

      if (typeof (result as any)?.then === 'function') {
        throw new Error(
          `Validation test of type: "${ctx.type}" returned a Promise during a synchronous validate. ` +
            `This test will finish after the validate call has returned`,
        );
      }
    } catch (err) {
      cb(err);
      return;
    }

    if (ValidationError.isError(result)) cb(result);
    else if (!result) cb(createError());
    else cb(null, result);
  }

  validate.OPTIONS = config;

  return validate;
}
