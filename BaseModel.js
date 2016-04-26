/**
 * Base model implementation for CouchDB with ES6 Classes
 * Created by howard on 30.09.15.
 */

"use strict";

var config = require('config'),
    coNano = require('../helpers/co_nano'),
    db = coNano.db.use('dom4'),
    _ = require('underscore'),
    co = require('co');

var _id = Symbol();

/**
 * model attributes {*}
 */
var _attributes = Symbol();

/**
 * model state flag boolean
 */
var _isNewModel = Symbol();

/**
 * model validators [{*}]
 */
var _attrValidators = Symbol();

var _unsafeAttributes = Symbol();

class BaseModel {
    constructor(attributes) {
        attributes = attributes || {};
        this.errors = {};
        this[_unsafeAttributes] = [];
        this[_attributes] = {};
        this[_isNewModel] = true;
        this[_attrValidators] = {};
        this.setDefaultValues();
        this.attributes = attributes;
        this.appendValidators();
        this.setUnsafeAttributes();
    }

    /**
     * Add validators to attributes
     */
    appendValidators() {
        if (this.rules().length) {
            this.rules().forEach(function (value) {
                if (_.isArray(value)) {
                    // якщо є масив атрибутів та об'єкт валідатора
                    if ([value][0] && _.isArray(value[0]) && [value][0][1]) {
                        var attributes = [value][0][0],
                            validatorParams = [value][0][1];

                        attributes.forEach(function (name) {
                            if (this.attributesList().indexOf(name) > -1) {
                                this.addValidator(name, validatorParams);
                            }
                        }.bind(this));
                    } else {
                        throw new Error('Model has wrong validator rule');
                    }
                } else {
                    throw new Error('Validators rules had to be an array of attributes array and validator object');
                }
            }.bind(this));
        }
    }

    /**
     * Set default values for attributes
     */
    setDefaultValues() {
        if (_.isObject(this.defaultValues())) {
            _.each(this.defaultValues(), function (value, key) {
                this.set(key, value);
            }.bind(this));
        }
    }

    /**
     * Returns attributes validators list
     * @returns {*}
     */
    get validators() {
        return this[_attrValidators];
    }

    /**
     * Returns attribute validators
     * @param field
     * @returns {*}
     */
    getValidator(field) {
        if (this[_attrValidators][field]) {
            return this[_attrValidators][field];
        }
    }

    /**
     * Add new attribute validator
     * @param field
     * @param validator
     */
    addValidator(field, validator) {
        if (this.attributesList().indexOf(field) > -1) {
            var validatorName = Object.keys(validator)[0] ? Object.keys(validator)[0] : null;
            if (validatorName) {
                // додаємо валідатори до атрибутів
                if (!this[_attrValidators][field]) {
                    this[_attrValidators][field] = {};
                }

                this[_attrValidators][field][validatorName] = validator;
            }
        }
    }

    /**
     * Removes attribute validator
     * @param field
     * @param [validatorName] if validator name is empty - all validators will be removed
     * @returns BaseModel
     */
    removeValidator(field, validatorName) {
        validatorName = validatorName || null;
        if (!_.isEmpty(this.validators) && this.validators[field]) {
            if (validatorName && this.validators[field][validatorName]) {
                delete this.validators[field][validatorName];
            } else {
                delete this.validators[field];
            }
        }

        return this;
    }

    /**
     * Default attributes values
     * @returns {*}
     */
    defaultValues() {
        return {};
    }

    /**
     * Set safe attribute value
     * @param name
     * @param value
     * @returns {*}
     * @param [isDynamic] boolean dynamic attribute
     */
    set(name, value, isDynamic) {
        isDynamic = isDynamic || false;
        if ((this.attributesList().indexOf(name) > -1 && this.isSafeAttribute(name)) || isDynamic) {
            return this[_attributes][name] = value;
        }
    }

    /**
     * Returns attribute value
     * @param name
     * @returns {*}
     */
    get(name) {
        if (this.attributesList().indexOf(name) > -1) {
            return this[_attributes][name];
        }
    }

    /**
     * Check if model is new or on update
     * @returns {*}
     */
    get isNewModel() {
        return this[_isNewModel];
    }

    /**
     * Validatoin rules
     * @returns {Array}
     */
    rules() {
        return [];
    }

    /**
     * Model filters. For now exists one filter: strip_tags - clears html-tags and replace \n to <br\>
     * @returns {{}}
     */
    filters() {
        return {};
    }

    /**
     * Returns attributes list
     * @returns {string[]}
     */
    attributesList() {
        return [];
    }

    /**
     * Unsafe attributes initialization
     */
    setUnsafeAttributes()
    {
        if(this.unsafeAttributesList().length) {
            _.each(this.unsafeAttributesList(), function(attr) {
                this[_unsafeAttributes].push(attr);
            }.bind(this))
        }
    }

    get unsafeAttributes() {
        return this[_unsafeAttributes];
    }

    /**
     * Add unsafe attributes
     * @param attribute
     */
    addUnsafeAttribute(attribute)
    {
        if(this.unsafeAttributesList().indexOf(attribute) == -1) {
            if(_.isString(attribute)) {
                this[_unsafeAttributes].push(attribute);
            } else if(_.isArray(attribute)) {
                this[_unsafeAttributes] = _.union(this[_unsafeAttributes], attribute);
            }
        }
    }

    /**
     * Unsafe attributes, which should not be saved on model update
     * @returns {Array}
     */
    unsafeAttributesList() {
        return [];
    }

    /**
     * Attributes initialization
     * @param attributes
     */
    set attributes(attributes) {
        this.attributesList().filter(function (name) {
            if (attributes && attributes[name] !== undefined) {
                this[_attributes][name] = attributes[name];
            }
        }.bind(this));
    }

