/*!
 * qpx - qpNumberBox
 * Vstupní pole pro čísla se spin tlačítky, koncepčně i vzhledově co
 * nejblíže DevExtreme dxNumberBox. Hodnota (option "value") je vždy
 * typu number nebo null - zobrazený text se formátuje dle "format"
 * a při Enteru/ztrátě focusu se přepočítá a ořízne dle min/max.
 *
 * options:
 *   value (number|null), min, max, step, showSpinButtons, showClearButton,
 *   format (počet desetinných míst, nebo function(value) -> string),
 *   placeholder, stylingMode ("outlined"|"filled"|"underlined"),
 *   disabled, readOnly, visible
 *
 * events:
 *   onInitialized, onContentReady, onValueChanged, onOptionChanged,
 *   onFocusIn, onFocusOut, onEnterKey, onKeyDown, onKeyUp, onDisposing
 *
 * methods:
 *   option(name[, value]), value([val]), focus(), blur(), reset(),
 *   enable(), disable(), destroy()
 */
(function (qpx, $) {
    "use strict";

    var NumberBox = qpx.Widget.extend({

        defaults: {
            value: null,
            min: null,
            max: null,
            step: 1,

            format: null,  // number = počet desetinných míst, nebo function(value){ return "text"; }

            showSpinButtons: true,
            showClearButton: false,
            stylingMode: "outlined",  // outlined | filled | underlined
            placeholder: "",

            disabled: false,
            readOnly: false,
            visible: true,

            onValueChanged: null,
            onOptionChanged: null,
            onInitialized: null,
            onContentReady: null,
            onFocusIn: null,
            onFocusOut: null,
            onEnterKey: null,
            onKeyDown: null,
            onKeyUp: null,
            onDisposing: null
        },

        // ---------------------------------------------------------------
        render: function () {
            var cfg = this.config;
            var self = this;

            // vstupní hodnotu hned na začátku znormalizujeme (parse + ořez min/max)
            cfg.value = this._clamp(this._parse(cfg.value));

            this.$container
                .addClass("qpx-numberbox")
                .addClass("qpx-numberbox-mode-" + cfg.stylingMode)
                .toggleClass("qpx-hidden", !cfg.visible)
                .toggleClass("qpx-state-disabled", !!cfg.disabled)
                .toggleClass("qpx-state-readonly", !!cfg.readOnly)
                .toggleClass("qpx-numberbox-spins-visible", !!cfg.showSpinButtons);

            if (cfg.onInitialized) { this.on("ready", cfg.onInitialized); }
            if (cfg.onContentReady) { this.on("contentReady", cfg.onContentReady); }
            if (cfg.onValueChanged) { this.on("valueChanged", cfg.onValueChanged); }
            if (cfg.onOptionChanged) { this.on("optionChanged", cfg.onOptionChanged); }
            if (cfg.onFocusIn) { this.on("focusIn", cfg.onFocusIn); }
            if (cfg.onFocusOut) { this.on("focusOut", cfg.onFocusOut); }
            if (cfg.onEnterKey) { this.on("enterKey", cfg.onEnterKey); }
            if (cfg.onKeyDown) { this.on("keyDown", cfg.onKeyDown); }
            if (cfg.onKeyUp) { this.on("keyUp", cfg.onKeyUp); }
            if (cfg.onDisposing) { this.on("destroy", cfg.onDisposing); }

            this._buildDom();
            this._bindEvents();

            setTimeout(function () { self.trigger("contentReady", { component: self }); }, 0);
        },

        // ---------------------------------------------------------------
        // DOM
        // ---------------------------------------------------------------
        _buildDom: function () {
            var cfg = this.config;
            this.$container.empty();

            this.$input = $("<input class='qpx-numberbox-input' type='text' inputmode='decimal' autocomplete='off'>")
                .attr("placeholder", cfg.placeholder || "")
                .prop("disabled", !!cfg.disabled)
                .prop("readOnly", !!cfg.readOnly);

            this.$clearBtn = $("<span class='qpx-numberbox-clear' tabindex='-1' title='Vymazat'>✕</span>").hide();

            this.$spinUp = $("<span class='qpx-numberbox-spin qpx-numberbox-spin-up' tabindex='-1'>▲</span>");
            this.$spinDown = $("<span class='qpx-numberbox-spin qpx-numberbox-spin-down' tabindex='-1'>▼</span>");
            this.$spins = $("<span class='qpx-numberbox-spins'></span>").append(this.$spinUp, this.$spinDown);

            this.$container.append(this.$input, this.$clearBtn, this.$spins);

            this._renderField();
        },

        _bindEvents: function () {
            var self = this;
            var cfg = this.config;

            this.$input.on("keydown.qpxNumberBox", function (e) {
                self.trigger("keyDown", { event: e, component: self, element: self.getNode() });
                if (cfg.disabled || cfg.readOnly) { return; }

                if (e.key === "Enter") {
                    self._commit();
                    self.trigger("enterKey", { event: e, component: self, element: self.getNode() });
                } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    self._step(1);
                } else if (e.key === "ArrowDown") {
                    e.preventDefault();
                    self._step(-1);
                } else if (!self._isEditKeyAllowed(e)) {
                    e.preventDefault();
                }
            });

            this.$input.on("keyup.qpxNumberBox", function (e) {
                self.trigger("keyUp", { event: e, component: self, element: self.getNode() });
            });

            this.$input.on("input.qpxNumberBox", function () {
                self._renderClearButton();
            });

            this.$input.on("focus.qpxNumberBox", function () {
                self.$container.addClass("qpx-state-focused");
                self.trigger("focusIn", { component: self, element: self.getNode() });
            });

            this.$input.on("blur.qpxNumberBox", function () {
                self.$container.removeClass("qpx-state-focused");
                self._commit();
                self.trigger("focusOut", { component: self, element: self.getNode() });
            });

            this.$spinUp.on("mousedown.qpxNumberBox", function (e) { e.preventDefault(); });
            this.$spinUp.on("click.qpxNumberBox", function (e) {
                e.preventDefault();
                if (cfg.disabled || cfg.readOnly) { return; }
                self.$input.trigger("focus");
                self._step(1);
            });

            this.$spinDown.on("mousedown.qpxNumberBox", function (e) { e.preventDefault(); });
            this.$spinDown.on("click.qpxNumberBox", function (e) {
                e.preventDefault();
                if (cfg.disabled || cfg.readOnly) { return; }
                self.$input.trigger("focus");
                self._step(-1);
            });

            this.$clearBtn.on("mousedown.qpxNumberBox", function (e) { e.preventDefault(); });
            this.$clearBtn.on("click.qpxNumberBox", function (e) {
                e.stopPropagation();
                if (cfg.disabled || cfg.readOnly) { return; }
                self.option("value", null);
                self.$input.trigger("focus");
            });
        },

        _isEditKeyAllowed: function (e) {
            // povolené: číslice, minus, oddělovač desetin, navigace/mazání, Tab,
            // kombinace s Ctrl/Cmd/Alt (copy/paste, zkratky OS...)
            if (e.ctrlKey || e.metaKey || e.altKey) { return true; }
            var navKeys = ["Tab", "Backspace", "Delete", "ArrowLeft", "ArrowRight", "Home", "End"];
            if (navKeys.indexOf(e.key) !== -1) { return true; }
            return /^[0-9\-,.]$/.test(e.key);
        },

        // ---------------------------------------------------------------
        // Práce s hodnotou
        // ---------------------------------------------------------------
        _parse: function (text) {
            if (text === null || text === undefined || String(text).trim() === "") { return null; }
            var normalized = String(text).replace(",", ".").replace(/\s/g, "");
            var num = parseFloat(normalized);
            return isNaN(num) ? null : num;
        },

        _clamp: function (num) {
            if (num === null || num === undefined) { return null; }
            var cfg = this.config;
            if (cfg.min !== null && cfg.min !== undefined && num < cfg.min) { num = cfg.min; }
            if (cfg.max !== null && cfg.max !== undefined && num > cfg.max) { num = cfg.max; }
            return num;
        },

        _format: function (num) {
            var cfg = this.config;
            if (num === null || num === undefined) { return ""; }
            if (qpx.isFunction(cfg.format)) { return cfg.format(num); }
            if (typeof cfg.format === "number") { return num.toFixed(cfg.format); }
            return String(num);
        },

        _commit: function () {
            var clamped = this._clamp(this._parse(this.$input.val()));
            this.option("value", clamped);
        },

        _step: function (dir) {
            var cfg = this.config;
            var current = this._parse(this.$input.val());
            if (current === null) { current = (cfg.value !== null && cfg.value !== undefined) ? cfg.value : 0; }
            var next = this._clamp(current + dir * (cfg.step || 1));
            this.option("value", next);
        },

        _renderField: function () {
            var cfg = this.config;
            this.$input.val(this._format(cfg.value)).attr("placeholder", cfg.placeholder || "");
            this._renderClearButton();
        },

        _renderClearButton: function () {
            var cfg = this.config;
            var val = this.$input.val();
            this.$clearBtn.toggle(!!cfg.showClearButton && val !== "" && val !== undefined && !cfg.disabled && !cfg.readOnly);
        },

        // ---------------------------------------------------------------
        // Veřejné API
        // ---------------------------------------------------------------
        value: function (val) {
            if (arguments.length === 0) { return this.config.value; }
            return this.option("value", val);
        },

        focus: function () { this.$input.trigger("focus"); return this; },
        blur: function () { this.$input.trigger("blur"); return this; },
        reset: function () { return this.option("value", null); },
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

            if (name === "value") { value = this._clamp(this._parse(value)); }

            var prev = this.config[name];
            if (prev === value) { return this; }
            this.config[name] = value;

            switch (name) {
                case "value":
                    this._renderField();
                    this.trigger("valueChanged", { value: value, previousValue: prev, component: this, element: this.getNode() });
                    break;

                case "min":
                case "max":
                    this.config.value = this._clamp(this.config.value);
                    this._renderField();
                    break;

                case "format":
                    this._renderField();
                    break;

                case "disabled":
                    this.$container.toggleClass("qpx-state-disabled", !!value);
                    this.$input.prop("disabled", !!value);
                    this._renderClearButton();
                    break;

                case "readOnly":
                    this.$container.toggleClass("qpx-state-readonly", !!value);
                    this.$input.prop("readOnly", !!value);
                    this._renderClearButton();
                    break;

                case "visible":
                    this.$container.toggleClass("qpx-hidden", !value);
                    break;

                case "stylingMode":
                    this.$container.removeClass("qpx-numberbox-mode-" + prev).addClass("qpx-numberbox-mode-" + value);
                    break;

                case "showSpinButtons":
                    this.$container.toggleClass("qpx-numberbox-spins-visible", !!value);
                    break;

                case "showClearButton":
                    this._renderClearButton();
                    break;

                case "placeholder":
                    this.$input.attr("placeholder", value || "");
                    break;
            }

            this.trigger("optionChanged", { name: name, value: value, previousValue: prev, component: this });
            return this;
        },

        destroy: function () {
            this.$container.off(".qpxNumberBox");
            if (this.$input) { this.$input.off(".qpxNumberBox"); }
            this._super();
        }
    });

    qpx.registerWidget("qpNumberBox", NumberBox);
    qpx.qpNumberBox = NumberBox;

})(window.qpx, jQuery);
