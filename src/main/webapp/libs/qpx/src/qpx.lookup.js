/*!
 * qpx - qpLookup
 * Výběr jedné položky ze seznamu, koncepčně i vzhledově co nejblíže
 * DevExtreme dxLookup. Na rozdíl od qpSelectBox se nabídka neotvírá
 * jako úzký dropdown pod polem, ale jako VYSTŘEDĚNÝ POPUP s titulkem,
 * vlastním vyhledávacím polem v hlavičce a (volitelně) tlačítky
 * Hotovo/Zrušit dole (applyValueMode: "useButtons").
 *
 * options:
 *   items / dataSource, valueExpr, displayExpr, value,
 *   placeholder, title, searchEnabled, searchTimeout, minSearchLength,
 *   searchPlaceholder, noDataText, applyValueMode ("instantly"|"useButtons"),
 *   cancelText, doneText, showClearButton,
 *   stylingMode ("outlined"|"filled"|"underlined"),
 *   disabled, readOnly, visible, itemTemplate, dropDownOptions
 *
 * events:
 *   onInitialized, onContentReady, onValueChanged, onSelectionChanged,
 *   onOpened, onClosed, onOptionChanged, onDisposing
 *
 * methods:
 *   option(name[, value]), value([val]), open(), close(),
 *   getSelectedItem(), getDataSource(), reset(), focus(),
 *   enable(), disable(), destroy()
 */
