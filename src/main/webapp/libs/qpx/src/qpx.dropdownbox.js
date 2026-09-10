/*!
 * qpx - qpDropDownBox
 * Pole zobrazující aktuální hodnotu (přes displayExpr/dataSource), po
 * kliknutí rozbalí POPUP S LIBOVOLNÝM VLASTNÍM OBSAHEM (contentTemplate)
 * — např. qpTreeView, qpDataGrid nebo jinou kombinaci qpx komponent.
 * Koncepčně i vzhledově co nejblíže DevExtreme dxDropDownBox.
 *
 * Narozdíl od qpSelectBox/qpLookup si qpDropDownBox sám nespravuje
 * seznam položek — jen poskytuje "rám" (pole + popup) a řízení hodnoty;
 * o samotný výběr uvnitř popupu se stará obsah vložený přes contentTemplate,
 * který dostane odkaz na komponentu (component.option("value", ...), component.close()).
 *
 * options:
 *   items / dataSource, valueExpr, displayExpr, value,
 *   contentTemplate(e, contentElement), deferRendering,
 *   placeholder, showClearButton, stylingMode ("outlined"|"filled"|"underlined"),
 *   disabled, readOnly, visible, dropDownOptions
 *
 * events:
 *   onInitialized, onContentReady, onValueChanged,
 *   onOpened, onClosed, onOptionChanged, onDisposing
 *
 * methods:
 *   option(name[, value]), value([val]), open(), close(),
 *   content(), reset(), focus(), enable(), disable(), destroy()
 */
