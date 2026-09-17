/*!
 * qpx - qpForm
 * Formulář, funkčností co nejblíže Webix Form: deklarativní strom
 * "elements" (řádky/sloupce/fieldset/samotná pole), popisky (label)
 * s konfigurovatelnou šířkou/pozicí, validace přes "rules" (funkce/
 * regex/pole pravidel/{check,message}), getValues()/setValues()/
 * clear(), markInvalid()/clearValidation().
 *
 * Na rozdíl od Webixu (který renderuje jen <div class="webix_form">)
 * qpForm ZÁROVEŇ zastupuje skutečný HTML <form> element — kořenový
 * kontejner widgetu je opravdový <form>, na který lze nastavit běžné
 * HTML atributy (action, method, enctype, target, name, autocomplete,
 * novalidate...) přes options.formAttributes. Díky tomu se dá formulář
 * i nativně odeslat (submit), participovat na prohlížečovém autofillu
 * atd. — ne jen sloužit jako vizuální layout.
 *
 * Pole (elements) mohou být libovolné registrované qpx widgety
 * (qpTextBox, qpNumberBox, qpCheckBox, qpSwitch, qpSelectBox,
 * qpDatePicker, qpColorPicker, ...) — qpForm sám žádné vlastní
 * vstupy nevytváří, jen je skládá do řádků s popiskem a validací.
 *
 * options:
 *   elements ([...]), rules ({field: pravidlo|[pravidla]}),
 *   labelWidth, labelPosition ("left"|"top"), gap, colGap,
 *   formAttributes ({action, method, enctype, target, name,
 *                    autocomplete, novalidate, ...}),
 *   readOnly, disabled, visible
 *
 * events:
 *   onInitialized, onContentReady, onChange, onSubmit, onValidated,
 *   onOptionChanged, onDisposing
 *
 * methods:
 *   option(name[, value]), getValues(), setValues(obj[, silent]),
 *   clear(), reset() — alias clear(),
 *   validate([name]), isValid([name]), markInvalid(name, message),
 *   clearValidation([name]), getField(name), focus(name), submit(),
 *   enable(), disable(), destroy()
 *
 * elements — položka stromu:
 *   { view:"qpTextBox", name:"email", label:"E-mail", required:true, ... }
 *   { view:"fieldset", label:"Adresa", elements:[...] }
 *   { rows:[...] } / { cols:[...] }                 -- vnořené rozložení
 *   { view:"template", template:"<hr>" }             -- oddělovač
 *   { view:"spacer", height:10 }                     -- mezera
 *   { view:"button", text:"Odeslat", onClick:... }    -- bez popisku
 */
