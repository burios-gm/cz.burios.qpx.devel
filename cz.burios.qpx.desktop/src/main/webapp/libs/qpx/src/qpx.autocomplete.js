/*!
 * qpx - qpAutocomplete
 * Textové pole s automatickým našeptáváním položek podle psaného textu,
 * koncepčně i vzhledově co nejblíže DevExtreme dxAutocomplete. Na rozdíl
 * od qpSelectBox/qpLookup NENÍ výběr z nabídky vynucen — hodnotou je
 * vždy zadaný text, položka z nabídky jen text doplní.
 *
 * options:
 *   items / dataSource, displayExpr, value (text),
 *   placeholder, minSearchLength, searchTimeout, maxItemCount, noDataText,
 *   showClearButton, stylingMode ("outlined"|"filled"|"underlined"),
 *   disabled, readOnly, visible, itemTemplate, dropDownOptions
 *
 * events:
 *   onInitialized, onContentReady, onValueChanged, onSelectionChanged,
 *   onOpened, onClosed, onEnterKey, onOptionChanged, onDisposing
 *
 * methods:
 *   option(name[, value]), value([val]), open(), close(),
 *   getDataSource(), reset(), focus(), enable(), disable(), destroy()
 */
(function (qpx, $) {
    "use strict";

    var openInstance = null; // aktuálně otevřená instance (jen jedna najednou)

    var Autocomplete = qpx.Widget.extend({

        defaults: {
            dataSource: null,
            items: [],
            displayExpr: null,   // null = item.text, nebo přímo řetězec

            value: "",

            placeholder: "Zadejte text...",
            minSearchLength: 1,
            searchTimeout: 200,
            maxItemCount: undefined,
            noDataText: "Žádné položky",

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
            onEnterKey: null,
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
            cfg.value = cfg.value || "";

            this.$container
                .addClass("qpx-autocomplete")
                .addClass("qpx-autocomplete-mode-" + cfg.stylingMode)
                .toggleClass("qpx-hidden", !cfg.visible)
                .toggleClass("qpx-state-disabled", !!cfg.disabled)
                .toggleClass("qpx-state-readonly", !!cfg.readOnly)
                .attr("role", "combobox")
                .attr("aria-expanded", "false")
                .attr("aria-autocomplete", "list");

            if (cfg.onInitialized) { this.on("ready", cfg.onInitialized); }
            if (cfg.onContentReady) { this.on("contentReady", cfg.onContentReady); }
            if (cfg.onValueChanged) { this.on("valueChanged", cfg.onValueChanged); }
            if (cfg.onSelectionChanged) { this.on("selectionChanged", cfg.onSelectionChanged); }
            if (cfg.onOpened) { this.on("opened", cfg.onOpened); }
            if (cfg.onClosed) { this.on("closed", cfg.onClosed); }
            if (cfg.onEnterKey) { this.on("enterKey", cfg.onEnterKey); }
            if (cfg.onOptionChanged) { this.on("optionChanged", cfg.onOptionChanged); }
            if (cfg.onDisposing) { this.on("destroy", cfg.onDisposing); }

            this._isOpen = false;
            this._searchText = cfg.value;
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

            this.$input = $("<input type='text' class='qpx-autocomplete-input' autocomplete='off'>")
                .val(cfg.value)
                .attr("placeholder", cfg.placeholder)
                .prop("disabled", !!cfg.disabled)
                .prop("readOnly", !!cfg.readOnly);

            this.$clearBtn = $("<span class='qpx-autocomplete-clear' tabindex='-1' title='Vymazat'>✕</span>").hide();

            this.$container.append(this.$input, this.$clearBtn);

            this.$dropdown = $("<div class='qpx-popup-list qpx-autocomplete-dropdown'></div>").appendTo(document.body).hide();
            this.$list = $("<div class='qpx-autocomplete-list'></div>");
            this.$dropdown.append(this.$list);

            if (cfg.dropDownOptions && cfg.dropDownOptions.width) { this.$dropdown.css("width", qpx.toPx(cfg.dropDownOptions.width)); }
            if (cfg.dropDownOptions && cfg.dropDownOptions.maxHeight) { this.$list.css("max-height", qpx.toPx(cfg.dropDownOptions.maxHeight)); }

            this._renderField();
        },

        _bindEvents: function () {
            var self = this;
            var cfg = this.config;
            var searchTimer = null;

            this.$input.on("focus.qpxAutocomplete", function () {
                if (cfg.disabled || cfg.readOnly) { return; }
                self._searchText = self.$input.val();
                self._renderDropdownItems();
                self.open();
            });

            this.$input.on("input.qpxAutocomplete", function () {
                var val = this.value;
                clearTimeout(searchTimer);
                searchTimer = setTimeout(function () {
                    self._searchText = val;
                    self._highlightIndex = -1;
                    self._renderDropdownItems();
                    if (!self._isOpen) { self.open(); }
                    self.$clearBtn.toggle(!!cfg.showClearButton && val.length > 0);
                }, cfg.searchTimeout);
            });

            this.$input.on("keydown.qpxAutocomplete", function (e) {
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
                        if (self._highlightIndex > -1 && items[self._highlightIndex]) {
                            self._selectItem(items[self._highlightIndex]);
                        } else {
                            self._commitTypedValue();
                        }
                        self.trigger("enterKey", { component: self, event: e });
                        break;

                    case "Escape":
                        e.preventDefault();
                        self.close();
                        break;
                }
            });

            this.$input.on("blur.qpxAutocomplete", function () {
                // commit se řeší v mousedown handleru dokumentu (aby fungoval i klik na položku)
            });

            this.$clearBtn.on("click.qpxAutocomplete", function (e) {
                e.stopPropagation();
                if (cfg.disabled || cfg.readOnly) { return; }
                self.option("value", "");
                self.$input.trigger("focus");
            });

            $(document).on("mousedown.qpxAutocomplete" + this.id, function (e) {
                if (!self._isOpen) { return; }
                if ($(e.target).closest(self.$dropdown).length || $(e.target).closest(self.$container).length) { return; }
                self._commitTypedValue();
                self.close();
            });
        },

        _renderField: function () {
            var cfg = this.config;
            this.$input.val(cfg.value || "");
            this.$clearBtn.toggle(!!cfg.showClearButton && !!cfg.value);
        },

        // ---------------------------------------------------------------
        // Rozbalovací seznam návrhů
        // ---------------------------------------------------------------
        _renderDropdownItems: function () {
            var self = this;
            var cfg = this.config;
            this.$list.empty();

            var items = this._filteredItems();

            if (!items.length) {
                this.$list.append($("<div class='qpx-autocomplete-nodata'></div>").text(cfg.noDataText));
                return;
            }

            items.forEach(function (item, idx) {
                var $row = $("<div class='qpx-popup-list-item qpx-autocomplete-item'></div>")
                    .toggleClass("qpx-state-highlighted", idx === self._highlightIndex);

                if (qpx.isFunction(cfg.itemTemplate)) {
                    var res = cfg.itemTemplate.call(self, item, idx, $row[0]);
                    if (res !== undefined && res !== null) { $row.append(res); }
                } else {
                    $row.append($("<span class='qpx-autocomplete-item-text'></span>").text(self._displayOf(item)));
                }

                $row.on("mousedown.qpxAutocomplete", function (e) {
                    // mousedown místo click, aby předešlo blur/mousedown handleru dokumentu
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
            var text = (this._searchText || "");

            if (text.length < (cfg.minSearchLength || 0)) { return []; }

            var lower = text.toLowerCase();
            var result = (cfg.items || []).filter(function (item) {
                if (!lower) { return true; }
                return self._displayOf(item).toLowerCase().indexOf(lower) !== -1;
            });

            if (cfg.maxItemCount) { result = result.slice(0, cfg.maxItemCount); }
            return result;
        },

        _displayOf: function (item) {
            if (this.config.displayExpr) {
                var v = qpx.resolve(item, this.config.displayExpr);
                return (v === undefined || v === null) ? "" : String(v);
            }
            if (qpx.isObject(item)) { return item.text !== undefined ? String(item.text) : JSON.stringify(item); }
            return String(item);
        },

        _selectItem: function (item) {
            var text = this._displayOf(item);
            this.option("value", text);
            this.trigger("selectionChanged", { item: item, component: this });
            this.close();
            this.$input.trigger("focus");
        },

        _commitTypedValue: function () {
            var text = this.$input.val();
            if (text !== this.config.value) { this.option("value", text); }
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

        getDataSource: function () { return this.config.items; },
        reset: function () { return this.option("value", ""); },
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
                    this._searchText = value || "";
                    this._renderField();
                    this.trigger("valueChanged", { value: value, previousValue: prev, component: this, element: this.getNode() });
                    break;

                case "items":
                case "dataSource":
                    this.config.items = value || [];
                    if (this._isOpen) { this._renderDropdownItems(); }
                    break;

                case "disabled":
                    this.$container.toggleClass("qpx-state-disabled", !!value);
                    this.$input.prop("disabled", !!value);
                    if (value) { this.close(); }
                    break;

                case "readOnly":
                    this.$container.toggleClass("qpx-state-readonly", !!value);
                    this.$input.prop("readOnly", !!value);
                    if (value) { this.close(); }
                    break;

                case "visible":
                    this.$container.toggleClass("qpx-hidden", !value);
                    break;

                case "stylingMode":
                    this.$container.removeClass("qpx-autocomplete-mode-" + prev).addClass("qpx-autocomplete-mode-" + value);
                    break;

                case "placeholder":
                    this.$input.attr("placeholder", value);
                    break;

                case "showClearButton":
                    this._renderField();
                    break;

                case "minSearchLength":
                case "maxItemCount":
                case "noDataText":
                    if (this._isOpen) { this._renderDropdownItems(); }
                    break;
            }

            this.trigger("optionChanged", { name: name, value: value, previousValue: prev, component: this });
            return this;
        },

        destroy: function () {
            this.$container.off(".qpxAutocomplete");
            if (this.$input) { this.$input.off(".qpxAutocomplete"); }
            $(document).off(".qpxAutocomplete" + this.id);
            if (this.$dropdown) { this.$dropdown.remove(); }
            if (openInstance === this) { openInstance = null; }
            this._super();
        }
    });

    qpx.registerWidget("qpAutocomplete", Autocomplete);
    qpx.qpAutocomplete = Autocomplete;

})(window.qpx, jQuery);