(function (qpx, $) {
    "use strict";

    var openInstance = null; // aktuálně otevřená instance (jen jedna najednou)

    var DropDownBox = qpx.Widget.extend({

        defaults: {
            dataSource: null,
            items: [],
            valueExpr: null,
            displayExpr: null,

            value: null,

            contentTemplate: null, // function(e:{component, value}, contentElement)
            deferRendering: true,  // true = obsah popupu se vykreslí až při prvním otevření

            placeholder: "Vyberte...",
            showClearButton: false,
            stylingMode: "outlined",  // outlined | filled | underlined

            disabled: false,
            readOnly: false,
            visible: true,

            dropDownOptions: {}, // { width, height, maxHeight }

            onValueChanged: null,
            onOpened: null,
            onClosed: null,
            onOptionChanged: null,
            onInitialized: null,
            onContentReady: null,
            onDisposing: null
        },

        // ---------------------------------------------------------------
        render: function () {
            var cfg = this.config;
            var self = this;

            cfg.items = (cfg.items && cfg.items.length) ? cfg.items : (cfg.dataSource || []);

            this.$container
                .addClass("qpx-dropdownbox")
                .addClass("qpx-dropdownbox-mode-" + cfg.stylingMode)
                .toggleClass("qpx-hidden", !cfg.visible)
                .toggleClass("qpx-state-disabled", !!cfg.disabled)
                .toggleClass("qpx-state-readonly", !!cfg.readOnly)
                .attr("role", "combobox")
                .attr("aria-expanded", "false");

            if (cfg.onInitialized) { this.on("ready", cfg.onInitialized); }
            if (cfg.onContentReady) { this.on("contentReady", cfg.onContentReady); }
            if (cfg.onValueChanged) { this.on("valueChanged", cfg.onValueChanged); }
            if (cfg.onOpened) { this.on("opened", cfg.onOpened); }
            if (cfg.onClosed) { this.on("closed", cfg.onClosed); }
            if (cfg.onOptionChanged) { this.on("optionChanged", cfg.onOptionChanged); }
            if (cfg.onDisposing) { this.on("destroy", cfg.onDisposing); }

            this._isOpen = false;
            this._contentRendered = false;

            this._buildDom();
            this._bindEvents();

            if (!cfg.deferRendering) { this._ensureContent(); }

            setTimeout(function () { self.trigger("contentReady", { component: self }); }, 0);
        },

        // ---------------------------------------------------------------
        // DOM
        // ---------------------------------------------------------------
        _buildDom: function () {
            var cfg = this.config;
            this.$container.empty();

            this.$input = $("<input type='text' class='qpx-dropdownbox-input' autocomplete='off' readonly>")
                .prop("disabled", !!cfg.disabled);

            this.$clearBtn = $("<span class='qpx-dropdownbox-clear' tabindex='-1' title='Vymazat výběr'>✕</span>").hide();
            this.$arrow = $("<span class='qpx-dropdownbox-arrow'>▾</span>");

            this.$container.append(this.$input, this.$clearBtn, this.$arrow);

            this.$dropdown = $("<div class='qpx-popup-surface qpx-dropdownbox-popup'></div>").appendTo(document.body).hide();
            this.$content = $("<div class='qpx-dropdownbox-content'></div>");
            this.$dropdown.append(this.$content);

            if (cfg.dropDownOptions && cfg.dropDownOptions.width) { this.$dropdown.css("width", qpx.toPx(cfg.dropDownOptions.width)); }
            if (cfg.dropDownOptions && cfg.dropDownOptions.height) { this.$content.css("height", qpx.toPx(cfg.dropDownOptions.height)); }
            if (cfg.dropDownOptions && cfg.dropDownOptions.maxHeight) { this.$content.css("max-height", qpx.toPx(cfg.dropDownOptions.maxHeight)); }

            this._renderField();
        },

        _bindEvents: function () {
            var self = this;
            var cfg = this.config;

            this.$container.on("click.qpxDropDownBox", function (e) {
                if (cfg.disabled || cfg.readOnly) { return; }
                if ($(e.target).closest(".qpx-dropdownbox-clear").length) { return; }
                if (self._isOpen) { self.close(); } else { self.open(); }
            });

            this.$clearBtn.on("click.qpxDropDownBox", function (e) {
                e.stopPropagation();
                if (cfg.disabled || cfg.readOnly) { return; }
                self.option("value", null);
            });

            $(document).on("mousedown.qpxDropDownBox" + this.id, function (e) {
                if (!self._isOpen) { return; }
                if ($(e.target).closest(self.$dropdown).length || $(e.target).closest(self.$container).length) { return; }
                self.close();
            });

            $(document).on("keydown.qpxDropDownBox" + this.id, function (e) {
                if (self._isOpen && e.key === "Escape") { self.close(); }
            });
        },

        _renderField: function () {
            var cfg = this.config;
            this.$input.val(this._resolveDisplayText()).attr("placeholder", cfg.placeholder);
            this.$clearBtn.toggle(!!cfg.showClearButton && cfg.value !== null && cfg.value !== undefined && !cfg.disabled && !cfg.readOnly);
        },

        _resolveDisplayText: function () {
            var cfg = this.config;
            if (cfg.value === null || cfg.value === undefined || cfg.value === "") { return ""; }

            if (cfg.displayExpr || cfg.valueExpr) {
                var self = this;
                var item = (cfg.items || []).filter(function (it) {
                    var v = cfg.valueExpr ? qpx.resolve(it, cfg.valueExpr) : it;
                    return v === cfg.value;
                })[0];
                if (item !== undefined) {
                    if (cfg.displayExpr) {
                        var d = qpx.resolve(item, cfg.displayExpr);
                        return (d === undefined || d === null) ? "" : String(d);
                    }
                    return qpx.isObject(item) ? JSON.stringify(item) : String(item);
                }
            }
            return String(cfg.value);
        },

        // ---------------------------------------------------------------
        // Obsah popupu
        // ---------------------------------------------------------------
        _ensureContent: function () {
            var cfg = this.config;
            if (this._contentRendered) { return; }
            this._contentRendered = true;

            this.$content.empty();
            if (qpx.isFunction(cfg.contentTemplate)) {
                var res = cfg.contentTemplate.call(this, { component: this, value: cfg.value }, this.$content[0]);
                if (res !== undefined && res !== null) { this.$content.append(res); }
            } else {
                this.$content.append($("<div class='qpx-dropdownbox-nocontent'></div>").text("contentTemplate není nastaven."));
            }
        },

        content: function () { return this.$content; },

        // ---------------------------------------------------------------
        // Popup otevřít/zavřít
        // ---------------------------------------------------------------
        open: function () {
            if (this.config.disabled || this.config.readOnly || this._isOpen) { return this; }
            if (openInstance && openInstance !== this) { openInstance.close(); }

            this._ensureContent();

            var off = this.$container.offset();
            this.$dropdown.css({
                top: off.top + this.$container.outerHeight(),
                left: off.left,
                minWidth: this.$container.outerWidth()
            }).show();

            this._isOpen = true;
            this.$container.attr("aria-expanded", "true");
            openInstance = this;
            this.trigger("opened", { component: this });
            return this;
        },

        close: function () {
            if (!this._isOpen) { return this; }
            this.$dropdown.hide();
            this._isOpen = false;
            this.$container.attr("aria-expanded", "false");
            if (openInstance === this) { openInstance = null; }
            this.trigger("closed", { component: this });
            return this;
        },

        // ---------------------------------------------------------------
        // Veřejné API
        // ---------------------------------------------------------------
        value: function (val) {
            if (arguments.length === 0) { return this.config.value; }
            return this.option("value", val);
        },

        getDataSource: function () { return this.config.items; },
        reset: function () { return this.option("value", null); },
        focus: function () { this.$input.trigger("focus"); return this; },
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
                    this._renderField();
                    this.trigger("valueChanged", { value: value, previousValue: prev, component: this, element: this.getNode() });
                    break;

                case "items":
                case "dataSource":
                    this.config.items = value || [];
                    this._renderField();
                    break;

                case "disabled":
                    this.$container.toggleClass("qpx-state-disabled", !!value);
                    this.$input.prop("disabled", !!value);
                    if (value) { this.close(); }
                    this._renderField();
                    break;

                case "readOnly":
                    this.$container.toggleClass("qpx-state-readonly", !!value);
                    if (value) { this.close(); }
                    break;

                case "visible":
                    this.$container.toggleClass("qpx-hidden", !value);
                    break;

                case "stylingMode":
                    this.$container.removeClass("qpx-dropdownbox-mode-" + prev).addClass("qpx-dropdownbox-mode-" + value);
                    break;

                case "placeholder":
                case "showClearButton":
                    this._renderField();
                    break;

                case "contentTemplate":
                    this._contentRendered = false;
                    if (this._isOpen) { this._ensureContent(); }
                    break;
            }

            this.trigger("optionChanged", { name: name, value: value, previousValue: prev, component: this });
            return this;
        },

        destroy: function () {
            this.$container.off(".qpxDropDownBox");
            $(document).off(".qpxDropDownBox" + this.id);
            if (this.$dropdown) { this.$dropdown.remove(); }
            if (openInstance === this) { openInstance = null; }
            this._super();
        }
    });

    qpx.registerWidget("qpDropDownBox", DropDownBox);
    qpx.qpDropDownBox = DropDownBox;

})(window.qpx, jQuery);
