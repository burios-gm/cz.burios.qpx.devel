/*!
 * qpx - qpPropertyGrid
 * PropertyGrid, funkčností co nejblíže jQuery EasyUI PropertyGrid
 * (rozšíření EasyUI DataGrid o 2 sloupce name/value a "editor" per-řádek):
 *
 *   - data se načítají jako pole řádků NEBO objekt { rows: [...] },
 *     stejně jako EasyUI ( data.rows / loadData(data) ),
 *   - showGroup + groupField seskupují řádky do "group" pásů uvnitř
 *     JEDNÉ tabulky (<tr colspan="2">, přesně jako EasyUI datagrid
 *     group-row), a tyto skupiny jsou VOLITELNĚ SBALITELNÉ kliknutím
 *     na hlavičku (collapsible) — v původní EasyUI-inspirované verzi
 *     tohle chybělo (byly to jen vizuální oddíly bez collapse),
 *   - columns: [{field:'name'|'value', title, width}] (i vnořené
 *     columns:[[...]] jako u EasyUI datagrid) mění hlavičku/šířku,
 *   - editor u položky lze zapsat jako řetězec ("text","numberbox",
 *     "checkbox","combobox","datebox"...) NEBO jako EasyUI-styl objekt
 *     { type:"combobox", options:{ data:[...], valueField, textField } },
 *   - loadData(data) / getData() — stejná jména metod jako v EasyUI.
 *
 * Zpětná kompatibilita: showCategories/categoryField a starší editor
 * "dropdown" (přes qpDropDownButton) i nadále fungují beze změny — jsou
 * jen alias/legacy cesta vedle nových showGroup/groupField/combobox.
 *
 * Vzhled (widgets/_propertygrid.scss) zůstává v duchu zadání z
 * minulého kroku — Kendo UI "Classic" (Silver) / dark, postavené jen
 * na stávajících --qpx-* proměnných; jen doplněno o styl nového
 * sbalitelného group-row.
 *
 * options:
 *   items / data ([{...}] nebo {rows:[...]}),
 *   showCategories / showGroup, categoryField / groupField,
 *   collapsible, collapsedGroups,
 *   showHeader, nameHeader, valueHeader, nameColumnWidth, columns,
 *   readOnly, disabled, visible
 *
 * events:
 *   onInitialized, onContentReady, onValueChanged, onItemChanged,
 *   onRowClick, onGroupToggle, onOptionChanged, onDisposing
 *
 * methods:
 *   option(name[, value]), loadData(data), getData(), getValues(), setValues(obj),
 *   collapseGroup(name), expandGroup(name), collapseAll(), expandAll(),
 *   refresh(), enable(), disable(), destroy()
 */
