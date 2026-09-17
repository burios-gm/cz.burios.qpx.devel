/*!
 * qpx - qpRibbonDropDownButton
 * Rozbalovací (příp. "split") tlačítko určené výhradně pro položky
 * qpRibbon - obdoba qpDropDownButton, ale s dvěma velikostmi ve stylu
 * MS Office přesně jako u qpRibbonButton:
 *
 *   size: "large" - ikona nahoře, pod ní pruh s textem a šipkou ▾
 *                    (u splitButton je horní ikonová část samostatná
 *                    klikací zóna s výchozí akcí, spodní pruh text+šipka
 *                    otevírá menu - přesně jako Office "Vložit ▾").
 *   size: "small" - kompaktní jedna řádka: ikona + text + šipka ▾
 *                    (u splitButton je ikona+text jedna klikací zóna
 *                    s výchozí akcí, šipka samostatná zóna pro menu).
 *
 * Výška "small" varianty je stejná jako u qpRibbonButton
 * ($qpx-ribbon-btn-small-height), takže se dá stejně jako on řadit
 * do svislého "mini-sloupce" (item.stack v qpRibbon).
 *
 * options:
 *   text, icon, size ("large"|"small"), items, keyExpr, displayExpr,
 *   splitButton, useSelectMode, selectedItemKey, disabled, visible, hint,
 *   dropDownOptions ({ width })
 *
 * events:
 *   onButtonClick, onItemClick, onSelectionChanged, onOptionChanged
 *
 * methods:
 *   option(name[, value]), enable(), disable(), destroy()
 */
