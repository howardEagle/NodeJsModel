/**
 * Реалізація базового класу моделі для CouchDB на ES6 Classes
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
 * атрибути моделі {*}
 */
var _attributes = Symbol();

/**
 * флаг стану моделі boolean
 */
var _isNewModel = Symbol();

/**
 * валідатори моделі [{*}]
 */
var _attrValidators = Symbol();

var _unsafeAttributes = Symbol();

class BaseModel {
    constructor(attributes) { //class constructor
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
     * Додає валідатори до атрибутів
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
                        throw new Error('В моделі є неправильне правило валідації');
                    }
                } else {
                    throw new Error('Правила валідації мають містити масив масивів атрибутів моделі та об\'єкту валідатора');
                }
            }.bind(this));
        }
    }

    /**
     * Встановлює значення за замовчуванням
     */
    setDefaultValues() {
        if (_.isObject(this.defaultValues())) {
            _.each(this.defaultValues(), function (value, key) {
                this.set(key, value);
            }.bind(this));
        }
    }

    /**
     * Повертає список валідаторів атрибутів
     * @returns {*}
     */
    get validators() {
        return this[_attrValidators];
    }

    /**
     * Повертає валідатори атрибуту
     * @param field
     * @returns {*}
     */
    getValidator(field) {
        if (this[_attrValidators][field]) {
            return this[_attrValidators][field];
        }
    }

    /**
     * Додає новий валідатор до атрибуту
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
     * Видаляє валідатор атрибуту моделі
     * @param field
     * @param [validatorName] якщо не вказане ім'я валідатора, будуть видалені всі валідатори атрибуту
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
     * Значення атрибутів за замовчуванням
     * @returns {*}
     */
    defaultValues() {
        return {};
    }

    /**
     * Встановлює занчення атрибуту моделі, якщо атрибут є безпечним
     * @param name
     * @param value
     * @returns {*}
     * @param [isDynamic] boolean динамічний атрибут
     */
    set(name, value, isDynamic) {
        isDynamic = isDynamic || false;
        if ((this.attributesList().indexOf(name) > -1 && this.isSafeAttribute(name)) || isDynamic) {
            return this[_attributes][name] = value;
        }
    }

    /**
     * Повертає значення атрибуту, якщо воно присутнє у списку атрибутів
     * @param name
     * @returns {*}
     */
    get(name) {
        if (this.attributesList().indexOf(name) > -1) {
            return this[_attributes][name];
        }
    }

    /**
     * Повертає флаг чи модель нова, чи редагується
     * @returns {*}
     */
    get isNewModel() {
        return this[_isNewModel];
    }

    /**
     * Правила валідації
     * @returns {Array}
     */
    rules() {
        return [];
    }

    /**
     * Фільтри моделі. Доступні: strip_tags - чистить html-теги та заміняє переноси рядка на <br\>
     * @returns {{}}
     */
    filters() {
        return {};
    }

    /**
     * Список атрбутів
     * @returns {string[]}
     */
    attributesList() {
        return [];
    }

    /**
     * Ініціалізація небезпечних атрибутів
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
     * Додає новий небезпечний атрибут
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
     * Небезпечні атрибути, які не повинні змінюватись під час редагування моделі
     * @returns {Array}
     */
    unsafeAttributesList() {
        return [];
    }

    /**
     * Ініціалізація властивостей. Якщо властивість є у моделі списку, вона буде проініціалізована.
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
     * Перевіряє чи атрибут є безпечним. Небезпечні атрибути не повинні бути збережені при редагуванні
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
     * Приміняє фільтри до моделі
     */
    applyFilters() {
        if (Object.keys(this.filters()).length) {
            _.each(this.filters(), function (attributes, filterName) {
                _.each(attributes, function (name) {
                    var value = this.get(name);
                    if (value) {
                        if (filterName == 'strip_tags') {
                            this.set(name, value.replace(/<\/?[^>]+>/gi, '')
                                .replace(/(.*)?(\r\n|\n|\r)+(.*)?/g, '$1\n$3')); // заміна декількох перенесень рядків на одинарне;

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
     * Повертає _id моделі
     * @returns string
     */
    get id() {
        return this[_id];
    }

    /**
     * Повертає значення атрибутів {attrName: value}
     * @returns {*}
     */
    get attributes() {
        return this[_attributes];
    }

    /**
     * Додає помилку до відповідного атрибуту моделі
     * @param attribute
     * @param error
     */
    addError(attribute, error) {
        error = error || '';
        this.errors[attribute] = error;
    }

    /**
     * Повертає імя поточного класу
     * @returns {*}
     */
    get className() {
        return this.constructor.name;
    }

    /**
     * Виконує валідацію поля відповідно до заданого правила
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
                        this.addError(name, 'Поле {name} не може бути пустим'.replace('{name}', name));
                    }
                    break;
                }
                case 'numeric' :
                {
                    if (this.isNumeric(value)) {
                        if (!validatorParams.hasOwnProperty('allowFloat') && validatorParams.allowFloat && this.isFloat(value)) {
                            this.addError(name, 'Поле {name} повинно містити тільки цілі числа'.replace('{name}', name));
                        }

                        if (validatorParams.hasOwnProperty('max') && value > validatorParams.max) {
                            this.addError(name, 'Значення поля {name} не повинно бути більше ніж ' + validatorParams.max
                            + ''.replace('{name}', name));
                        }

                        if (validatorParams.hasOwnProperty('min') && value < validatorParams.min) {
                            this.addError(name, 'Значення поля {name} не повинно бути менше ніж ' + validatorParams.min
                            + ''.replace('{name}', name));
                        }
                    } else {
                        this.addError(name, 'Поле {name} повинно містити тільки числа'.replace('{name}', name));
                    }

                    break;
                }
                case 'length' :
                {
                    if (validatorParams.hasOwnProperty('max') && value !== null && value.length > validatorParams.max) {
                        this.addError(name, 'Значення поля {name} не повинно містити більше ніж ' + validatorParams.max
                        + ' символів'.replace('{name}', name));
                    }

                    if (validatorParams.hasOwnProperty('min') && value !== null && value.length < validatorParams.min) {
                        this.addError(name, 'Значення поля {name} не повинно містити менше ніж ' + validatorParams.min
                        + ' символів'.replace('{name}', name));
                    }
                    break;
                }
            }
        }
    }

    /**
     * Перевірка на число
     * @param n
     * @returns {boolean}
     */
    isNumeric(n) {
        return !isNaN(parseFloat(n)) && isFinite(n);
    }

    /**
     * Перевіряє чи значення з плаваючою крапкою
     * @param n
     * @returns {boolean}
     */
    isFloat(n) {
        return n === Number(n) && n % 1 !== 0;
    }

    /**
     * Виконується перед збереженням моделі. Якщо реалізований в класі-нащадку, повинен викликати super.beforeSave()
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
     * Виконує валідацію атрибутів моделі
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
     * Знаходить оголошення та популює модель по id
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
     * Зберігає модель в CouchDB
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