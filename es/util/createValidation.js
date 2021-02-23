function _extends() { _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }

function _objectWithoutPropertiesLoose(source, excluded) { if (source == null) return {}; var target = {}; var sourceKeys = Object.keys(source); var key, i; for (i = 0; i < sourceKeys.length; i++) { key = sourceKeys[i]; if (excluded.indexOf(key) >= 0) continue; target[key] = source[key]; } return target; }

import mapValues from 'lodash/mapValues';
import ValidationError from '../ValidationError';
import Ref from '../Reference';
export default function createValidation(config) {
  function validate(_ref, cb) {
    let {
      value,
      path = '',
      label,
      options,
      originalValue
    } = _ref,
        rest = _objectWithoutPropertiesLoose(_ref, ["value", "path", "label", "options", "originalValue", "sync"]);

    const {
      name,
      test,
      params,
      message
    } = config;
    let {
      parent,
      context
    } = options;
    console.log(`validate,`, name);

    function resolve(item) {
      return Ref.isRef(item) ? item.getValue(value, parent, context) : item;
    }

    function createError(overrides = {}) {
      const nextParams = mapValues(_extends({
        value,
        originalValue,
        label,
        path: overrides.path || path
      }, params, overrides.params), resolve);
      const error = new ValidationError(ValidationError.formatError(overrides.message || message, nextParams), value, nextParams.path, overrides.type || name);
      error.params = nextParams;
      return error;
    }

    let ctx = _extends({
      path,
      parent,
      type: name,
      createError,
      resolve,
      options,
      originalValue
    }, rest);

    console.log(`validation func : test: ${name}  async: ${test.async}`);
    let result;

    if (test.async) {
      try {
        result = test.call(ctx, value, ctx);

        if (result instanceof Promise) {
          result.then(validOrError => {
            if (ValidationError.isError(validOrError)) cb(validOrError);else if (!validOrError) cb(createError());else cb(null, validOrError);
          }).catch(err => {
            console.log(`in createValidation : caught test error`, err);
            cb(err);
          });
          return result;
        } else {
          throw new Error("Async function did not return a Promise!");
        }
      } catch (err) {
        cb(err);
      }

      return;
    }

    try {
      var _result;

      result = test.call(ctx, value, ctx);

      if (typeof ((_result = result) == null ? void 0 : _result.then) === 'function') {
        throw new Error(`Validation test of type: "${ctx.type}" returned a Promise during a synchronous validate. ` + `This test will finish after the validate call has returned`);
      }
    } catch (err) {
      cb(err);
      return;
    }

    if (ValidationError.isError(result)) cb(result);else if (!result) cb(createError());else cb(null, result);
  }

  validate.OPTIONS = config;
  return validate;
}