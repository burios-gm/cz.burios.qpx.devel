/*!
 * qpx - qpSelectBox
 * Výběr jedné položky z rozbalovacího seznamu, koncepčně i vzhledově
 * co nejblíže DevExtreme dxSelectBox. Na rozdíl od qpAutocomplete je
 * hodnotou vždy položka ze seznamu (resp. valueExpr z ní) — volný text
 * je povolen jen při acceptCustomValue: true.
 *
 * options:
 *   items / dataSource, valueExpr, displayExpr, value,
 *   placeholder, searchEnabled, searchTimeout, minSearchLength, noDataText,
 *   acceptCustomValue, showClearButton, stylingMode ("outlined"|"filled"|"underlined"),
 *   disabled, readOnly, visible, itemTemplate, dropDownOptions
 *
 * events:
 *   onInitialized, onContentReady, onValueChanged, onSelectionChanged,
 *   onOpened, onClosed, onCustomItemCreating, onOptionChanged, onDisposing
 *
 * methods:
 *   option(name[, value]), value([val]), open(), close(),
 *   getSelectedItem(), getDataSource(), reset(), focus(),
 *   enable(), disable(), destroy()
 */
(function (qpx, $) {
    "use strict";

    var openInstance = null; // aktuálně otevřená instance (jen jedna najednou)

    var SelectBox = qpx.Widget.extend({

        defaults: {
            dataSource: null,
            items: [],
            valueExpr: null,      // null = "this" (celá položka je hodnota)
            displayExpr: null,    // null = item.text, nebo JSON.stringify

            value: null,

            placeholder: "Vyberte...",
            searchEnabled: false,
            searchTimeout: 200,
            minSearchLength: 0,
            noDataText: "Žádné položky",

            acceptCustomValue: false,
            showClearButton: false,
            stylingMode: "outlined",  // outlined | filled | underlined

            disabled: false,
            readOnly: false,
            visible: true,

            itemTemplate: null,  // function(itemData, itemIndex, itemElement)
            dropDownOptions: {}, // { width, maxHeight }

            onValueChanged: null,
            onSelectionChanged: null,
            onOpened: null,
            onClosed: null,
            onCustomItemCreating: null,
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
                .addClass("qpx-selectbox")
                .addClass("qpx-selectbox-mode-" + cfg.stylingMode)
                .toggleClass("qpx-hidden", !cfg.visible)
                .toggleClass("qpx-state-disabled", !!cfg.disabled)
                .toggleClass("qpx-state-readonly", !!cfg.readOnly)
                .attr("role", "combobox")
                .attr("aria-expanded", "false");

            if (cfg.onInitialized) { this.on("ready", cfg.onInitialized); }
            if (cfg.onContentReady) { this.on("contentReady", cfg.onContentReady); }
            if (cfg.onValueChanged) { this.on("valueChanged", cfg.onValueChanged); }
            if (cfg.onSelectionChanged) { this.on("selectionChanged", cfg.onSelectionChanged); }
            if (cfg.onOpened) { this.on("opened", cfg.onOpened); }
            if (cfg.onClosed) { this.on("closed", cfg.onClosed); }
            if (cfg.onOptionChanged) { this.on("optionChanged", cfg.onOptionChanged); }
            if (cfg.onDisposing) { this.on("destroy", cfg.onDisposing); }

            this._isOpen = false;
            this._searchText = "";
            this._highlightIndex = -1;

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

            this.$input = $("<input type='text' class='qpx-selectbox-input' autocomplete='off'>")
                .prop("disabled", !!cfg.disabled)
                .prop("readOnly", !cfg.searchEnabled || !!cfg.readOnly);

            this.$clearBtn = $("<span class='qpx-selectbox-clear' tabindex='-1' title='Vymazat výběr'>✕</span>").hide();
            this.$arrow = $("<span class='qpx-selectbox-arrow'>▾</span>");

            this.$container.append(this.$input, this.$clearBtn, this.$arrow);

            this.$dropdown = $("<div class='qpx-popup-list qpx-selectbox-dropdown'></div>").appendTo(document.body).hide();
            this.$list = $("<div class='qpx-selectbox-list'></div>");
            this.$dropdown.append(this.$list);

            if (cfg.dropDownOptions && cfg.dropDownOptions.width) { this.$dropdown.css("width", qpx.toPx(cfg.dropDownOptions.width)); }
            if (cfg.dropDownOptions && cfg.dropDownOptions.maxHeight) { this.$list.css("max-height", qpx.toPx(cfg.dropDownOptions.maxHeight)); }

            this._renderField();
        },

        _bindEvents: function () {
            var self = this;
            var cfg = this.config;

            this.$container.on("click.qpxSelectBox", function (e) {
                if (cfg.disabled || cfg.readOnly) { return; }
                if ($(e.target).closest(".qpx-selectbox-clear").length) { return; }
                self.$input.trigger("focus");
                if (self._isOpen) { self.close(); } else { self.open(); }
            });

            this.$input.on("focus.qpxSelectBox", function () {
                if (cfg.disabled || cfg.readOnly) { return; }
                if (cfg.searchEnabled) { self.$input.val(""); self._searchText = ""; self._renderDropdownItems(); }
            });

            var searchTimer = null;
            this.$input.on("input.qpxSelectBox", function () {
                if (!cfg.searchEnabled) { return; }
                var val = this.value;
                clearTimeout(searchTimer);
                searchTimer = setTimeout(function () {
                    self._searchText = (val.length >= (cfg.minSearchLength || 0)) ? val : "";
                    self._highlightIndex = -1;
                    self._renderDropdownItems();
                    if (!self._isOpen) { self.open(); }
                }, cfg.searchTimeout);
            });

            this.$input.on("keydown.qpxSelectBox", function (e) {
                if (cfg.disabled || cfg.readOnly) { return; }
                var items = self._filteredItems();

                switch (e.key) {
                    case "ArrowDown":
                        e.preventDefault();
                        if (!self._isOpen) { self.open(); }
                        self._highlightIndex = Math.min(items.length - 1, self._highlightIndex + 1);
                        self._renderDropdownItems();
                        break;

                    case "ArrowUp":
                        e.preventDefault();
                        self._highlightIndex = Math.max(0, self._highlightIndex - 1);
                        self._renderDropdownItems();
                        break;

                    case "Enter":
                        e.preventDefault();
                        if (self._highlightIndex > -1 && items[self._highlightIndex]) {
                            self._selectItem(items[self._highlightIndex]);
                        } else if (cfg.acceptCustomValue && this.value.trim()) {
                            self._handleCustomItemCreating(this.value.trim());
                        }
                        break;

                    case "Escape":
                        e.preventDefault();
                        self._renderField();
                        self.close();
                        break;
                }
            });

            this.$arrow.on("click.qpxSelectBox", function (e) {
                e.stopPropagation();
                if (cfg.disabled || cfg.readOnly) { return; }
                if (self._isOpen) { self.close(); } else { self.$input.trigger("focus"); self.open(); }
            });

            this.$clearBtn.on("click.qpxSelectBox", function (e) {
                e.stopPropagation();
                if (cfg.disabled || cfg.readOnly) { return; }
                self.option("value", null);
            });

            $(document).on("mousedown.qpxSelectBox" + this.id, function (e) {
                if (!self._isOpen) { return; }
                if ($(e.target).closest(self.$dropdown).length || $(e.target).closest(self.$container).length) { return; }
                self._renderField();
                self.close();
            });
        },

        // ---------------------------------------------------------------
        _renderField: function () {
            var cfg = this.config;
            var item = this._itemForValue(cfg.value);
            var text = (cfg.value !== null && cfg.value !== undefined)
                ? (item !== undefined ? this._displayOf(item) : String(cfg.value))
                : "";

            this.$input.val(text).attr("placeholder", cfg.placeholder);
            this.$clearBtn.toggle(!!cfg.showClearButton && cfg.value !== null && cfg.value !== undefined && !cfg.disabled && !cfg.readOnly);
        },

        // ---------------------------------------------------------------
        // Rozbalovací seznam položek
        // ---------------------------------------------------------------
        _renderDropdownItems: function () {
            var self = this;
            var cfg = this.config;
            this.$list.empty();

            var items = this._filteredItems();

            if (!items.length) {
                this.$list.append($("<div class='qpx-selectbox-nodata'></div>").text(cfg.noDataText));
                return;
            }

            items.forEach(function (item, idx) {
                var val = self._valueOf(item);
                var selected = self._valuesEqual(val, cfg.value);

                var $row = $("<div class='qpx-popup-list-item qpx-selectbox-item'></div>")
                    .toggleClass("qpx-state-selected", selected)
                    .toggleClass("qpx-state-highlighted", idx === self._highlightIndex);

                if (qpx.isFunction(cfg.itemTemplate)) {
                    var res = cfg.itemTemplate.call(self, item, idx, $row[0]);
                    if (res !== undefined && res !== null) { $row.append(res); }
                } else {
                    $row.append($("<span class='qpx-selectbox-item-text'></span>").text(self._displayOf(item)));
                }

                $row.on("mousedown.qpxSelectBox", function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    self._selectItem(item);
                });

                self.$list.append($row);
            });
        },

        _filteredItems: function () {
            var self = this;
            var cfg = this.config;
            var text = (this._searchText || "").toLowerCase();

            return (cfg.items || []).filter(function (item) {
                if (!text) { return true; }
                return self._displayOf(item).toLowerCase().indexOf(text) !== -1;
            });
        },

        // ---------------------------------------------------------------
        // Práce s hodnotou
        // ---------------------------------------------------------------
        _valueOf: function (item) {
            if (this.config.valueExpr && this.config.valueExpr !== "this") {
                return qpx.resolve(item, this.config.valueExpr);
            }
            return item;
        },

        _displayOf: function (item) {
            if (this.config.displayExpr) {
                var v = qpx.resolve(item, this.config.displayExpr);
                return (v === undefined || v === null) ? "" : String(v);
            }
            if (qpx.isObject(item)) { return item.text !== undefined ? String(item.text) : JSON.stringify(item); }
            return String(item);
        },

        _itemForValue: function (val) {
            var self = this;
            return (this.config.items || []).filter(function (it) { return self._valuesEqual(self._valueOf(it), val); })[0];
        },

        _valuesEqual: function (a, b) { return a === b; },

        _selectItem: function (item) {
            var val = this._valueOf(item);
            this.option("value", val);
            this.trigger("selectionChanged", { selectedItem: item, component: this });
            this.close();
            this.$input.trigger("focus");
        },

        _handleCustomItemCreating: function (text) {
            var cfg = this.config;
            if (!text) { return; }

            var createdItem;
            if (qpx.isFunction(cfg.onCustomItemCreating)) {
                var args = { text: text, component: this, customItem: undefined };
                var ret = cfg.onCustomItemCreating(args);
                createdItem = (args.customItem !== undefined) ? args.customItem : ret;
            }
            if (createdItem === undefined || createdItem === null) {
                if (!cfg.acceptCustomValue) { return; }
                createdItem = text;
            }

            if (cfg.items.indexOf(createdItem) === -1) { cfg.items.push(createdItem); }
            this._selectItem(createdItem);
        },

        // ---------------------------------------------------------------
        // Popup otevřít/zavřít
        // ---------------------------------------------------------------
        open: function () {
            if (this.config.disabled || this.config.readOnly || this._isOpen) { return this; }
            if (openInstance && openInstance !== this) { openInstance.close(); }

            this._renderDropdownItems();

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
            this._highlightIndex = -1;
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

        getSelectedItem: function () { return this._itemForValue(this.config.value); },
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
                case "value": {
                    this._renderField();
                    this.trigger("valueChanged", { value: value, previousValue: prev, component: this, element: this.getNode() });
                    break;
                }

                case "items":
                case "dataSource":
                    this.config.items = value || [];
                    this._renderField();
                    if (this._isOpen) { this._renderDropdownItems(); }
                    break;

                case "disabled":
                    this.$container.toggleClass("qpx-state-disabled", !!value);
                    this.$input.prop("disabled", !!value);
                    if (value) { this.close(); }
                    this._renderField();
                    break;

                case "readOnly":
                    this.$container.toggleClass("qpx-state-readonly", !!value);
                    this.$input.prop("readOnly", !!value || !this.config.searchEnabled);
                    if (value) { this.close(); }
                    this._renderField();
                    break;

                case "visible":
                    this.$container.toggleClass("qpx-hidden", !value);
                    break;

                case "stylingMode":
                    this.$container.removeClass("qpx-selectbox-mode-" + prev).addClass("qpx-selectbox-mode-" + value);
                    break;

                case "searchEnabled":
                    this.$input.prop("readOnly", !value || !!this.config.readOnly);
                    break;

                case "placeholder":
                case "showClearButton":
                    this._renderField();
                    break;

                case "noDataText":
                    if (this._isOpen) { this._renderDropdownItems(); }
                    break;
            }

            this.trigger("optionChanged", { name: name, value: value, previousValue: prev, component: this });
            return this;
        },

        destroy: function () {
            this.$container.off(".qpxSelectBox");
            if (this.$input) { this.$input.off(".qpxSelectBox"); }
            $(document).off(".qpxSelectBox" + this.id);
            if (this.$dropdown) { this.$dropdown.remove(); }
            if (openInstance === this) { openInstance = null; }
            this._super();
        }
    });

    qpx.registerWidget("qpSelectBox", SelectBox);
    qpx.qpSelectBox = SelectBox;

})(window.qpx, jQuery);
