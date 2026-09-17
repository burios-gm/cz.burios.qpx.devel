/*!
 * qpx - qpRibbonButton
 * Samostatné tlačítko určené výhradně pro položky qpRibbon (na rozdíl od
 * obecného qpButton má vlastní, přesně odměřený vzhled pro obě varianty
 * použité v pásu karet):
 *
 *   size: "large" - velké tlačítko přes celou výšku skupiny, ikona NAHOŘE,
 *                    text POD ní (např. Office "Vložit").
 *   size: "small" - kompaktní tlačítko v jedné řádce (ikona + text vedle
 *                    sebe), výška odpovídá přesně 1/3 dostupné výšky
 *                    skupiny, takže 3 tlačítka naskládaná pod sebe
 *                    (item.stack v qpRibbon) se vejdou beze zbytku a
 *                    nepřetékají mimo skupinu.
 *
 * options:
 *   text, icon (text/emoji glyph, nebo "css:trida-ikony"), size ("large"|"small"),
 *   disabled, visible, hint, onClick, onOptionChanged
 *
 * methods:
 *   option(name[, value]), enable(), disable(), focus(), destroy()
 *
 * events:
 *   onClick, onOptionChanged
 */
(function (qpx, $) {
    "use strict";

    var RibbonButton = qpx.Widget.extend({

        defaults: {
            text: "",
            icon: "",
            size: "small",        // large | small
            disabled: false,
            visible: true,
            hint: "",
            onClick: null,
            onOptionChanged: null
        },

        render: function () {
            var cfg = this.config;
            this.$container
                .addClass("qpx-ribbonbutton")
                .addClass("qpx-ribbonbutton-" + cfg.size)
                .toggleClass("qpx-state-disabled", !!cfg.disabled)
                .toggleClass("qpx-hidden", !cfg.visible)
                .attr("tabindex", cfg.disabled ? "-1" : "0")
                .attr("role", "button");

            if (cfg.onClick) { this.on("click", cfg.onClick); }
            if (cfg.onOptionChanged) { this.on("optionChanged", cfg.onOptionChanged); }

            this._renderContent();
            this._bindEvents();
        },

        _renderContent: function () {
            var cfg = this.config;
            this.$container.empty();

            if (cfg.icon) {
                var $icon = $("<span class='qpx-icon'></span>");
                if (String(cfg.icon).indexOf("css:") === 0) {
                    $icon.addClass(String(cfg.icon).slice(4));
                } else {
                    $icon.text(cfg.icon);
                }
                this.$container.append($icon);
            }
            if (cfg.text) {
                this.$container.append($("<span class='qpx-ribbonbutton-text'></span>").text(cfg.text));
            }
            if (cfg.hint) { this.$container.attr("title", cfg.hint); }
        },

        _bindEvents: function () {
            var self = this;

            this.$container.on("click.qpxRibbonButton", function (e) {
                if (self.config.disabled) { return; }
                self.trigger("click", { event: e, component: self, element: self.getNode() });
            });
            this.$container.on("keydown.qpxRibbonButton", function (e) {
                if (self.config.disabled) { return; }
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    self.$container.trigger("click");
                }
            });
        },

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

            if (name === "size") {
                this.$container.removeClass("qpx-ribbonbutton-" + prev).addClass("qpx-ribbonbutton-" + value);
            } else if (name === "disabled") {
                this.$container.toggleClass("qpx-state-disabled", !!value).attr("tabindex", value ? "-1" : "0");
            } else if (name === "visible") {
                this.$container.toggleClass("qpx-hidden", !value);
            } else {
                this._renderContent();
            }

            this.trigger("optionChanged", { name: name, value: value, previousValue: prev, component: this });
            return this;
        },

        enable: function () { return this.option("disabled", false); },
        disable: function () { return this.option("disabled", true); },
        focus: function () { this.$container.trigger("focus"); return this; },

        destroy: function () {
            this.$container.off(".qpxRibbonButton");
            this._super();
        }
    });

    qpx.registerWidget("qpRibbonButton", RibbonButton);
    qpx.qpRibbonButton = RibbonButton;

})(window.qpx, jQuery);