(function (qpx, $) {
    "use strict";

    var openInstance = null; // aktuálně otevřená instance (jen jedna najednou)

    var RibbonDropDownButton = qpx.Widget.extend({

        defaults: {
            text: "",
            icon: "",
            size: "small",           // large | small

            items: [],               // [{ text, icon, key, disabled }]
            keyExpr: "key",
            displayExpr: "text",

            splitButton: false,      // true = samostatná ikonová zóna (výchozí akce) + zóna text/šipka (menu)
            useSelectMode: false,    // true = vybraná položka nahradí text tlačítka
            selectedItemKey: null,

            disabled: false,
            visible: true,
            hint: "",
            dropDownOptions: {},     // { width }

            onButtonClick: null,
            onItemClick: null,
            onSelectionChanged: null,
            onOptionChanged: null
        },

        // ---------------------------------------------------------------
        render: function () {
            var cfg = this.config;

            this.$container
                .addClass("qpx-ribbon-ddbutton")
                .addClass("qpx-ribbon-ddbutton-" + cfg.size)
                .toggleClass("qpx-ribbon-ddbutton-split", !!cfg.splitButton)
                .toggleClass("qpx-state-disabled", !!cfg.disabled)
                .toggleClass("qpx-hidden", !cfg.visible)
                .attr("tabindex", cfg.disabled ? "-1" : "0");

            if (cfg.onButtonClick) { this.on("buttonClick", cfg.onButtonClick); }
            if (cfg.onItemClick) { this.on("itemClick", cfg.onItemClick); }
            if (cfg.onSelectionChanged) { this.on("selectionChanged", cfg.onSelectionChanged); }
            if (cfg.onOptionChanged) { this.on("optionChanged", cfg.onOptionChanged); }

            this._isOpen = false;
            this._buildDom();
            this._bindEvents();
        },

        _keyOf: function (item, index) {
            return item[this.config.keyExpr] !== undefined ? item[this.config.keyExpr] : index;
        },
        _labelOf: function (item) {
            return item[this.config.displayExpr];
        },

        _currentText: function () {
            var cfg = this.config;
            if (cfg.useSelectMode && cfg.selectedItemKey !== null) {
                var self = this;
                var found = cfg.items.filter(function (it, i) { return self._keyOf(it, i) === cfg.selectedItemKey; })[0];
                if (found) { return this._labelOf(found); }
            }
            return cfg.text;
        },

        // ---------------------------------------------------------------
        // DOM - vždy stejná struktura (icon-zone + label-zone), rozdíl
        // mezi "large"/"small" a split/non-split řeší jen CSS + to, na
        // který element se pověsí které klikací chování (viz _bindEvents).
        // ---------------------------------------------------------------
        _buildDom: function () {
            var cfg = this.config;
            this.$container.empty();
            if (cfg.hint) { this.$container.attr("title", cfg.hint); }

            this.$iconZone = $("<span class='qpx-ribbon-ddbutton-iconzone'></span>");
            if (cfg.icon) {
                var $icon = $("<span class='qpx-icon'></span>");
                (String(cfg.icon).indexOf("css:") === 0) ? $icon.addClass(String(cfg.icon).slice(4)) : $icon.text(cfg.icon);
                this.$iconZone.append($icon);
            }

            this.$labelZone = $("<span class='qpx-ribbon-ddbutton-labelzone'></span>");
            this.$textEl = $("<span class='qpx-ribbonbutton-text'></span>").text(this._currentText());
            this.$arrowEl = $("<span class='qpx-ribbon-ddbutton-arrow'>▾</span>");
            this.$labelZone.append(this.$textEl, this.$arrowEl);

            this.$container.append(this.$iconZone, this.$labelZone);

            this.$menu = $("<div class='qpx-popup-list qpx-ribbon-ddbutton-menu'></div>").appendTo(document.body).hide();
            this._renderMenuItems();
        },

        _renderMenuItems: function () {
            var self = this;
            var cfg = this.config;
            this.$menu.empty();
            if (cfg.dropDownOptions && cfg.dropDownOptions.width) {
                this.$menu.css("width", qpx.toPx(cfg.dropDownOptions.width));
            }

            cfg.items.forEach(function (item, index) {
                var key = self._keyOf(item, index);
                var $row = $("<div class='qpx-popup-list-item'></div>")
                    .toggleClass("qpx-state-disabled", !!item.disabled)
                    .toggleClass("qpx-state-selected", cfg.useSelectMode && cfg.selectedItemKey === key);

                if (item.icon) {
                    var $icon = $("<span class='qpx-icon'></span>");
                    (String(item.icon).indexOf("css:") === 0) ? $icon.addClass(String(item.icon).slice(4)) : $icon.text(item.icon);
                    $row.append($icon);
                }
                $row.append($("<span></span>").text(self._labelOf(item)));

                $row.on("click", function (e) {
                    if (item.disabled) { return; }
                    self._close();
                    if (cfg.useSelectMode) {
                        var prevKey = cfg.selectedItemKey;
                        cfg.selectedItemKey = key;
                        self.$textEl.text(self._currentText());
                        self.trigger("selectionChanged", { item: item, key: key, previousKey: prevKey, component: self });
                    }
                    self.trigger("itemClick", { event: e, itemData: item, itemIndex: index, component: self });
                });

                self.$menu.append($row);
            });
        },

        // ---------------------------------------------------------------
        _bindEvents: function () {
            var self = this;
            var cfg = this.config;

            if (cfg.splitButton) {
                this.$iconZone.on("click.qpxRibbonDdb", function (e) {
                    if (self.config.disabled) { return; }
                    self._close();
                    self.trigger("buttonClick", { event: e, component: self, element: self.getNode() });
                });
                this.$labelZone.on("click.qpxRibbonDdb", function (e) {
                    if (self.config.disabled) { return; }
                    e.stopPropagation();
                    self._toggle();
                });
            } else {
                this.$container.on("click.qpxRibbonDdb", function (e) {
                    if (self.config.disabled) { return; }
                    self._toggle();
                    self.trigger("buttonClick", { event: e, component: self, element: self.getNode() });
                });
            }

            this.$container.on("keydown.qpxRibbonDdb", function (e) {
                if (self.config.disabled) { return; }
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    self._toggle();
                }
            });

            $(document).on("mousedown.qpxRibbonDdb" + this.id, function (e) {
                if (!self._isOpen) { return; }
                if ($(e.target).closest(self.$menu).length || $(e.target).closest(self.$container).length) { return; }
                self._close();
            });
        },

        _toggle: function () { this._isOpen ? this._close() : this._open(); },

        _open: function () {
            if (openInstance && openInstance !== this) { openInstance._close(); }
            var off = this.$container.offset();
            this.$menu.css({
                top: off.top + this.$container.outerHeight(),
                left: off.left,
                minWidth: this.$container.outerWidth()
            }).show();
            this._isOpen = true;
            openInstance = this;
            this.trigger("opened", { component: this });
        },

        _close: function () {
            if (!this._isOpen) { return; }
            this.$menu.hide();
            this._isOpen = false;
            if (openInstance === this) { openInstance = null; }
            this.trigger("closed", { component: this });
        },

        // ---------------------------------------------------------------
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
                case "size":
                    this.$container.removeClass("qpx-ribbon-ddbutton-" + prev).addClass("qpx-ribbon-ddbutton-" + value);
                    break;

                case "disabled":
                    this.$container.toggleClass("qpx-state-disabled", !!value).attr("tabindex", value ? "-1" : "0");
                    break;

                case "visible":
                    this.$container.toggleClass("qpx-hidden", !value);
                    break;

                case "splitButton":
                    this.$container.toggleClass("qpx-ribbon-ddbutton-split", !!value);
                    this.$iconZone.off(".qpxRibbonDdb");
                    this.$labelZone.off(".qpxRibbonDdb");
                    this.$container.off(".qpxRibbonDdb click");
                    this._bindEvents();
                    break;

                case "items":
                case "dropDownOptions":
                    this._renderMenuItems();
                    break;

                default:
                    this._buildDom();
                    this._bindEvents();
            }

            this.trigger("optionChanged", { name: name, value: value, previousValue: prev, component: this });
            return this;
        },

        enable: function () { return this.option("disabled", false); },
        disable: function () { return this.option("disabled", true); },

        destroy: function () {
            this.$container.off(".qpxRibbonDdb");
            if (this.$iconZone) { this.$iconZone.off(".qpxRibbonDdb"); }
            if (this.$labelZone) { this.$labelZone.off(".qpxRibbonDdb"); }
            $(document).off(".qpxRibbonDdb" + this.id);
            if (this.$menu) { this.$menu.remove(); }
            if (openInstance === this) { openInstance = null; }
            this._super();
        }
    });

    qpx.registerWidget("qpRibbonDropDownButton", RibbonDropDownButton);
    qpx.qpRibbonDropDownButton = RibbonDropDownButton;

})(window.qpx, jQuery);