(function (qpx, $) {
    "use strict";

    var NO_LABEL_VIEWS = { button: 1, template: 1, spacer: 1 };

    // předpřipravená validační pravidla — vrací true/false
    qpx.formRules = {
        required: function (v) { return v !== null && v !== undefined && String(v).trim() !== ""; },
        email: function (v) { return !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); },
        number: function (v) { return v === null || v === undefined || v === "" || !isNaN(Number(v)); },
        minLength: function (n) { return function (v) { return !v || String(v).length >= n; }; },
        maxLength: function (n) { return function (v) { return !v || String(v).length <= n; }; },
        pattern: function (re) { return function (v) { return !v || re.test(v); }; },
        range: function (min, max) {
            return function (v) {
                if (v === null || v === undefined || v === "") { return true; }
                var n = Number(v);
                return n >= min && n <= max;
            };
        }
    };

    function evalRule(rule, value, values) {
        if (typeof rule === "function") {
            var res = rule(value, values);
            return (typeof res === "boolean") ? { valid: res } : res;
        }
        if (rule instanceof RegExp) { return { valid: rule.test(value == null ? "" : String(value)) }; }
        if (qpx.isObject(rule) && qpx.isFunction(rule.check)) {
            return { valid: !!rule.check(value, values), message: rule.message };
        }
        return { valid: true };
    }

    var Form = qpx.Widget.extend({

        defaults: {
            elements: [],
            rules: {},

            labelWidth: 140,
            labelPosition: "left", // left | top
            gap: 10,
            colGap: 16,

            formAttributes: { novalidate: true }, // -> atributy skutečného <form> elementu

            readOnly: false,
            disabled: false,
            visible: true,

            onChange: null,
            onSubmit: null,
            onValidated: null,
            onInitialized: null,
            onContentReady: null,
            onOptionChanged: null,
            onDisposing: null
        },

        // ---------------------------------------------------------------
        render: function () {
            var cfg = this.config;
            var self = this;

            // Base Widget.init() vytvořil this.$container jako <div> (nebo
            // převzal libovolný předaný element). qpForm ale MÁ zastupovat
            // skutečný <form>, takže div nahradíme <form> elementem se
            // zachováním toho, co do něj init() už stihl nastavit (id,
            // třídy, inline width/height styl, data-qpx-id).
            var $old = this.$container;
            var $form = $("<form></form>");
            $.each($old[0].attributes, function () { $form.attr(this.name, this.value); });
            $old.replaceWith($form);
            $form.data("qpx-widget", this);
            this.$container = $form;

            this.$container
                .addClass("qpx-form")
                .toggleClass("qpx-hidden", !cfg.visible)
                .toggleClass("qpx-state-disabled", !!cfg.disabled)
                .toggleClass("qpx-state-readonly", !!cfg.readOnly);

            if (cfg.onChange) { this.on("change", cfg.onChange); }
            if (cfg.onSubmit) { this.on("submit", cfg.onSubmit); }
            if (cfg.onValidated) { this.on("validated", cfg.onValidated); }
            if (cfg.onOptionChanged) { this.on("optionChanged", cfg.onOptionChanged); }
            if (cfg.onInitialized) { this.on("ready", cfg.onInitialized); }
            if (cfg.onContentReady) { this.on("contentReady", cfg.onContentReady); }
            if (cfg.onDisposing) { this.on("destroy", cfg.onDisposing); }

            this._fields = {};        // name -> widget instance
            this._elementDefs = {};   // name -> původní definice (label, required, ...)
            this._rows = {};          // name -> $row (kvůli invalid stavu)
            this._widgetInstances = []; // úplně všechny vnořené qpx widgety (i bez name) — kvůli destroy()
            this._suppressChange = false;

            this._applyFormAttributes(cfg.formAttributes || {});
            this._bindSubmit();
            this._renderForm();

            setTimeout(function () { self.trigger("contentReady", { component: self }); }, 0);
        },

        _bindSubmit: function () {
            var self = this;
            this.$container.on("submit.qpxForm", function (e) {
                e.preventDefault();
                self._handleSubmit();
            });
        },

        _handleSubmit: function () {
            var isValid = this.validate();
            this.trigger("submit", { values: this.getValues(), isValid: isValid, component: this });
        },

        // ---------------------------------------------------------------
        // HTML atributy skutečného <form> elementu
        // ---------------------------------------------------------------
        _applyFormAttributes: function (attrs) {
            var $f = this.$container;
            $.each(attrs || {}, function (name, value) {
                if (value === false || value === null || value === undefined) {
                    $f.removeAttr(name);
                } else if (value === true) {
                    $f.attr(name, name); // boolean atribut, např. novalidate="novalidate"
                } else {
                    $f.attr(name, value);
                }
            });
        },

        // ---------------------------------------------------------------
        // Vykreslení stromu elements (plné znovu-vykreslení)
        // ---------------------------------------------------------------
        _renderForm: function () {
            var cfg = this.config;
            this._destroyFields();
            this.$container.empty();
            this._fields = {};
            this._elementDefs = {};
            this._rows = {};
            this._widgetInstances = [];

            var $root = $("<div class='qpx-form-rows'></div>").css("gap", qpx.toPx(cfg.gap));
            this.$container.append($root);

            (cfg.elements || []).forEach(function (def) {
                this._renderElement(def, $root);
            }, this);
        },

        _destroyFields: function () {
            (this._widgetInstances || []).forEach(function (inst) {
                try { inst.destroy(); } catch (e) { /* noop */ }
            });
            this._widgetInstances = [];
        },

        // ---------------------------------------------------------------
        // Dispatch podle typu položky stromu
        // ---------------------------------------------------------------
        _renderElement: function (def, $parent) {
            if (!def) { return; }

            if (def.rows || def.view === "rows") { return this._renderGroup(def, $parent, "rows"); }
            if (def.cols || def.view === "cols") { return this._renderGroup(def, $parent, "cols"); }
            if (def.view === "fieldset") { return this._renderFieldset(def, $parent); }
            if (def.view === "template") { return this._renderTemplate(def, $parent); }
            if (def.view === "spacer") { return this._renderSpacer(def, $parent); }
            if (NO_LABEL_VIEWS[def.view]) { return this._renderPlain(def, $parent); }

            return this._renderField(def, $parent);
        },

        _renderGroup: function (def, $parent, kind) {
            var self = this;
            var cfg = this.config;
            var items = def.rows || def.cols || [];
            var $group = $("<div></div>")
                .addClass(kind === "cols" ? "qpx-form-cols" : "qpx-form-rows")
                .css("gap", qpx.toPx(kind === "cols" ? cfg.colGap : cfg.gap));

            if (def.width) { $group.css("width", qpx.toPx(def.width)); }
            if (def.css) { $group.addClass(def.css); }

            items.forEach(function (childDef) {
                if (kind === "cols") {
                    var $col = $("<div class='qpx-form-col'></div>");
                    if (childDef.width) { $col.css("flex", "0 0 " + qpx.toPx(childDef.width)); }
                    $group.append($col);
                    self._renderElement(childDef, $col);
                } else {
                    self._renderElement(childDef, $group);
                }
            });

            $parent.append($group);
        },

        _renderFieldset: function (def, $parent) {
            var $fieldset = $("<fieldset class='qpx-form-fieldset'></fieldset>");
            if (def.label) { $fieldset.append($("<legend></legend>").text(def.label)); }
            if (def.css) { $fieldset.addClass(def.css); }

            var $body = $("<div class='qpx-form-rows'></div>").css("gap", qpx.toPx(this.config.gap));
            $fieldset.append($body);
            $parent.append($fieldset);

            (def.elements || def.rows || []).forEach(function (childDef) {
                this._renderElement(childDef, $body);
            }, this);
        },

        _renderTemplate: function (def, $parent) {
            var $tpl = $("<div class='qpx-form-template'></div>");
            if (def.css) { $tpl.addClass(def.css); }
            if (qpx.isFunction(def.template)) {
                var res = def.template(this);
                if (res !== undefined && res !== null) { $tpl.append(res); }
            } else if (def.template) {
                $tpl.html(def.template);
            }
            $parent.append($tpl);
        },

        _renderSpacer: function (def, $parent) {
            $parent.append($("<div class='qpx-form-spacer'></div>").css("height", qpx.toPx(def.height || this.config.gap)));
        },

        // prvek bez popisku (button/template/spacer) — vykreslí se přímo
        _renderPlain: function (def, $parent) {
            var $wrap = $("<div class='qpx-form-plain'></div>");
            if (def.css) { $wrap.addClass(def.css); }
            $parent.append($wrap);
            var instance = qpx.ui(this._stripFormKeys(def), $wrap);
            this._widgetInstances.push(instance);
        },

        // -- skutečné pole s popiskem, hint textem a chybovou hláškou -----
        _renderField: function (def, $parent) {
            var self = this;
            var cfg = this.config;
            var labelPos = def.labelPosition || cfg.labelPosition;

            var $row = $("<div class='qpx-form-row'></div>")
                .addClass(labelPos === "top" ? "qpx-form-row-label-top" : "qpx-form-row-label-left");
            if (def.css) { $row.addClass(def.css); }

            if (def.label) {
                var $label = $("<label class='qpx-form-label'></label>").text(def.label);
                if (def.required) { $label.append($("<span class='qpx-form-required'> *</span>")); }
                if (labelPos !== "top") { $label.css("width", qpx.toPx(def.labelWidth || cfg.labelWidth)); }
                $row.append($label);
            }

            var $fieldWrap = $("<div class='qpx-form-field'></div>");
            var $mount = $("<div class='qpx-form-control'></div>");
            $fieldWrap.append($mount);

            var widgetCfg = this._stripFormKeys(def);
            if (cfg.disabled) { widgetCfg.disabled = true; }
            if (cfg.readOnly && widgetCfg.readOnly === undefined) { widgetCfg.readOnly = true; }

            var instance = qpx.ui(widgetCfg, $mount);
            this._widgetInstances.push(instance);

            if (def.hint) { $fieldWrap.append($("<div class='qpx-form-hint'></div>").text(def.hint)); }
            var $error = $("<div class='qpx-form-error'></div>").hide();
            $fieldWrap.append($error);

            $row.append($fieldWrap);
            $parent.append($row);

            if (def.name) {
                this._fields[def.name] = instance;
                this._elementDefs[def.name] = def;
                this._rows[def.name] = { $row: $row, $error: $error };

                instance.on("valueChanged", function (e) {
                    if (self._rows[def.name] && self._rows[def.name].$row.hasClass("qpx-state-invalid")) {
                        self.validate(def.name);
                    }
                    if (!self._suppressChange) {
                        self.trigger("change", { name: def.name, value: e.value, values: self.getValues(), component: self });
                    }
                });
            }
        },

        // odstraní klíče specifické pro qpForm, než se config předá qpx.ui()
        _stripFormKeys: function (def) {
            var clean = $.extend({}, def);
            delete clean.name;
            delete clean.label;
            delete clean.labelWidth;
            delete clean.labelPosition;
            delete clean.required;
            delete clean.hint;
            delete clean.css;
            delete clean.invalidMessage;
            return clean;
        },

        // ---------------------------------------------------------------
        // Hodnoty
        // ---------------------------------------------------------------
        getValues: function () {
            var obj = {};
            $.each(this._fields, function (name, instance) {
                obj[name] = qpx.isFunction(instance.value) ? instance.value() : instance.option("value");
            });
            return obj;
        },

        // Webix-friendly alias — zde beze změny formátu hodnot
        getCleanValues: function () { return this.getValues(); },

        setValues: function (obj, silent) {
            var self = this;
            this._suppressChange = !!silent;
            $.each(obj || {}, function (name, value) {
                var instance = self._fields[name];
                if (instance) { instance.option("value", value); }
            });
            this._suppressChange = false;
            return this;
        },

        clear: function () {
            $.each(this._fields, function (name, instance) {
                if (qpx.isFunction(instance.reset)) { instance.reset(); } else { instance.option("value", null); }
            });
            this.clearValidation();
            return this;
        },
        reset: function () { return this.clear(); },

        getField: function (name) { return this._fields[name]; },
        focus: function (name) {
            var instance = name ? this._fields[name] : this._fields[Object.keys(this._fields)[0]];
            if (instance && qpx.isFunction(instance.focus)) { instance.focus(); }
            return this;
        },

        // ---------------------------------------------------------------
        // Validace
        // ---------------------------------------------------------------
        _collectRulesFor: function (name) {
            var def = this._elementDefs[name] || {};
            var rules = [];
            if (def.required) { rules.push(qpx.formRules.required); }
            var configured = this.config.rules[name];
            if (configured) { rules = rules.concat(isPlainArray(configured) ? configured : [configured]); }
            return rules;

            function isPlainArray(v) { return Object.prototype.toString.call(v) === "[object Array]"; }
        },

        validate: function (name) {
            var self = this;
            var values = this.getValues();
            var names = name ? [name] : Object.keys(this._fields);
            var results = {};
            var allValid = true;

            names.forEach(function (fieldName) {
                var rules = self._collectRulesFor(fieldName);
                var fieldValid = true;
                var message = null;

                for (var i = 0; i < rules.length; i++) {
                    var res = evalRule(rules[i], values[fieldName], values);
                    if (!res.valid) {
                        fieldValid = false;
                        message = res.message || self._elementDefs[fieldName].invalidMessage ||
                            "Pole „" + (self._elementDefs[fieldName].label || fieldName) + "“ není platné.";
                        break;
                    }
                }

                results[fieldName] = { valid: fieldValid, message: message };
                if (fieldValid) { self.clearValidation(fieldName); } else { self.markInvalid(fieldName, message); }
                if (!fieldValid) { allValid = false; }
            });

            this.trigger("validated", { isValid: allValid, results: results, component: this });
            return allValid;
        },

        isValid: function (name) { return this.validate(name); },

        markInvalid: function (name, message) {
            var row = this._rows[name];
            if (!row) { return this; }
            row.$row.addClass("qpx-state-invalid");
            row.$error.text(message || "").show();
            return this;
        },

        clearValidation: function (name) {
            var self = this;
            var names = name ? [name] : Object.keys(this._rows);
            names.forEach(function (n) {
                var row = self._rows[n];
                if (!row) { return; }
                row.$row.removeClass("qpx-state-invalid");
                row.$error.hide().text("");
            });
            return this;
        },

        // ---------------------------------------------------------------
        // Odeslání (bez skutečné navigace prohlížeče — jen validace + event)
        // ---------------------------------------------------------------
        submit: function () {
            this._handleSubmit();
            return this;
        },

        // ---------------------------------------------------------------
        // Veřejné API — enable/disable, option
        // ---------------------------------------------------------------
        enable: function () { return this.option("disabled", false); },
        disable: function () { return this.option("disabled", true); },

        option: function (name, value) {
            if (arguments.length === 0) { return this.config; }
            if (qpx.isObject(name)) {
                var self = this;
                $.each(name, function (k, v) { self.option(k, v); });
                return this;
            }
            if (arguments.length === 1) { return this.config[name]; }

            var prev = this.config[name];
            if (prev === value) { return this; }
            this.config[name] = value;

            switch (name) {
                case "elements":
                case "labelWidth":
                case "labelPosition":
                case "gap":
                case "colGap":
                    this._renderForm();
                    break;

                case "rules":
                    // jen se použije při dalším validate(), nic se nepřekresluje
                    break;

                case "formAttributes":
                    this._applyFormAttributes(value || {});
                    break;

                case "disabled":
                    this.$container.toggleClass("qpx-state-disabled", !!value);
                    $.each(this._fields, function (n, inst) {
                        if (qpx.isFunction(inst.option)) { inst.option("disabled", !!value); }
                    });
                    break;

                case "readOnly":
                    this.$container.toggleClass("qpx-state-readonly", !!value);
                    $.each(this._fields, function (n, inst) {
                        if (inst.option("readOnly") !== undefined) { inst.option("readOnly", !!value); }
                    });
                    break;

                case "visible":
                    this.$container.toggleClass("qpx-hidden", !value);
                    break;
            }

            this.trigger("optionChanged", { name: name, value: value, previousValue: prev, component: this });
            return this;
        },

        destroy: function () {
            this._destroyFields();
            this.$container.off(".qpxForm");
            this._super();
        }
    });

    qpx.registerWidget("qpForm", Form);
    qpx.qpForm = Form;

})(window.qpx, jQuery);
