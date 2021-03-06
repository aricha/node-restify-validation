/*
 * Copyright (c) 2013 Timo Behrmann. All rights reserved.
 */

var utils = require('./utils');
var _ = require('underscore');
var assert = require('assert');

var validators = module.exports._validators = require('./validators');
var validatorCodes = module.exports._validatorCodes = require('./validatorCodes');

var ignoredValidationKeys = module.exports._ignoredValidationKeys = ['msg', 'scope', 'description', 'swaggerType'];
var validatorChainStore = module.exports._validationChainStore = {};

module.exports._generateValidationChain = function (validationRules) {
    // Reduces the array of validators into a new array with objects
    // with a validation method to call, the value to validate against
    // and the specified error message, if any
    var validationChain = _.reduce(validationRules, function (memo, validationRule) {
        _.each(_.difference(_.keys(validationRule), ignoredValidationKeys), function (validator) {
            if (_.has(validators, validator)) {
                var error = {
                    name: validator,
                    fn: validators[validator],
                    value: validationRule[validator],
                    msg: validationRule.msg
                };

                memo.push(error);
            }
        });
        return memo;
    }, []);

    return validationChain;
};

module.exports.getValidatorChain = function (key, validationRules, validationModel, flattendParams, reqContext, options, recentErrors) {
    var routeName = utils.keypathValue(reqContext, 'route', 'name');
    var storeKey = routeName ? routeName + ':' + key : null;

    if (storeKey && _.has(validatorChainStore, storeKey)) {
        return validatorChainStore[storeKey];
    }

    // No array? Wrap it!
    if (!_.isArray(validationRules)) {
        validationRules = [validationRules];
    }

    var validationChain = this._generateValidationChain(validationRules);

    if (storeKey) {
        validatorChainStore[storeKey] = validationChain;
    }

    return validationChain;
};

module.exports.validateAttribute = function (key, validationRules, validationModel, flattendParams, reqContext, options, recentErrors) {
    var validatorChain = this.getValidatorChain(key, validationRules, validationModel, flattendParams, reqContext, options, recentErrors);
    var self = this;

    var submittedValue = flattendParams[key];
    var supportsMultipleValues = validationRules.multiple === true;
    var isArray = _.isArray(submittedValue);
    var doSingleCheck = !(isArray && supportsMultipleValues);

    var context = {
        req: reqContext,
        validationModel: validationModel,
        validationRules: validationRules,
        options: options,
        params: flattendParams,
        recentErrors: recentErrors
    };

    // process the validatorChain and reduce it to the first error
    return _.reduce(validatorChain, function (memo, validator) {
        var result;

        if (doSingleCheck) {
            result = validator.fn.call(context, key, submittedValue, validator);
        } else if (!doSingleCheck) {
            var invalidValue = _.find(submittedValue, function(currentValue) {
                return validator.fn.call(context, key, currentValue, validator);
            });

            if (!_.isUndefined(invalidValue)) {
                return true;
            }
        }

        if (result === false || memo === false) {
            return false;
        }

        if (result && !memo) {
            return self.createError(key, validator);
        }

        return memo;
    }, '');
};

module.exports.createError = function(key, validator) {
    var error = {
        field: key,
        code: validatorCodes.codes[validator.name] || validatorCodes.codes._default
    };

    var message = validator.msg || validatorCodes.messages[validator.name] || validatorCodes.messages._default;

    if (message) {
        error.message = message;
    }

    return error;
};

module.exports.process = function (validationModel, reqContext, options) {
    assert.ok(validationModel, 'No validationModel present');

    var errorsAsObject = options.errorsAsArray === false;
    var errors = errorsAsObject ? {} : [];
    function pushError(key, err) {
        if (errorsAsObject) {
            errors[key] = err;
        } else {
            errors.push(err);
        }
    }

    var self = this;

    var scope = reqContext.validationScope || 'params';
    var params = reqContext[scope] || {};
    if (typeof params !== 'object') {
        pushError('format', 'Invalid parameters in scope "' + scope + '"');
        return errors;
    }

    var flattendParams = utils.flatten(params);

    // fill missing fields with null
    _.each(validationModel, function (validationRules, key) {
        var error = self.validateAttribute(key, validationRules, validationModel, flattendParams, reqContext, options, errors);

        if (error) {
            pushError(key, error);
        }
    });

    return errors;
};