    /**
     * Check if attribute is safe. Unsafe attributes should not be saved on update
     * @param attribute
     * @returns {boolean}
     */
    isSafeAttribute(attribute) {
        var isSafe = true;
        if (!this.isNewModel && this[_unsafeAttributes].length && _.indexOf(_unsafeAttributes, attribute) > -1) {
            isSafe = false;
        }

        return isSafe;
    }

    /**
     * Attribute filters
     */
    applyFilters() {
        if (Object.keys(this.filters()).length) {
            _.each(this.filters(), function (attributes, filterName) {
                _.each(attributes, function (name) {
                    var value = this.get(name);
                    if (value) {
                        if (filterName == 'strip_tags') {
                            this.set(name, value.replace(/<\/?[^>]+>/gi, '')
                                .replace(/(.*)?(\r\n|\n|\r)+(.*)?/g, '$1\n$3'));

                        }
                        if (filterName == 'numeric' && !isNaN(Number(value))) {
                            this.set(name, Number(value));
                        }
                    }
                }.bind(this));
            }.bind(this));
        }
    }

    /**
     * Returns model _id
     * @returns string
     */
    get id() {
        return this[_id];
    }

    /**
     * Returns attributes {attrName: value}
     * @returns {*}
     */
    get attributes() {
        return this[_attributes];
    }

    /**
     * Add an error for the class attribute
     * @param attribute
     * @param error
     */
    addError(attribute, error) {
        error = error || '';
        this.errors[attribute] = error;
    }

    /**
     * Returns current classname
     * @returns {*}
     */
    get className() {
        return this.constructor.name;
    }

    /**
     * Validate whole attribute by name
     * @param name
     * @param validatorParams
     */
    validateField(name, validatorParams) {
        var availableValidators = ['required', 'numeric', 'length'];
        if (!_.isEmpty(validatorParams)
            && Object.keys(validatorParams)[0]
            && availableValidators.indexOf(Object.keys(validatorParams)[0]) > -1
        ) {
            var validatorName = Object.keys(validatorParams)[0],
                value = this.attributes[name];
            switch (validatorName) {
                case 'required' :
                {
                    if (!value) {
                        this.addError(name, 'Field {name} is required'.replace('{name}', name));
                    }
                    break;
                }
                case 'numeric' :
                {
                    if (this.isNumeric(value)) {
                        if (!validatorParams.hasOwnProperty('allowFloat') && validatorParams.allowFloat && this.isFloat(value)) {
                            this.addError(name, 'Field {name} can be only float type'.replace('{name}', name));
                        }

                        if (validatorParams.hasOwnProperty('max') && value > validatorParams.max) {
                            this.addError(name, 'Field {name} value can not be greater than ' + validatorParams.max
                            + ''.replace('{name}', name));
                        }

                        if (validatorParams.hasOwnProperty('min') && value < validatorParams.min) {
                            this.addError(name, 'Field {name} value can not be less than ' + validatorParams.min
                            + ''.replace('{name}', name));
                        }
                    } else {
                        this.addError(name, 'Field {name} can be only numeric'.replace('{name}', name));
                    }

                    break;
                }
                case 'length' :
                {
                    if (validatorParams.hasOwnProperty('max') && value !== null && value.length > validatorParams.max) {
                        this.addError(name, 'Field {name} length can not be greater than ' + validatorParams.max
                        + ' symobls'.replace('{name}', name));
                    }

                    if (validatorParams.hasOwnProperty('min') && value !== null && value.length < validatorParams.min) {
                        this.addError(name, 'Field {name} length can not be less than ' + validatorParams.min
                        + ' symobls'.replace('{name}', name));
                    }
                    break;
                }
            }
        }
    }

    /**
     * Check value is numeric type
     * @param n
     * @returns {boolean}
     */
    isNumeric(n) {
        return !isNaN(parseFloat(n)) && isFinite(n);
    }

    /**
     * Check value is float type
     * @param n
     * @returns {boolean}
     */
    isFloat(n) {
        return n === Number(n) && n % 1 !== 0;
    }

    /**
     * Calls before model save. You must call super.beforeSave() in inherited class
     */
    beforeSave() {
        if (!this.isNewModel && this[_unsafeAttributes].length) {
            _.each(this[_unsafeAttributes], function (name) {
                this.removeValidator(name);
            }.bind(this));
        }
        this.applyFilters();
        this.set('_id', this.className.toLowerCase() + '-' + this.get('realty_id'));
    }

    /**
     * Validates model attributes
     * @returns {boolean}
     */
    validate() {
        if (!_.isEmpty(this.validators)) {
            _.each(this[_unsafeAttributes], function (name, val) {
                if (this.validators[name]) {
                    this.validateField(name, this.validators[name]);
                }
            }.bind(this));
        }

        return _.isEmpty(this.errors);
    }

    /**
     * Finds entity by id
     * @param id
     */
    * findById(id) {
        var attributes = {};
        try {
            attributes = yield db.get(id);
        } catch (err) {
            console.log('err', err);
        }

        if (attributes[0]) {
            this.attributes = attributes[0];
            this[_isNewModel] = false;
        } else {
            this.attributes = null;
        }

        return this;
    }

    /**
     * Saves model into CouchDB
     * @param validate
     */
    * save(validate) {
        validate = validate || true;
        var resp = false;
        this.beforeSave();
        if (validate) {
            if (this.validate()) {
                try {
                    resp = yield db.insert(this.attributes);
                } catch (e) {
                    this.addError('couch', e);
                }
                return resp;
            }
        } else {
            return yield db.insert(this.attributes);
        }
    }
}

module.exports = BaseModel;