(function (qpx, $) {
    "use strict";

    function isPlainArray(v) { return Object.prototype.toString.call(v) === "[object Array]"; }

    var PropertyGrid = qpx.Widget.extend({

        defaults: {
            items: [],
            data: null, // alias pro items — přijímá i EasyUI tvar {rows:[...]}

            readOnly: false,

            showCategories: true,   // EasyUI: showGroup (alias, viz níže)
            categoryField: "category", // EasyUI: groupField (alias, viz níže)
            collapsible: true,      // skupiny lze kliknutím sbalit/rozbalit
            collapsedGroups: [],    // názvy skupin, které mají být zpočátku sbalené

            showHeader: true,
            nameHeader: "Vlastnost",  // EasyUI columns[].title pro field:"name"
            valueHeader: "Hodnota",   // EasyUI columns[].title pro field:"value"
            nameColumnWidth: "38%",
            columns: null, // volitelně: [{field:"name"|"value", title, width}] (i vnořené [[...]])

            disabled: false,
            visible: true,

            onValueChanged: null,
            onItemChanged: null,
            onRowClick: null,
            onGroupToggle: null,
            onOptionChanged: null,
            onInitialized: null,
            onContentReady: null,
            onDisposing: null
        },

        // ---------------------------------------------------------------
        render: function () {
            var cfg = this.config;
            var self = this;

            // -- EasyUI-style aliasy: showGroup/groupField, data/items --------
            if (cfg.showGroup !== undefined) { cfg.showCategories = !!cfg.showGroup; }
            if (cfg.groupField) { cfg.categoryField = cfg.groupField; }
            cfg.items = this._normalizeItems(cfg.data || cfg.items);

            this.$container
                .addClass("qpx-propertygrid")
                .toggleClass("qpx-hidden", !cfg.visible)
                .toggleClass("qpx-state-disabled", !!cfg.disabled);

            if (cfg.onValueChanged) { this.on("valueChanged", cfg.onValueChanged); }
            if (cfg.onItemChanged) { this.on("itemChanged", cfg.onItemChanged); }
            if (cfg.onRowClick) { this.on("rowClick", cfg.onRowClick); }
            if (cfg.onGroupToggle) { this.on("groupToggle", cfg.onGroupToggle); }
            if (cfg.onOptionChanged) { this.on("optionChanged", cfg.onOptionChanged); }
            if (cfg.onInitialized) { this.on("ready", cfg.onInitialized); }
            if (cfg.onContentReady) { this.on("contentReady", cfg.onContentReady); }
            if (cfg.onDisposing) { this.on("destroy", cfg.onDisposing); }

            this._editorInstances = [];
            this._collapsed = (cfg.collapsedGroups || []).slice();
            this._groupRows = {};       // groupName -> [ $tr, $tr, ... ]
            this._groupHeaderEls = {};  // groupName -> $tr (group-row)
            this._nameColWidth = cfg.nameColumnWidth;

            this._applyColumnsConfig();
            this._renderGrid();

            setTimeout(function () { self.trigger("contentReady", { component: self }); }, 0);
        },

        // znovu-vykreslení BEZ opětovné registrace event handlerů
        // (base Widget.refresh() by volal render() znovu -> duplicitní .on(...))
        refresh: function () {
            this._renderGrid();
            return this;
        },

        // ---------------------------------------------------------------
        // Normalizace vstupních dat — přijímá pole i EasyUI tvar {rows:[...]}
        // ---------------------------------------------------------------
        _normalizeItems: function (data) {
            if (isPlainArray(data)) { return data; }
            if (data && isPlainArray(data.rows)) { return data.rows; }
            return [];
        },

        // columns:[{field,title,width}] (i vnořené columns:[[...]] jako EasyUI datagrid)
        _applyColumnsConfig: function () {
            var cfg = this.config;
            var cols = cfg.columns;
            if (!cols || !cols.length) { return; }
            if (isPlainArray(cols[0])) { cols = cols[0]; }

            var nameCol = cols.filter(function (c) { return c.field === "name"; })[0] || cols[0];
            var valueCol = cols.filter(function (c) { return c.field === "value"; })[0] || cols[1];

            if (nameCol) {
                if (nameCol.title) { cfg.nameHeader = nameCol.title; }
                if (nameCol.width) { this._nameColWidth = qpx.toPx(nameCol.width); }
            }
            if (valueCol && valueCol.title) { cfg.valueHeader = valueCol.title; }
        },

        // ---------------------------------------------------------------
        // Vykreslení — JEDNA tabulka, skupiny jako <tr colspan="2">
        // (stejná stavba jako EasyUI datagrid group-row)
        // ---------------------------------------------------------------
        _renderGrid: function () {
            var self = this;
            var cfg = this.config;

            this._destroyEditors();
            this.$container.empty();
            this._groupRows = {};
            this._groupHeaderEls = {};

            var $table = $("<table class='qpx-pg-table'></table>");

            var $colgroup = $("<colgroup></colgroup>");
            $colgroup.append($("<col>").css("width", this._nameColWidth));
            $colgroup.append($("<col>"));
            $table.append($colgroup);

            if (cfg.showHeader) {
                var $thead = $("<thead></thead>");
                var $headRow = $("<tr class='qpx-pg-header-row'></tr>");
                $headRow.append($("<th class='qpx-pg-label'></th>").text(cfg.nameHeader));
                $headRow.append($("<th class='qpx-pg-editor'></th>").text(cfg.valueHeader));
                $thead.append($headRow);
                $table.append($thead);
            }

            var $tbody = $("<tbody></tbody>");

            var groups = {};
            var order = [];

            cfg.items.forEach(function (item) {
                var cat = cfg.showCategories ? (item[cfg.categoryField] || "General") : "_nocat";
                if (!groups[cat]) { groups[cat] = []; order.push(cat); }
                groups[cat].push(item);
            });

            order.forEach(function (cat) {
                if (cfg.showCategories) {
                    $tbody.append(self._renderGroupRow(cat, groups[cat].length));
                }

                self._groupRows[cat] = [];

                groups[cat].forEach(function (item) {
                    var $tr = self._renderRow(item, cat);
                    if (cfg.showCategories && self._collapsed.indexOf(cat) !== -1) { $tr.hide(); }
                    self._groupRows[cat].push($tr);
                    $tbody.append($tr);
                });
            });

            $table.append($tbody);
            this.$container.append($table);
        },

        _renderGroupRow: function (groupName, count) {
            var self = this;
            var cfg = this.config;
            var collapsed = this._collapsed.indexOf(groupName) !== -1;

            var $tr = $("<tr class='qpx-pg-group-row'></tr>").toggleClass("qpx-state-collapsed", collapsed);
            var $td = $("<td colspan='2'></td>");

            if (cfg.collapsible) {
                var $toggle = $("<span class='qpx-pg-group-toggle'></span>").text(collapsed ? "▸" : "▾");
                $td.append($toggle);
                $tr.css("cursor", "pointer");
                $tr.on("click.qpxPropertyGrid", function () { self._toggleGroup(groupName); });
            } else {
                $td.append($("<span class='qpx-pg-group-toggle qpx-pg-group-toggle-static'></span>"));
            }

            $td.append($("<span class='qpx-pg-group-label'></span>").text(groupName));
            $td.append($("<span class='qpx-pg-group-count'></span>").text("(" + count + ")"));

            $tr.append($td);
            this._groupHeaderEls[groupName] = $tr;
            return $tr;
        },

        _toggleGroup: function (groupName) {
            var idx = this._collapsed.indexOf(groupName);
            var collapsed;
            if (idx === -1) { this._collapsed.push(groupName); collapsed = true; }
            else { this._collapsed.splice(idx, 1); collapsed = false; }

            var $hdr = this._groupHeaderEls[groupName];
            if ($hdr) {
                $hdr.toggleClass("qpx-state-collapsed", collapsed);
                $hdr.find(".qpx-pg-group-toggle").text(collapsed ? "▸" : "▾");
            }
            (this._groupRows[groupName] || []).forEach(function ($tr) { $tr.toggle(!collapsed); });

            this.trigger("groupToggle", { group: groupName, collapsed: collapsed, component: this });
        },

        _renderRow: function (item, groupName) {
            var self = this;
            var $tr = $("<tr class='qpx-pg-row'></tr>").attr("data-group", groupName);

            var $label = $("<td class='qpx-pg-label'></td>").text(item.label || item.field);
            var $editor = $("<td class='qpx-pg-editor'></td>");
            $editor.append(this._createEditor(item));

            $tr.append($label, $editor);

            $tr.on("click.qpxPropertyGrid", function () {
                self.trigger("rowClick", { item: item, row: item, component: self });
            });

            return $tr;
        },

        // ---------------------------------------------------------------
        // Editory — string i EasyUI-styl { type, options }
        // ---------------------------------------------------------------
        _editorType: function (item) {
            return qpx.isObject(item.editor) ? item.editor.type : item.editor;
        },

        _editorOptions: function (item) {
            return qpx.isObject(item.editor) ? (item.editor.options || {}) : {};
        },

        _createEditor: function (item) {
            var self = this;
            var cfg = this.config;
            var val = item.value;
            var type = this._editorType(item);
            var opts = this._editorOptions(item);

            if (cfg.readOnly || item.readOnly) {
                return $("<span class='qpx-pg-readonly'></span>").text(this._formatReadOnlyValue(item));
            }

            var widgetCfg = null;

            switch (type) {

                case "textbox":
                case "text":
                    widgetCfg = {
                        view: "qpTextBox",
                        value: val,
                        onValueChanged: function (e) { self._updateValue(item, e.value); }
                    };
                    break;

                case "textarea":
                    widgetCfg = {
                        view: "qpTextBox",
                        value: val,
                        multiline: true,
                        onValueChanged: function (e) { self._updateValue(item, e.value); }
                    };
                    break;

                case "number":
                case "numberbox":
                    widgetCfg = {
                        view: "qpNumberBox",
                        value: val,
                        min: opts.min,
                        max: opts.max,
                        onValueChanged: function (e) { self._updateValue(item, Number(e.value)); }
                    };
                    break;

                case "checkbox":
                    widgetCfg = {
                        view: "qpCheckBox",
                        value: !!val,
                        onValueChanged: function (e) { self._updateValue(item, !!e.value); }
                    };
                    break;

                case "switch":
                    widgetCfg = {
                        view: "qpSwitch",
                        value: !!val,
                        onValueChanged: function (e) { self._updateValue(item, !!e.value); }
                    };
                    break;

                // -- EasyUI: editor:{type:"combobox", options:{data, valueField, textField}} --
                case "combobox":
                    widgetCfg = {
                        view: "qpSelectBox",
                        value: val,
                        dataSource: opts.data || item.dataSource || [],
                        valueExpr: opts.valueField || "value",
                        displayExpr: opts.textField || "text",
                        searchEnabled: !!opts.searchEnabled,
                        onValueChanged: function (e) { self._updateValue(item, e.value); }
                    };
                    break;

                // -- zpětná kompatibilita s předchozí verzí (qpDropDownButton) --
                case "dropdown":
                    widgetCfg = {
                        view: "qpDropDownButton",
                        items: item.dataSource || [],
                        useSelectMode: true,
                        selectedItemKey: val,
                        onSelectionChanged: function (e) { self._updateValue(item, e.key); }
                    };
                    break;

                // -- EasyUI: editor:"datebox" --
                case "date":
                case "datebox":
                    widgetCfg = {
                        view: "qpDatePicker",
                        value: val ? new Date(val) : null,
                        formatString: opts.formatString || "dd.MM.yyyy",
                        onValueChanged: function (e) { self._updateValue(item, e.value); }
                    };
                    break;

                // -- rozšíření nad rámec EasyUI (využívá qpColorPicker z tohoto frameworku) --
                case "color":
                case "colorbox":
                    widgetCfg = {
                        view: "qpColorPicker",
                        value: val || "#000000",
                        mode: opts.mode || "both",
                        onValueChanged: function (e) { self._updateValue(item, e.value); }
                    };
                    break;
            }

            if (!widgetCfg) {
                return $("<span></span>").text(val);
            }

            var instance = qpx.ui(widgetCfg);
            this._editorInstances.push(instance);
            return instance.getContainer();
        },

        // readOnly zobrazení hodnoty — item.formatter má přednost (EasyUI: columns[].formatter)
        _formatReadOnlyValue: function (item) {
            if (qpx.isFunction(item.formatter)) { return item.formatter(item.value, item); }

            var type = this._editorType(item);
            if (type === "checkbox" || type === "switch") { return item.value ? "Ano" : "Ne"; }
            if ((type === "date" || type === "datebox") && item.value) {
                var d = (item.value instanceof Date) ? item.value : new Date(item.value);
                if (!isNaN(d.getTime())) {
                    return ("0" + d.getDate()).slice(-2) + "." + ("0" + (d.getMonth() + 1)).slice(-2) + "." + d.getFullYear();
                }
            }
            return item.value;
        },

        _destroyEditors: function () {
            (this._editorInstances || []).forEach(function (inst) {
                try { inst.destroy(); } catch (e) { /* noop */ }
            });
            this._editorInstances = [];
        },

        _updateValue: function (item, newVal) {
            var prev = item.value;
            item.value = newVal;

            this.trigger("itemChanged", {
                field: item.field,
                value: newVal,
                previousValue: prev,
                item: item,
                component: this
            });

            this.trigger("valueChanged", {
                field: item.field,
                value: newVal,
                previousValue: prev,
                component: this
            });
        },

        // ---------------------------------------------------------------
        // Veřejné API
        // ---------------------------------------------------------------

        // EasyUI: .propertygrid('loadData', data) — data jako pole i {rows:[...]}
        loadData: function (data) {
            return this.option("items", this._normalizeItems(data));
        },

        // EasyUI: .propertygrid('getData') — vrací stejný tvar jako se do gridu nahrává
        getData: function () {
            return { total: this.config.items.length, rows: this.config.items };
        },

        getValues: function () {
            var obj = {};
            this.config.items.forEach(function (it) { obj[it.field] = it.value; });
            return obj;
        },

        setValues: function (obj) {
            this.config.items.forEach(function (it) {
                if (obj[it.field] !== undefined) { it.value = obj[it.field]; }
            });
            this.refresh();
            return this;
        },

        collapseGroup: function (name) { if (this._collapsed.indexOf(name) === -1) { this._toggleGroup(name); } return this; },
        expandGroup: function (name) { if (this._collapsed.indexOf(name) !== -1) { this._toggleGroup(name); } return this; },
        collapseAll: function () {
            var self = this;
            Object.keys(this._groupHeaderEls).forEach(function (name) { self.collapseGroup(name); });
            return this;
        },
        expandAll: function () {
            var self = this;
            Object.keys(this._groupHeaderEls).forEach(function (name) { self.expandGroup(name); });
            return this;
        },

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
                case "data":
                    this.config.items = this._normalizeItems(value);
                    this.refresh();
                    break;

                case "items":
                case "readOnly":
                case "collapsible":
                    this.refresh();
                    break;

                case "showCategories":
                case "showGroup":
                    this.config.showCategories = !!value;
                    this.refresh();
                    break;

                case "categoryField":
                case "groupField":
                    this.config.categoryField = value;
                    this.refresh();
                    break;

                case "showHeader":
                case "nameHeader":
                case "valueHeader":
                case "nameColumnWidth":
                    if (name === "nameColumnWidth") { this._nameColWidth = value; }
                    this.refresh();
                    break;

                case "columns":
                    this._applyColumnsConfig();
                    this.refresh();
                    break;

                case "visible":
                    this.$container.toggleClass("qpx-hidden", !value);
                    break;

                case "disabled":
                    this.$container.toggleClass("qpx-state-disabled", !!value);
                    break;
            }

            this.trigger("optionChanged", { name: name, value: value, previousValue: prev, component: this });
            return this;
        },

        destroy: function () {
            this._destroyEditors();
            this.$container.off(".qpxPropertyGrid");
            this._super();
        }
    });

    qpx.registerWidget("qpPropertyGrid", PropertyGrid);
    qpx.qpPropertyGrid = PropertyGrid;

})(window.qpx, jQuery);
