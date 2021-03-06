/*
 * Copyright (c) 2013 Timo Behrmann. All rights reserved.
 */

var _ = require('underscore');

module.exports.utils = require('./utils');
module.exports.validation = require('./validation');
module.exports.error = require('./error');
module.exports.when = require('./conditions');

var defaultOptions = {
    errorsAsArray: true
};
var validationModelScopes = {
    bodyValidation: 'body',
    validation: 'params'
};

module.exports.validationPlugin = function (options) {
    options = _.extend(defaultOptions, options);
    var self = this;

    return function (req, res, next) {
        var route = req.route;
        if (!route) {
            return next();
        }

        var reqContext = _.pick(req, 'body', 'params', 'route');

        // Look for validators for each scope
        for (var modelKey in validationModelScopes) {
            var validationModel = reqContext.route[modelKey];
            if (validationModel) {
                var scope = validationModelScopes[modelKey];
                reqContext.validationScope = scope;

                // Validate
                var errors = self.validation.process(validationModel, reqContext, options);

                if (errors && (options.errorsAsArray && errors.length > 0) || (!options.errorsAsArray && _.keys(errors).length > 0)) {
                    var errorHandler = options.errorHandler || self.error.handle;
                    return errorHandler(errors, scope, req, res, options, next);
                }
            }
        }

        next();
    };
};