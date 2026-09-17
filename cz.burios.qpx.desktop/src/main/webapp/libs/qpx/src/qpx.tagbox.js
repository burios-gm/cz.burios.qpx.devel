/*!
 * qpx - qpTagBox
 * Vícenásobný výběr položek zobrazený jako "tagy" v poli, koncepčně
 * i vzhledově co nejblíže DevExtreme dxTagBox (kombinace textového
 * pole s vyhledáváním + rozbalovacího seznamu položek s možností
 * vícenásobného výběru).
 *
 * options:
 *   items / dataSource, valueExpr, displayExpr, value (pole hodnot),
 *   placeholder, searchEnabled, searchTimeout, minSearchLength, noDataText,
 *   multiline, maxDisplayedTags, showMultiTagOnly,
 *   showSelectionControls, hideSelectedItems, acceptCustomValue,
 *   showClearButton, stylingMode ("outlined"|"filled"|"underlined"),
 *   disabled, readOnly, visible, tagTemplate, itemTemplate, dropDownOptions
 *
 * events:
 *   onInitialized, onContentReady, onValueChanged, onSelectionChanged,
 *   onOpened, onClosed, onCustomItemCreating, onOptionChanged, onDisposing
 *
 * methods:
 *   option(name[, value]), value([val]), open(), close(),
 *   getSelectedItems(), getDataSource(), reset(), focus(),
 *   enable(), disable(), destroy()
 */
