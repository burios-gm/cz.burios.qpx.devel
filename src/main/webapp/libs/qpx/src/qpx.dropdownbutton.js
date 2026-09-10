/*!
 * qpx - qpDropDownButton
 * Tlačítko s rozbalovacím seznamem položek, koncepčně jako DevExtreme
 * dxDropDownButton (volitelně "split" tlačítko se samostatnou šipkou).
 *  - options: text, icon, items, keyExpr, displayExpr, splitButton, useSelectMode
 *  - události: onButtonClick, onItemClick, onSelectionChanged, onOptionChanged
 *
 * Pozn.: widget byl přejmenován z "dropDownButton"/qpx.DropDownButton na
 * "qpDropDownButton"/qpx.qpDropDownButton (sjednocení "qp" prefixu).
 * Kdekoliv byl použit název "dropDownButton" (např. view: "dropDownButton"
 * v qpPropertyGrid, nebo options.widget u qpToolBar položek), nahraďte
 * ho za "qpDropDownButton".
 */
(function (qpx, $) {
    "use strict";

    var openInstance = null; // aktuálně otevřená instance (jen jedna najednou)

    var DropDownButton = qpx.Widget.extend({

        defaults: {
            text: "",
            icon: "",
            items: [],              // [{ text, icon, key, disabled }]
            keyExpr: "key",
            displayExpr: "text",
            splitButton: false,     // true = samostatné tlačítko + šipka
            useSelectMode: false,   // true = vybraná položka nahradí text tlačítka
            selectedItemKey: null,
            disabled: false,
            visible: true,
            stylingMode: "contained",
            dropDownOptions: {},    // { width }
            onButtonClick: null,
            onItemClick: null,
            onSelectionChanged: null,
            onOptionChanged: null
        },

        render: function () {
            var cfg = this.config;
            this.$container
                .addClass("qpx-dropdownbutton qpx-button qpx-button-mode-" + cfg.stylingMode)
                .toggleClass("qpx-dropdownbutton-split", !!cfg.splitButton)
                .toggleClass("qpx-hidden", !cfg.visible);

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

        _buildDom: function () {
            var cfg = this.config;
            this.$container.empty().attr("tabindex", cfg.disabled ? "-1" : "0");

            this.$mainPart = $("<span class='qpx-dropdownbutton-main'></span>");
            if (cfg.icon) {
                var $icon = $("<span class='qpx-icon'></span>");
                (String(cfg.icon).indexOf("css:") === 0) ? $icon.addClass(String(cfg.icon).slice(4)) : $icon.text(cfg.icon);
                this.$mainPart.append($icon);
            }
            this.$textEl = $("<span class='qpx-button-text'></span>").text(this._currentText());
            this.$mainPart.append(this.$textEl);

            this.$arrowPart = $("<span class='qpx-dropdownbutton-arrow'>▾</span>");

            this.$container.append(this.$mainPart, this.$arrowPart);

            this.$menu = $("<div class='qpx-popup-list qpx-dropdownbutton-menu'></div>").appendTo(document.body).hide();
            this._renderMenuItems();
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

        _bindEvents: function () {
            var self = this;
            var cfg = this.config;

            if (cfg.splitButton) {
                this.$mainPart.on("click.qpxDdb", function (e) {
                    if (self.config.disabled) { return; }
                    self._close();
                    self.trigger("buttonClick", { event: e, component: self, element: self.getNode() });
                });
                this.$arrowPart.on("click.qpxDdb", function (e) {
                    if (self.config.disabled) { return; }
                    e.stopPropagation();
                    self._toggle();
                });
            } else {
                this.$container.on("click.qpxDdb", function (e) {
                    if (self.config.disabled) { return; }
                    self._toggle();
                    self.trigger("buttonClick", { event: e, component: self, element: self.getNode() });
                });
            }

            $(document).on("mousedown.qpxDdb" + this.id, function (e) {
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
            this._buildDom();
            this._bindEvents();
            this.trigger("optionChanged", { name: name, value: value, previousValue: prev });
            return this;
        },

        enable: function () { return this.option("disabled", false); },
        disable: function () { return this.option("disabled", true); },

        destroy: function () {
            this.$container.off(".qpxDdb");
            $(document).off(".qpxDdb" + this.id);
            if (this.$menu) { this.$menu.remove(); }
            if (openInstance === this) { openInstance = null; }
            this._super();
        }
    });

    qpx.registerWidget("qpDropDownButton", DropDownButton);
    qpx.qpDropDownButton = DropDownButton;

})(window.qpx, jQuery);
