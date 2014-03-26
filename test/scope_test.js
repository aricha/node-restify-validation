/*
 * Copyright (c) 2013 Timo Behrmann. All rights reserved.
 */

var assert = require('assert');
var should = require('should');
var sinon = require('sinon');
var index = require('../lib/index');

var res_empty = {};
res_empty.send = function() {};

var validationPlugin = index.validationPlugin();

function onValidationError(fn, onError) {
    var handleErrors = sinon.stub(index.error, 'handle', function(errors, req, res, options, next) {
        handleErrors.restore();
        onError();
    });
    fn();
    handleErrors.restore();
}
function validateAssertingError(req, res, onError) {
    onValidationError(function() {
        validationPlugin(req, res, function() {
            assert(false, 'should have thrown an error');
        });
    }, onError);
}
function validateAssertingSuccess(req, res, onSuccess) {
    onValidationError(function() {
        validationPlugin(req, res, onSuccess);
    }, function() {
        assert(false, 'should have succeeded');
    });
}

describe('Scope test', function () {
    it('Handle parameter validation', function (done) {
        var req = { route: { validation: { foo: { isRequired: true } } } };
        validateAssertingError(req, res_empty, function() {
            req.params = { foo: 'asdf' };
            validateAssertingSuccess(req, res_empty, function() {
                done();
            });
        });
    });
    it('Handle body validation', function (done) {
        var req = { route: { bodyValidation: { foo: { isRequired: true } } } };
        validateAssertingError(req, res_empty, function() {
            req.body = { foo: 'asdf' };
            validateAssertingSuccess(req, res_empty, function() {
                done();
            });
        });
    });
});