(function (qpx, $) {
    "use strict";

    var openInstance = null; // aktuálně otevřená instance (jen jedna najednou)

    var TagBox = qpx.Widget.extend({

        defaults: {
            dataSource: null,
            items: [],
            valueExpr: null,      // null = "this" (celá položka je hodnota)
            displayExpr: null,    // null = item.text, nebo JSON.stringify

            value: [],

            placeholder: "Vyberte...",
            searchEnabled: true,
            searchTimeout: 200,
            minSearchLength: 0,
            noDataText: "Žádné položky",

            multiline: true,           // false = jeden řádek se scrollem místo zalamování tagů
            maxDisplayedTags: undefined,
            showMultiTagOnly: false,   // true = místo jednotlivých tagů jen "N vybráno"

            showSelectionControls: false, // "Vybrat vše" / "Zrušit výběr" v popupu
            hideSelectedItems: false,
            acceptCustomValue: false,

            showClearButton: false,
            stylingMode: "outlined",  // outlined | filled | underlined

            disabled: false,
            readOnly: false,
            visible: true,

            tagTemplate: null,   // function(tagData:{value,item}, tagIndex, tagElement)
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
            cfg.value = cfg.value || [];

            this.$container
                .addClass("qpx-tagbox")
                .addClass("qpx-tagbox-mode-" + cfg.stylingMode)
                .toggleClass("qpx-hidden", !cfg.visible)
                .toggleClass("qpx-state-disabled", !!cfg.disabled)
                .toggleClass("qpx-state-readonly", !!cfg.readOnly)
                .attr("role", "combobox")
                .attr("aria-expanded", "false")
                .attr("aria-multiselectable", "true");

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

            this.$field = $("<div class='qpx-tagbox-field'></div>");
            this.$searchInput = $("<input type='text' class='qpx-tagbox-search' autocomplete='off'>")
                .prop("disabled", !!cfg.disabled)
                .prop("readOnly", !!cfg.readOnly || !cfg.searchEnabled);

            this.$clearBtn = $("<span class='qpx-tagbox-clear' tabindex='-1' title='Vymazat výběr'>✕</span>").hide();
            this.$arrow = $("<span class='qpx-tagbox-arrow'>▾</span>");

            this.$container.append(this.$field, this.$clearBtn, this.$arrow);

            this.$dropdown = $("<div class='qpx-popup-list qpx-tagbox-dropdown'></div>").appendTo(document.body).hide();
            this.$list = $("<div class='qpx-tagbox-list'></div>");
            this.$dropdown.append(this.$list);

            if (cfg.dropDownOptions && cfg.dropDownOptions.width) { this.$dropdown.css("width", qpx.toPx(cfg.dropDownOptions.width)); }
            if (cfg.dropDownOptions && cfg.dropDownOptions.maxHeight) { this.$list.css("max-height", qpx.toPx(cfg.dropDownOptions.maxHeight)); }

            this._renderField();
            this._renderDropdownItems();
        },

        _bindEvents: function () {
            var self = this;
            var cfg = this.config;

            this.$container.on("click.qpxTagBox", function (e) {
                if (cfg.disabled) { return; }
                if ($(e.target).closest(".qpx-tagbox-tag-remove, .qpx-tagbox-clear").length) { return; }
                self.$searchInput.trigger("focus");
                if (!cfg.readOnly) { self.open(); }
            });

            this.$searchInput.on("focus.qpxTagBox", function () {
                if (!cfg.disabled && !cfg.readOnly) { self.open(); }
            });

            var searchTimer = null;
            this.$searchInput.on("input.qpxTagBox", function () {
                var val = this.value;
                clearTimeout(searchTimer);
                searchTimer = setTimeout(function () {
                    self._searchText = (val.length >= (cfg.minSearchLength || 0)) ? val : "";
                    self._highlightIndex = -1;
                    self._renderDropdownItems();
                    if (!self._isOpen) { self.open(); }
                }, cfg.searchTimeout);
            });

            this.$searchInput.on("keydown.qpxTagBox", function (e) {
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
                            self._toggleItem(items[self._highlightIndex]);
                        } else if (cfg.acceptCustomValue && this.value.trim()) {
                            self._handleCustomItemCreating(this.value.trim());
                        }
                        break;

                    case "Escape":
                        e.preventDefault();
                        self.close();
                        break;

                    case "Backspace":
                        if (!this.value && cfg.value.length) {
                            e.preventDefault();
                            self._removeValue(cfg.value[cfg.value.length - 1]);
                        }
                        break;
                }
            });

            this.$arrow.on("click.qpxTagBox", function (e) {
                e.stopPropagation();
                if (cfg.disabled || cfg.readOnly) { return; }
                if (self._isOpen) { self.close(); } else { self.$searchInput.trigger("focus"); self.open(); }
            });

            this.$clearBtn.on("click.qpxTagBox", function (e) {
                e.stopPropagation();
                if (cfg.disabled || cfg.readOnly) { return; }
                self.option("value", []);
            });

            $(document).on("mousedown.qpxTagBox" + this.id, function (e) {
                if (!self._isOpen) { return; }
                if ($(e.target).closest(self.$dropdown).length || $(e.target).closest(self.$container).length) { return; }
                self.close();
            });
        },

        // ---------------------------------------------------------------
        // Vykreslení pole s tagy
        // ---------------------------------------------------------------
        _renderField: function () {
            var self = this;
            var cfg = this.config;
            this.$field.empty();

            var values = cfg.value || [];
            var useMultiTagOnly = cfg.showMultiTagOnly && values.length > 0;
            var limit = (cfg.maxDisplayedTags !== undefined && cfg.maxDisplayedTags !== null) ? cfg.maxDisplayedTags : values.length;

            if (useMultiTagOnly) {
                this._appendSummaryTag(values.length + " vybráno");
            } else {
                values.slice(0, limit).forEach(function (val) { self._appendTag(val); });
                if (values.length > limit) { this._appendSummaryTag("+" + (values.length - limit)); }
            }

            this.$field.toggleClass("qpx-tagbox-field-multiline", !!cfg.multiline);
            this.$searchInput.attr("placeholder", values.length ? "" : cfg.placeholder);
            this.$field.append(this.$searchInput);

            this.$clearBtn.toggle(!!cfg.showClearButton && values.length > 0 && !cfg.disabled && !cfg.readOnly);
        },

        _appendTag: function (val) {
            var self = this;
            var cfg = this.config;
            var item = this._itemForValue(val);
            var $tag = $("<span class='qpx-tagbox-tag'></span>");

            if (qpx.isFunction(cfg.tagTemplate)) {
                var result = cfg.tagTemplate.call(this, { value: val, item: item }, 0, $tag[0]);
                if (result !== undefined && result !== null) { $tag.append(result); }
            } else {
                $tag.append($("<span class='qpx-tagbox-tag-text'></span>").text(item !== undefined ? this._displayOf(item) : String(val)));
                if (!cfg.disabled && !cfg.readOnly) {
                    var $remove = $("<span class='qpx-tagbox-tag-remove' tabindex='-1'>✕</span>");
                    $remove.on("click.qpxTagBox", function (e) { e.stopPropagation(); self._removeValue(val); });
                    $tag.append($remove);
                }
            }

            this.$field.append($tag);
        },

        _appendSummaryTag: function (text) {
            this.$field.append($("<span class='qpx-tagbox-tag qpx-tagbox-tag-summary'></span>").text(text));
        },

        // ---------------------------------------------------------------
        // Rozbalovací seznam položek
        // ---------------------------------------------------------------
        _renderDropdownItems: function () {
            var self = this;
            var cfg = this.config;
            this.$list.empty();

            if (cfg.showSelectionControls) {
                var $ctrl = $("<div class='qpx-tagbox-selection-controls'></div>");
                $ctrl.append(
                    $("<span class='qpx-tagbox-select-all'></span>").text("Vybrat vše")
                        .on("click.qpxTagBox", function (e) { e.stopPropagation(); self._selectAllFiltered(); }),
                    $("<span class='qpx-tagbox-clear-all'></span>").text("Zrušit výběr")
                        .on("click.qpxTagBox", function (e) { e.stopPropagation(); self.option("value", []); })
                );
                this.$list.append($ctrl);
            }

            var items = this._filteredItems();

            if (!items.length) {
                this.$list.append($("<div class='qpx-tagbox-nodata'></div>").text(cfg.noDataText));
                return;
            }

            items.forEach(function (item, idx) {
                var val = self._valueOf(item);
                var selected = self._indexOfValue(val) !== -1;

                var $row = $("<div class='qpx-popup-list-item qpx-tagbox-item'></div>")
                    .toggleClass("qpx-state-selected", selected)
                    .toggleClass("qpx-state-highlighted", idx === self._highlightIndex);

                $row.append($("<span class='qpx-tagbox-item-check'></span>"));

                if (qpx.isFunction(cfg.itemTemplate)) {
                    var res = cfg.itemTemplate.call(self, item, idx, $row[0]);
                    if (res !== undefined && res !== null) { $row.append(res); }
                } else {
                    $row.append($("<span class='qpx-tagbox-item-text'></span>").text(self._displayOf(item)));
                }

                $row.on("click.qpxTagBox", function (e) {
                    e.stopPropagation();
                    self._toggleItem(item);
                    self.$searchInput.trigger("focus");
                });

                self.$list.append($row);
            });
        },

        _filteredItems: function () {
            var self = this;
            var cfg = this.config;
            var text = (this._searchText || "").toLowerCase();

            return (cfg.items || []).filter(function (item) {
                if (cfg.hideSelectedItems && self._indexOfValue(self._valueOf(item)) !== -1) { return false; }
                if (!text) { return true; }
                return self._displayOf(item).toLowerCase().indexOf(text) !== -1;
            });
        },

        // ---------------------------------------------------------------
        // Popup otevřít/zavřít
        // ---------------------------------------------------------------
        open: function () {
            if (this.config.disabled || this._isOpen) { return this; }
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
        // Práce s hodnotami / výběrem
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

        _itemsForValues: function (values) {
            var self = this;
            return values.map(function (v) {
                var found = self._itemForValue(v);
                return found !== undefined ? found : v;
            });
        },

        _indexOfValue: function (val) {
            var arr = this.config.value || [];
            for (var i = 0; i < arr.length; i++) { if (arr[i] === val) { return i; } }
            return -1;
        },

        _toggleItem: function (item) {
            var val = this._valueOf(item);
            var arr = (this.config.value || []).slice();
            var idx = arr.indexOf(val);
            if (idx === -1) { arr.push(val); } else { arr.splice(idx, 1); }
            this.option("value", arr);
        },

        _removeValue: function (val) {
            var arr = (this.config.value || []).slice();
            var idx = arr.indexOf(val);
            if (idx === -1) { return; }
            arr.splice(idx, 1);
            this.option("value", arr);
        },

        _selectAllFiltered: function () {
            var self = this;
            var arr = (this.config.value || []).slice();
            this._filteredItems().forEach(function (item) {
                var val = self._valueOf(item);
                if (arr.indexOf(val) === -1) { arr.push(val); }
            });
            this.option("value", arr);
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
            this._toggleItem(createdItem);

            this.$searchInput.val("");
            this._searchText = "";
            this._renderDropdownItems();
        },

        // ---------------------------------------------------------------
        // Veřejné API
        // ---------------------------------------------------------------
        // value() -> čtení pole vybraných hodnot; value(pole) -> zápis (zkratka za option("value", ...))
        value: function (val) {
            if (arguments.length === 0) { return (this.config.value || []).slice(); }
            return this.option("value", val);
        },

        getSelectedItems: function () { return this._itemsForValues((this.config.value || []).slice()); },
        getDataSource: function () { return this.config.items; },
        reset: function () { return this.option("value", []); },
        focus: function () { this.$searchInput.trigger("focus"); return this; },
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
                    var prevArr = (prev || []).slice();
                    var newArr = value || [];
                    this.config.value = newArr;
                    this._renderField();
                    this._renderDropdownItems();

                    this.trigger("valueChanged", { value: newArr.slice(), previousValue: prevArr, component: this, element: this.getNode() });

                    var added = newArr.filter(function (v) { return prevArr.indexOf(v) === -1; });
                    var removed = prevArr.filter(function (v) { return newArr.indexOf(v) === -1; });
                    if (added.length || removed.length) {
                        this.trigger("selectionChanged", { addedItems: this._itemsForValues(added), removedItems: this._itemsForValues(removed), component: this });
                    }
                    break;
                }

                case "items":
                case "dataSource":
                    this.config.items = value || [];
                    this._renderField();
                    this._renderDropdownItems();
                    break;

                case "disabled":
                    this.$container.toggleClass("qpx-state-disabled", !!value);
                    this.$searchInput.prop("disabled", !!value);
                    if (value) { this.close(); }
                    this._renderField();
                    break;

                case "readOnly":
                    this.$container.toggleClass("qpx-state-readonly", !!value);
                    this.$searchInput.prop("readOnly", !!value || !this.config.searchEnabled);
                    this._renderField();
                    break;

                case "visible":
                    this.$container.toggleClass("qpx-hidden", !value);
                    break;

                case "stylingMode":
                    this.$container.removeClass("qpx-tagbox-mode-" + prev).addClass("qpx-tagbox-mode-" + value);
                    break;

                case "searchEnabled":
                    this.$searchInput.prop("readOnly", !value || !!this.config.readOnly);
                    break;

                case "placeholder":
                case "maxDisplayedTags":
                case "showMultiTagOnly":
                case "showClearButton":
                case "multiline":
                    this._renderField();
                    break;

                case "hideSelectedItems":
                case "showSelectionControls":
                case "noDataText":
                    this._renderDropdownItems();
                    break;
            }

            this.trigger("optionChanged", { name: name, value: value, previousValue: prev, component: this });
            return this;
        },

        destroy: function () {
            this.$container.off(".qpxTagBox");
            if (this.$searchInput) { this.$searchInput.off(".qpxTagBox"); }
            $(document).off(".qpxTagBox" + this.id);
            if (this.$dropdown) { this.$dropdown.remove(); }
            if (openInstance === this) { openInstance = null; }
            this._super();
        }
    });

    qpx.registerWidget("qpTagBox", TagBox);
    qpx.qpTagBox = TagBox;

})(window.qpx, jQuery);
