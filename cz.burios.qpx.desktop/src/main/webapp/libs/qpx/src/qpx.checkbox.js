/*!
 * qpx - qpCheckBox
 * Zaškrtávací pole (booleovská, případně "indeterminate" hodnota),
 * koncepčně i vzhledově co nejblíže DevExtreme dxCheckBox.
 *
 * options:
 *   value (true|false|null - null = neurčitý/indeterminate stav), text, name,
 *   iconSize, disabled, readOnly, visible, hoverStateEnabled, focusStateEnabled,
 *   tabIndex
 *
 * events:
 *   onInitialized, onContentReady, onValueChanged, onOptionChanged,
 *   onFocusIn, onFocusOut, onDisposing
 *
 * methods:
 *   option(name[, value]), value([val]), focus(), blur(), reset(),
 *   enable(), disable(), destroy()
 */
(function (qpx, $) {
    "use strict";

    var CheckBox = qpx.Widget.extend({

        defaults: {
            value: false,          // true | false | null (neurčitý stav)
            text: "",
            name: null,

            iconSize: 18,

            disabled: false,
            readOnly: false,
            visible: true,
            hoverStateEnabled: true,
            focusStateEnabled: true,
            tabIndex: 0,

            onValueChanged: null,
            onOptionChanged: null,
            onInitialized: null,
            onContentReady: null,
            onFocusIn: null,
            onFocusOut: null,
            onDisposing: null
        },

        // ---------------------------------------------------------------
        render: function () {
            var cfg = this.config;
            var self = this;

            this.$container
                .addClass("qpx-checkbox")
                .toggleClass("qpx-hidden", !cfg.visible)
                .toggleClass("qpx-state-disabled", !!cfg.disabled)
                .toggleClass("qpx-state-readonly", !!cfg.readOnly)
                .toggleClass("qpx-checkbox-hoverable", !!cfg.hoverStateEnabled && !cfg.disabled)
                .attr("role", "checkbox");

            if (cfg.onInitialized) { this.on("ready", cfg.onInitialized); }
            if (cfg.onContentReady) { this.on("contentReady", cfg.onContentReady); }
            if (cfg.onValueChanged) { this.on("valueChanged", cfg.onValueChanged); }
            if (cfg.onOptionChanged) { this.on("optionChanged", cfg.onOptionChanged); }
            if (cfg.onFocusIn) { this.on("focusIn", cfg.onFocusIn); }
            if (cfg.onFocusOut) { this.on("focusOut", cfg.onFocusOut); }
            if (cfg.onDisposing) { this.on("destroy", cfg.onDisposing); }

            this._buildDom();
            this._bindEvents();
            this._renderState();

            setTimeout(function () { self.trigger("contentReady", { component: self }); }, 0);
        },

        // ---------------------------------------------------------------
        // DOM
        // ---------------------------------------------------------------
        _buildDom: function () {
            var cfg = this.config;
            this.$container.empty();

            this.$icon = $("<span class='qpx-checkbox-icon'></span>").css({
                width: qpx.toPx(cfg.iconSize),
                height: qpx.toPx(cfg.iconSize)
            });
            this.$mark = $("<span class='qpx-checkbox-mark'></span>");
            this.$icon.append(this.$mark);

            this.$text = $("<span class='qpx-checkbox-text'></span>").text(cfg.text || "").toggle(!!cfg.text);

            this.$container.append(this.$icon, this.$text);

            if (cfg.name) { this.$container.attr("data-qpx-name", cfg.name); }
            this._applyTabIndex();
        },

        _bindEvents: function () {
            var self = this;
            var cfg = this.config;

            this.$container.on("click.qpxCheckBox", function (e) {
                e.preventDefault();
                if (cfg.disabled || cfg.readOnly) { return; }
                self._toggle();
            });

            this.$container.on("keydown.qpxCheckBox", function (e) {
                if (cfg.disabled || cfg.readOnly) { return; }
                if (e.key === " " || e.key === "Spacebar" || e.key === "Enter") {
                    e.preventDefault();
                    self._toggle();
                }
            });

            this.$container.on("focusin.qpxCheckBox", function () {
                if (cfg.disabled) { return; }
                self.$container.addClass("qpx-state-focused");
                self.trigger("focusIn", { component: self, element: self.getNode() });
            });

            this.$container.on("focusout.qpxCheckBox", function () {
                self.$container.removeClass("qpx-state-focused");
                self.trigger("focusOut", { component: self, element: self.getNode() });
            });
        },

        _toggle: function () {
            // sled kliknutím: false -> true -> false (indeterminate lze nastavit
            // jen programově přes option("value", null), stejně jako v DevExtreme)
            this.option("value", !this.config.value);
        },

        _applyTabIndex: function () {
            var cfg = this.config;
            this.$container.attr("tabindex", (cfg.disabled || !cfg.focusStateEnabled) ? -1 : (cfg.tabIndex || 0));
        },

        _renderState: function () {
            var cfg = this.config;
            var isIndeterminate = cfg.value === null || cfg.value === undefined;

            this.$container
                .toggleClass("qpx-state-checked", cfg.value === true)
                .toggleClass("qpx-state-indeterminate", isIndeterminate)
                .attr("aria-checked", isIndeterminate ? "mixed" : String(!!cfg.value));

            this.$text.text(cfg.text || "").toggle(!!cfg.text);
        },

        // ---------------------------------------------------------------
        // Veřejné API
        // ---------------------------------------------------------------
        value: function (val) {
            if (arguments.length === 0) { return this.config.value; }
            return this.option("value", val);
        },

        focus: function () { this.$container.trigger("focus"); return this; },
        blur: function () { this.$container.trigger("blur"); return this; },
        reset: function () { return this.option("value", false); },
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
                case "value":
                    this._renderState();
                    this.trigger("valueChanged", { value: value, previousValue: prev, component: this, element: this.getNode() });
                    break;

                case "text":
                    this._renderState();
                    break;

                case "disabled":
                    this.$container.toggleClass("qpx-state-disabled", !!value);
                    this._applyTabIndex();
                    break;

                case "readOnly":
                    this.$container.toggleClass("qpx-state-readonly", !!value);
                    break;

                case "visible":
                    this.$container.toggleClass("qpx-hidden", !value);
                    break;

                case "hoverStateEnabled":
                    this.$container.toggleClass("qpx-checkbox-hoverable", !!value && !this.config.disabled);
                    break;

                case "focusStateEnabled":
                case "tabIndex":
                    this._applyTabIndex();
                    break;

                case "iconSize":
                    this.$icon.css({ width: qpx.toPx(value), height: qpx.toPx(value) });
                    break;
            }

            this.trigger("optionChanged", { name: name, value: value, previousValue: prev, component: this });
            return this;
        },

        destroy: function () {
            this.$container.off(".qpxCheckBox");
            this._super();
        }
    });

    qpx.registerWidget("qpCheckBox", CheckBox);
    qpx.qpCheckBox = CheckBox;

})(window.qpx, jQuery);
