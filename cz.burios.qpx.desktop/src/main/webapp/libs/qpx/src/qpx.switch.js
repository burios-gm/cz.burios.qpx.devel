/*!
 * qpx - qpSwitch
 * Přepínač inspirovaný DevExtreme dxSwitch:
 *  - options: value, onText, offText, name, disabled, visible, hint, stylingMode
 *  - metody: option(), value(), toggle(), enable(), disable(), focus()
 *  - události: onValueChanged, onOptionChanged
 */
(function (qpx, $) {
    "use strict";

    var Switch = qpx.Widget.extend({

        defaults: {
            value: false,          // true/false
            onText: "On",
            offText: "Off",
            name: "",
            disabled: false,
            visible: true,
            hint: "",
            stylingMode: "default", // default | outlined | flat
            onValueChanged: null,
            onOptionChanged: null
        },

        render: function () {
            var cfg = this.config;

            this.$container
                .addClass("qpx-switch")
                .addClass("qpx-switch-mode-" + cfg.stylingMode)
                .toggleClass("qpx-hidden", !cfg.visible)
                .toggleClass("qpx-state-disabled", !!cfg.disabled)
                .attr("role", "switch")
                .attr("tabindex", cfg.disabled ? "-1" : "0")
                .attr("aria-checked", !!cfg.value);

            if (cfg.name) {
                this.$container.attr("data-qpx-name", cfg.name);
            }
            if (cfg.hint) {
                this.$container.attr("title", cfg.hint);
            }

            if (cfg.onValueChanged) { this.on("valueChanged", cfg.onValueChanged); }
            if (cfg.onOptionChanged) { this.on("optionChanged", cfg.onOptionChanged); }

            this._renderContent();
            this._bindEvents();
        },

        _renderContent: function () {
            var cfg = this.config;
            this.$container.empty();

            var $track = $("<div class='qpx-switch-track'></div>");
            var $thumb = $("<div class='qpx-switch-thumb'></div>");
            var $labelOn = $("<span class='qpx-switch-label qpx-switch-label-on'></span>").text(cfg.onText);
            var $labelOff = $("<span class='qpx-switch-label qpx-switch-label-off'></span>").text(cfg.offText);

            $track.append($labelOff, $labelOn);
            $track.append($thumb);

            this.$container.append($track);

            this.$container
                .toggleClass("qpx-switch-on", !!cfg.value)
                .toggleClass("qpx-switch-off", !cfg.value)
                .attr("aria-checked", !!cfg.value);
        },

        _bindEvents: function () {
            var self = this;

            this.$container.off(".qpxSwitch");

            this.$container.on("click.qpxSwitch", function (e) {
                if (self.config.disabled) { return; }
                self.toggle();
            });

            this.$container.on("keydown.qpxSwitch", function (e) {
                if (self.config.disabled) { return; }
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    self.toggle();
                }
            });
        },

        // veřejné API: value() getter/setter
        value: function (val) {
            if (arguments.length === 0) {
                return !!this.config.value;
            }
            return this.option("value", !!val);
        },

        toggle: function () {
            return this.option("value", !this.config.value);
        },

        // option("x") -> čtení; option("x", v) -> zápis; option({x:..}) -> hromadně
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

            if (name === "value") {
                this.$container
                    .toggleClass("qpx-switch-on", !!this.config.value)
                    .toggleClass("qpx-switch-off", !this.config.value)
                    .attr("aria-checked", !!this.config.value);

                this.trigger("valueChanged", {
                    value: !!this.config.value,
                    previousValue: !!prev,
                    component: this,
                    element: this.getNode()
                });
            } else if (name === "visible") {
                this.$container.toggleClass("qpx-hidden", !value);
            } else if (name === "disabled") {
                this.$container
                    .toggleClass("qpx-state-disabled", !!value)
                    .attr("tabindex", value ? "-1" : "0");
            } else if (name === "stylingMode") {
                this.$container
                    .removeClass("qpx-switch-mode-default qpx-switch-mode-outlined qpx-switch-mode-flat")
                    .addClass("qpx-switch-mode-" + value);
            }

            this._renderContent();

            this.trigger("optionChanged", {
                name: name,
                value: value,
                previousValue: prev,
                element: this.getNode(),
                component: this
            });

            return this;
        },

        enable: function () { return this.option("disabled", false); },
        disable: function () { return this.option("disabled", true); },
        focus: function () { this.$container.trigger("focus"); return this; },

        destroy: function () {
            this.$container.off(".qpxSwitch");
            this._super();
        }
    });

    qpx.registerWidget("qpSwitch", Switch);
    qpx.qpSwitch = Switch;

})(window.qpx, jQuery);