(function (qpx, $) {
    "use strict";

    var openInstance = null; // aktuálně otevřená instance (jen jedna najednou)

    var Lookup = qpx.Widget.extend({

        defaults: {
            dataSource: null,
            items: [],
            valueExpr: null,
            displayExpr: null,

            value: null,

            placeholder: "Vyberte...",
            title: "Vyberte položku",

            searchEnabled: true,
            searchTimeout: 200,
            minSearchLength: 0,
            searchPlaceholder: "Hledat...",
            noDataText: "Žádné položky",

            applyValueMode: "instantly", // instantly | useButtons
            cancelText: "Zrušit",
            doneText: "Hotovo",

            showClearButton: false,
            stylingMode: "outlined",  // outlined | filled | underlined

            disabled: false,
            readOnly: false,
            visible: true,

            itemTemplate: null,  // function(itemData, itemIndex, itemElement)
            dropDownOptions: {}, // { width, height }

            onValueChanged: null,
            onSelectionChanged: null,
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
                .addClass("qpx-lookup")
                .addClass("qpx-lookup-mode-" + cfg.stylingMode)
                .toggleClass("qpx-hidden", !cfg.visible)
                .toggleClass("qpx-state-disabled", !!cfg.disabled)
                .toggleClass("qpx-state-readonly", !!cfg.readOnly)
                .attr("role", "button")
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
            this._pendingValue = cfg.value; // rozpracovaný výběr v režimu "useButtons"

            this._buildDom();
            this._bindEvents();

            setTimeout(function () { self.trigger("contentReady", { component: self }); }, 0);
        },

        // ---------------------------------------------------------------
        // DOM — pole v řádku stránky
        // ---------------------------------------------------------------
        _buildDom: function () {
            var cfg = this.config;
            this.$container.empty();

            this.$input = $("<input type='text' class='qpx-lookup-input' readonly autocomplete='off'>")
                .prop("disabled", !!cfg.disabled);

            this.$clearBtn = $("<span class='qpx-lookup-clear' tabindex='-1' title='Vymazat výběr'>✕</span>").hide();
            this.$arrow = $("<span class='qpx-lookup-arrow'>▾</span>");

            this.$container.append(this.$input, this.$clearBtn, this.$arrow);

            this._buildPopup();
            this._renderField();
        },

        // DOM — vystředěný popup (overlay + hlavička s titulkem/hledáním + seznam + patička)
        _buildPopup: function () {
            var cfg = this.config;

            this.$overlay = $("<div class='qpx-lookup-overlay'></div>").appendTo(document.body).hide();
            this.$popup = $("<div class='qpx-popup-surface qpx-lookup-popup'></div>").appendTo(this.$overlay);

            if (cfg.dropDownOptions && cfg.dropDownOptions.width) { this.$popup.css("width", qpx.toPx(cfg.dropDownOptions.width)); }
            if (cfg.dropDownOptions && cfg.dropDownOptions.height) { this.$popup.css("height", qpx.toPx(cfg.dropDownOptions.height)); }

            this.$header = $("<div class='qpx-lookup-header'></div>");
            this.$title = $("<div class='qpx-lookup-title'></div>").text(cfg.title);
            this.$closeIcon = $("<span class='qpx-lookup-close' title='Zavřít'>✕</span>");
            this.$header.append(this.$title, this.$closeIcon);

            this.$searchWrap = $("<div class='qpx-lookup-search-wrap'></div>");
            this.$searchInput = $("<input type='text' class='qpx-lookup-search' autocomplete='off'>")
                .attr("placeholder", cfg.searchPlaceholder);
            this.$searchWrap.append(this.$searchInput);

            this.$list = $("<div class='qpx-lookup-list'></div>");

            this.$footer = $("<div class='qpx-lookup-footer'></div>");
            this.$cancelBtn = $("<button type='button' class='qpx-lookup-btn qpx-lookup-btn-cancel'></button>").text(cfg.cancelText);
            this.$doneBtn = $("<button type='button' class='qpx-lookup-btn qpx-lookup-btn-done'></button>").text(cfg.doneText);
            this.$footer.append(this.$cancelBtn, this.$doneBtn);

            this.$popup.append(this.$header, this.$searchWrap, this.$list, this.$footer);

            this.$searchWrap.toggle(!!cfg.searchEnabled);
            this.$footer.toggle(cfg.applyValueMode === "useButtons");
        },

        _bindEvents: function () {
            var self = this;
            var cfg = this.config;

            this.$container.on("click.qpxLookup", function (e) {
                if (cfg.disabled || cfg.readOnly) { return; }
                if ($(e.target).closest(".qpx-lookup-clear").length) { return; }
                self.open();
            });

            this.$clearBtn.on("click.qpxLookup", function (e) {
                e.stopPropagation();
                if (cfg.disabled || cfg.readOnly) { return; }
                self.option("value", null);
            });

            var searchTimer = null;
            this.$searchInput.on("input.qpxLookup", function () {
                var val = this.value;
                clearTimeout(searchTimer);
                searchTimer = setTimeout(function () {
                    self._searchText = (val.length >= (cfg.minSearchLength || 0)) ? val : "";
                    self._highlightIndex = -1;
                    self._renderList();
                }, cfg.searchTimeout);
            });

            this.$searchInput.on("keydown.qpxLookup", function (e) {
                if (e.key === "Escape") { self.close(); }
            });

            this.$closeIcon.on("click.qpxLookup", function () { self.close(); });

            this.$overlay.on("mousedown.qpxLookup", function (e) {
                if ($(e.target).is(self.$overlay)) { self.close(); }
            });

            this.$cancelBtn.on("click.qpxLookup", function () {
                self._pendingValue = self.config.value;
                self.close();
            });

            this.$doneBtn.on("click.qpxLookup", function () {
                self.option("value", self._pendingValue);
                self.close();
            });

            $(document).on("keydown.qpxLookup" + this.id, function (e) {
                if (self._isOpen && e.key === "Escape") { self.close(); }
            });
        },

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
        // Seznam položek v popupu
        // ---------------------------------------------------------------
        _renderList: function () {
            var self = this;
            var cfg = this.config;
            this.$list.empty();

            var items = this._filteredItems();
            var activeValue = (cfg.applyValueMode === "useButtons") ? this._pendingValue : cfg.value;

            if (!items.length) {
                this.$list.append($("<div class='qpx-lookup-nodata'></div>").text(cfg.noDataText));
                return;
            }

            items.forEach(function (item, idx) {
                var val = self._valueOf(item);
                var selected = val === activeValue;

                var $row = $("<div class='qpx-popup-list-item qpx-lookup-item'></div>")
                    .toggleClass("qpx-state-selected", selected)
                    .toggleClass("qpx-state-highlighted", idx === self._highlightIndex);

                if (qpx.isFunction(cfg.itemTemplate)) {
                    var res = cfg.itemTemplate.call(self, item, idx, $row[0]);
                    if (res !== undefined && res !== null) { $row.append(res); }
                } else {
                    $row.append($("<span class='qpx-lookup-item-text'></span>").text(self._displayOf(item)));
                }

                $row.on("click.qpxLookup", function () { self._chooseItem(item); });

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
            return (this.config.items || []).filter(function (it) { return self._valueOf(it) === val; })[0];
        },

        _chooseItem: function (item) {
            var val = this._valueOf(item);
            var cfg = this.config;

            if (cfg.applyValueMode === "useButtons") {
                this._pendingValue = val;
                this.trigger("selectionChanged", { selectedItem: item, component: this });
                this._renderList();
            } else {
                this.option("value", val);
                this.trigger("selectionChanged", { selectedItem: item, component: this });
                this.close();
            }
        },

        // ---------------------------------------------------------------
        // Popup otevřít/zavřít
        // ---------------------------------------------------------------
        open: function () {
            if (this.config.disabled || this.config.readOnly || this._isOpen) { return this; }
            if (openInstance && openInstance !== this) { openInstance.close(); }

            this._pendingValue = this.config.value;
            this._searchText = "";
            this.$searchInput.val("");
            this._renderList();

            this.$overlay.show();
            this._isOpen = true;
            this.$container.attr("aria-expanded", "true");
            openInstance = this;

            if (this.config.searchEnabled) { this.$searchInput.trigger("focus"); }

            this.trigger("opened", { component: this });
            return this;
        },

        close: function () {
            if (!this._isOpen) { return this; }
            this.$overlay.hide();
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
                case "value":
                    this._pendingValue = value;
                    this._renderField();
                    this.trigger("valueChanged", { value: value, previousValue: prev, component: this, element: this.getNode() });
                    break;

                case "items":
                case "dataSource":
                    this.config.items = value || [];
                    this._renderField();
                    if (this._isOpen) { this._renderList(); }
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
                    this.$container.removeClass("qpx-lookup-mode-" + prev).addClass("qpx-lookup-mode-" + value);
                    break;

                case "placeholder":
                case "showClearButton":
                    this._renderField();
                    break;

                case "title":
                    this.$title.text(value);
                    break;

                case "searchEnabled":
                    this.$searchWrap.toggle(!!value);
                    break;

                case "searchPlaceholder":
                    this.$searchInput.attr("placeholder", value);
                    break;

                case "applyValueMode":
                    this.$footer.toggle(value === "useButtons");
                    break;

                case "cancelText":
                    this.$cancelBtn.text(value);
                    break;

                case "doneText":
                    this.$doneBtn.text(value);
                    break;

                case "noDataText":
                    if (this._isOpen) { this._renderList(); }
                    break;
            }

            this.trigger("optionChanged", { name: name, value: value, previousValue: prev, component: this });
            return this;
        },

        destroy: function () {
            this.$container.off(".qpxLookup");
            $(document).off(".qpxLookup" + this.id);
            if (this.$overlay) { this.$overlay.remove(); }
            if (openInstance === this) { openInstance = null; }
            this._super();
        }
    });

    qpx.registerWidget("qpLookup", Lookup);
    qpx.qpLookup = Lookup;

})(window.qpx, jQuery);
