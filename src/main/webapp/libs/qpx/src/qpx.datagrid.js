/*!
 * qpx - qpDataGrid
 * Tabulková komponenta co nejvíce přiblížená DevExtreme dxDataGrid
 * (options / events / methods i vzhled), postavená nad původní
 * implementací qpDataGrid — původní funkcionalita (adaptivní sloupce
 * s akordeon detailem pod řádkem, klávesová navigace, řazení, výběr
 * řádků, onRowClick/onCellClick) je zachována beze změny chování.
 *
 * Nově doplněno (analogie k dxDataGrid):
 *  - selection: { mode: "none"|"single"|"multiple", showCheckBoxesMode }
 *               (selectionMode jako string zůstává funkční, mapuje se do selection.mode)
 *  - paging: { enabled, pageSize } + pager: { visible, allowedPageSizes,
 *             showPageSizeSelector, showInfo, showNavigationButtons }
 *  - filterRow: { visible }  — textový filtr pod hlavičkou, sloupec od sloupce
 *  - searchPanel: { visible, placeholder, width } — globální hledání nad gridem
 *  - editing: { mode:"row", allowUpdating, allowAdding, allowDeleting, confirmDelete }
 *  - sorting.mode "multiple" + shift-klik na hlavičku (číslo pořadí řazení)
 *  - allowColumnResizing — tažení za okraj hlavičky sloupce
 *  - showBorders / showRowLines / showColumnLines / rowAlternationEnabled / wordWrapEnabled
 *  - columns: navíc dataType, alignment, allowSorting, allowFiltering,
 *             allowResizing, format (string preset i funkce), cellTemplate,
 *             calculateCellValue
 *
 * Events: onInitialized, onContentReady, onRowClick, onCellClick,
 *         onSelectionChanged, onOptionChanged, onRowInserted, onRowUpdated,
 *         onRowRemoved, onEditingStart, onRowPrepared, onDisposing
 *
 * Methods: option(name[, value]) — vč. tečkové cesty "paging.pageSize",
 *          refresh()/repaint(), columnOption(field, name[, value]),
 *          getSelectedRowKeys(), getSelectedRowsData(), selectRows(keys),
 *          deselectRows(keys), clearSelection(), getDataSource(),
 *          addRow(), editRow(key), deleteRow(key), saveEditData(),
 *          cancelEditData(), hasEditData(), pageIndex([i]), pageSize([n]),
 *          pageCount(), searchByText(text), clearFilter(),
 *          getRowElement(key), destroy()
 */
(function (qpx, $) {
    "use strict";

    var DataGrid = qpx.Widget.extend({

        defaults: {
            dataSource: [],
            columns: [],
            keyExpr: "id",

            selection: {
                mode: "none",              // none | single | multiple
                showCheckBoxesMode: "onClick" // none | onClick | always
            },
            selectionMode: undefined,      // DEPRECATED zpětná kompatibilita, viz selection.mode

            sorting: {
                mode: "single" // none | single | multiple
            },

            paging: {
                enabled: false,
                pageSize: 10
            },
            pager: {
                visible: "auto",           // auto | true | false
                allowedPageSizes: [5, 10, 20, 50],
                showPageSizeSelector: true,
                showInfo: true,
                showNavigationButtons: true
            },

            filterRow: { visible: false },
            searchPanel: { visible: false, placeholder: "Hledat...", width: 220 },

            editing: {
                mode: "row",        // zatím jediný podporovaný mód
                allowUpdating: false,
                allowAdding: false,
                allowDeleting: false,
                confirmDelete: true
            },

            showBorders: true,
            showRowLines: true,
            showColumnLines: true,
            rowAlternationEnabled: false,
            wordWrapEnabled: false,
            allowColumnResizing: false,
            noDataText: "Žádná data k zobrazení",

            visible: true,
            disabled: false,
            responsive: true,

            onInitialized: null,
            onContentReady: null,
            onRowClick: null,
            onCellClick: null,
            onSelectionChanged: null,
            onOptionChanged: null,
            onRowInserted: null,
            onRowUpdated: null,
            onRowRemoved: null,
            onEditingStart: null,
            onRowPrepared: null,
            onDisposing: null
        },

        // ---------------------------------------------------------------
        render: function () {
            var self = this;
            var cfg = this.config;

            // zpětná kompatibilita: staré "selectionMode: 'multiple'" -> selection.mode
            if (cfg.selectionMode && cfg.selection.mode === "none") {
                cfg.selection.mode = cfg.selectionMode;
            }
            cfg.selectionMode = cfg.selection.mode;

            this.$container
                .addClass("qpx-datagrid")
                .toggleClass("qpx-hidden", !cfg.visible)
                .toggleClass("qpx-state-disabled", !!cfg.disabled)
                .toggleClass("qpx-datagrid-no-borders", !cfg.showBorders)
                .toggleClass("qpx-datagrid-no-row-lines", !cfg.showRowLines)
                .toggleClass("qpx-datagrid-no-column-lines", !cfg.showColumnLines)
                .toggleClass("qpx-datagrid-alternation", !!cfg.rowAlternationEnabled)
                .toggleClass("qpx-datagrid-wordwrap", !!cfg.wordWrapEnabled);

            if (cfg.onInitialized) { this.on("ready", cfg.onInitialized); }
            if (cfg.onContentReady) { this.on("contentReady", cfg.onContentReady); }
            if (cfg.onRowClick) { this.on("rowClick", cfg.onRowClick); }
            if (cfg.onCellClick) { this.on("cellClick", cfg.onCellClick); }
            if (cfg.onSelectionChanged) { this.on("selectionChanged", cfg.onSelectionChanged); }
            if (cfg.onOptionChanged) { this.on("optionChanged", cfg.onOptionChanged); }
            if (cfg.onRowInserted) { this.on("rowInserted", cfg.onRowInserted); }
            if (cfg.onRowUpdated) { this.on("rowUpdated", cfg.onRowUpdated); }
            if (cfg.onRowRemoved) { this.on("rowRemoved", cfg.onRowRemoved); }
            if (cfg.onEditingStart) { this.on("editingStart", cfg.onEditingStart); }
            if (cfg.onRowPrepared) { this.on("rowPrepared", cfg.onRowPrepared); }
            if (cfg.onDisposing) { this.on("destroy", cfg.onDisposing); }

            this._selectedKeys = [];
            this._sortState = [];           // [{ dataField, desc }]
            this._adaptiveOpenRowKey = null;
            this._pageIndex = 0;
            this._searchText = "";
            this._filterValues = {};        // { dataField: text }
            this._editRowKey = null;
            this._editRowData = null;
            this._isNewRow = false;

            this._buildStructure();
            this._bindResize();
            this._bindKeyboard();
            this._renderAll();

            setTimeout(function () { self.trigger("contentReady", { component: self }); }, 0);
        },

        // ---------------------------------------------------------------
        // Kostra DOM: toolbar (search), scroll wrapper + tabulka, pager
        // ---------------------------------------------------------------
        _buildStructure: function () {
            var self = this;
            var cfg = this.config;

            this.$toolbar = $("<div class='qpx-datagrid-toolbar'></div>");

            this.$searchWrap = $("<div class='qpx-datagrid-search'></div>");
            this.$searchInput = $("<input type='text' class='qpx-datagrid-search-input'>")
                .attr("placeholder", cfg.searchPanel.placeholder || "Hledat...");
            if (cfg.searchPanel.width) { this.$searchWrap.css("width", qpx.toPx(cfg.searchPanel.width)); }
            this.$searchWrap.append($("<span class='qpx-icon qpx-datagrid-search-icon'></span>"), this.$searchInput);
            this.$toolbar.append(this.$searchWrap);

            var searchTimer = null;
            this.$searchInput.on("input.qpxDataGrid", function () {
                var val = this.value;
                clearTimeout(searchTimer);
                searchTimer = setTimeout(function () {
                    self._searchText = val;
                    self._pageIndex = 0;
                    self._renderBody();
                    self._renderPager();
                }, 200);
            });

            this.$scroll = $("<div class='qpx-datagrid-scroll'></div>");
            this.$table = $("<table class='qpx-datagrid-table'></table>");
            this.$colgroup = $("<colgroup></colgroup>");
            this.$thead = $("<thead></thead>");
            this.$tbody = $("<tbody></tbody>");
            this.$table.append(this.$colgroup, this.$thead, this.$tbody);
            this.$scroll.append(this.$table);

            this.$pager = $("<div class='qpx-datagrid-pager'></div>");

            this.$container.empty().append(this.$toolbar, this.$scroll, this.$pager);
        },

        _renderAll: function () {
            this._computeAdaptiveLayout();
            this._renderHeader();
            this._renderBody();
            this._renderPager();
            this.$toolbar.toggle(!!this.config.searchPanel.visible);
        },

        // znovu-vykreslení "na povel" (dx: refresh()/repaint())
        refresh: function () { this._renderAll(); return this; },
        repaint: function () { this._renderAll(); return this; },

        _bindResize: function () {
            var self = this;
            this._onWinResize = function () { self._scheduleAdaptiveLayout(); };

            if (window.ResizeObserver) {
                this._resizeObserver = new ResizeObserver(function () { self._scheduleAdaptiveLayout(); });
                this._resizeObserver.observe(this.getNode());
            } else {
                $(window).on("resize.qpxDataGrid" + this.id, this._onWinResize);
            }
        },

        _scheduleAdaptiveLayout: function () {
            var self = this;
            if (this._adaptiveRaf) { return; }
            this._adaptiveRaf = (window.requestAnimationFrame || window.setTimeout)(function () {
                self._adaptiveRaf = null;
                self._refreshAdaptiveLayout();
            });
        },

        // přepočítá adaptivní sloupce a — pokud se skutečně změnily — znovu
        // vykreslí hlavičku a tělo (tzn. správně přepočítá i <colgroup>,
        // místo pouhého skrývání buněk přes CSS)
        _refreshAdaptiveLayout: function () {
            if (!this.config.responsive) { return; }
            var before = this._adaptiveSignature();
            this._computeAdaptiveLayout();
            var after = this._adaptiveSignature();
            if (before !== after) {
                this._renderHeader();
                this._renderBody();
            }
        },

        _adaptiveSignature: function () {
            return this._configuredColumns().map(function (c) {
                return c.dataField + ":" + (c.adaptiveHidden ? 1 : 0);
            }).join("|");
        },

        // ---------------------------------------------------------------
        // Klávesová navigace (zachováno z původní implementace + ochrana
        // proti zachytávání kláves při psaní do editačních inputů)
        // ---------------------------------------------------------------
        _bindKeyboard: function () {
            var self = this;

            this.$container.attr("tabindex", "0");

            this.$container.on("keydown.qpxDataGrid", function (e) {
                if ($(e.target).is("input, select, textarea")) { return; }

                var rows = self.$tbody.find(".qpx-datagrid-row");
                if (!rows.length) { return; }

                var selectedKey = self._selectedKeys[0];
                var index = selectedKey ? rows.index(self.$tbody.find("[data-key='" + selectedKey + "']")) : -1;

                function selectRowByIndex(i) {
                    if (i < 0) { i = 0; }
                    if (i >= rows.length) { i = rows.length - 1; }
                    var $row = $(rows[i]);
                    var key = $row.data("key");
                    self._selectedKeys = [key];
                    rows.removeClass("qpx-state-selected");
                    $row.addClass("qpx-state-selected");
                    self.$tbody.find(".qpx-datagrid-select-checkbox").prop("checked", false);
                    $row.find(".qpx-datagrid-select-checkbox").prop("checked", true);
                    self.trigger("selectionChanged", {
                        selectedRowKeys: self._selectedKeys.slice(),
                        previousRowKeys: [],
                        component: self
                    });
                    $row[0].scrollIntoView({ block: "nearest" });
                }

                switch (e.key) {
                    case "ArrowDown": e.preventDefault(); selectRowByIndex(index + 1); break;
                    case "ArrowUp": e.preventDefault(); selectRowByIndex(index - 1); break;
                    case "Home": e.preventDefault(); selectRowByIndex(0); break;
                    case "End": e.preventDefault(); selectRowByIndex(rows.length - 1); break;
                    case "PageDown": e.preventDefault(); selectRowByIndex(index + 10); break;
                    case "PageUp": e.preventDefault(); selectRowByIndex(index - 10); break;

                    case "Enter":
                        e.preventDefault();
                        if (index >= 0) {
                            var $row = $(rows[index]);
                            var key = $row.data("key");
                            var rowData = self.config.dataSource.filter(function (r) { return r[self.config.keyExpr] === key; })[0];
                            self.trigger("rowClick", { key: key, data: rowData, component: self, rowElement: $row[0] });
                        }
                        break;

                    case "Escape":
                        e.preventDefault();
                        self._closeAdaptiveAccordion();
                        break;
                }
            });
        },

        // ---------------------------------------------------------------
        // Sloupce
        // ---------------------------------------------------------------
        // sloupce, které se skutečně mají vykreslit jako <th>/<td> v tabulce
        // (bez sloupců schovaných uživatelem i bez těch dočasně skrytých
        // adaptivním layoutem)
        _visibleColumns: function () {
            return (this.config.columns || []).filter(function (c) {
                return c.visible !== false && !c.adaptiveHidden;
            });
        },

        // všechny nakonfigurované (uživatelsky neskryté) sloupce — používá
        // se pro výpočet adaptivního layoutu, globální hledání a obsah
        // akordeonu, kde potřebujeme počítat i se sloupci, které jsou
        // aktuálně mimo tabulku kvůli adaptivnímu zalamování
        _configuredColumns: function () {
            return (this.config.columns || []).filter(function (c) { return c.visible !== false; });
        },

        _columnAlign: function (col) {
            if (col.alignment) { return col.alignment; }
            return (col.dataType === "number") ? "right" : "left";
        },

        _isMultipleSelection: function () { return this.config.selection.mode === "multiple"; },
        _isSingleSelection: function () { return this.config.selection.mode === "single"; },
        _showCheckBoxes: function () { return this.config.selection.showCheckBoxesMode !== "none"; },
        _editingEnabled: function () {
            var e = this.config.editing;
            return !!(e && (e.allowUpdating || e.allowAdding || e.allowDeleting));
        },

        // ---------------------------------------------------------------
        // Hlavička (+ volitelný filter row)
        // ---------------------------------------------------------------
        _renderHeader: function () {
            var self = this;
            var cfg = this.config;
            this.$thead.empty();
            this.$colgroup.empty();

            var $tr = $("<tr class='qpx-datagrid-header-row'></tr>");

            if (this._isMultipleSelection() && this._showCheckBoxes()) {
                var $thSel = $("<th class='qpx-datagrid-header-cell qpx-datagrid-cell-select'></th>");
                var $selectAll = $("<input type='checkbox' class='qpx-datagrid-select-all'>");
                $selectAll.on("change.qpxDataGrid", function () { self._handleSelectAll(this.checked); });
                $thSel.append($selectAll);
                $tr.append($thSel);
                this.$colgroup.append("<col class='qpx-datagrid-col-select'>");
                this._$selectAllCheckbox = $selectAll;
            }

            this._visibleColumns().forEach(function (col) {
                var $th = $("<th class='qpx-datagrid-header-cell'></th>")
                    .attr("data-field", col.dataField)
                    .css("text-align", self._columnAlign(col));

                $th.append($("<span class='qpx-datagrid-header-caption'></span>").text(col.caption || col.dataField));

                var allowSort = (col.allowSorting !== false) && cfg.sorting && cfg.sorting.mode !== "none";
                if (allowSort) {
                    $th.addClass("qpx-datagrid-sortable");
                    var info = self._sortInfo(col.dataField);
                    if (info) {
                        $th.addClass("qpx-datagrid-sort-" + (info.desc ? "desc" : "asc"));
                        $th.append("<span class='qpx-datagrid-sort-indicator'></span>");
                        if (cfg.sorting.mode === "multiple" && self._sortState.length > 1) {
                            $th.append($("<span class='qpx-datagrid-sort-order'></span>").text(info.order + 1));
                        }
                    }
                    $th.on("click.qpxDataGrid", function (e) {
                        self._toggleSort(col.dataField, e.shiftKey);
                    });
                }

                if (col.width) { $th.css("width", qpx.toPx(col.width)); }
                $tr.append($th);

                var $col = $("<col>");
                if (col.width) { $col.css("width", qpx.toPx(col.width)); }
                self.$colgroup.append($col);

                if (cfg.allowColumnResizing && col.allowResizing !== false) {
                    var $handle = $("<span class='qpx-datagrid-resize-handle'></span>");
                    $th.append($handle);
                    self._bindColumnResize($handle, col, $th);
                }
            });

            this.$container.toggleClass("qpx-datagrid-adaptive", !!this._adaptiveActive);

            if (this._adaptiveActive) {
                $tr.append("<th class='qpx-datagrid-header-cell qpx-datagrid-cell-adaptive'></th>");
                this.$colgroup.append("<col class='qpx-datagrid-col-adaptive'>");
            }

            if (this._editingEnabled()) {
                var $thCmd = $("<th class='qpx-datagrid-header-cell qpx-datagrid-cell-command'></th>");
                if (cfg.editing.allowAdding) {
                    var $addBtn = $("<span class='qpx-datagrid-cmd-btn qpx-datagrid-add-btn' tabindex='0' role='button' title='Přidat řádek'>+</span>");
                    $addBtn.on("click.qpxDataGrid", function () { self.addRow(); });
                    $thCmd.append($addBtn);
                }
                $tr.append($thCmd);
                this.$colgroup.append("<col class='qpx-datagrid-col-command'>");
            }

            this.$thead.append($tr);

            if (cfg.filterRow && cfg.filterRow.visible) { this._renderFilterRow(); }
        },

        _renderFilterRow: function () {
            var self = this;
            var cfg = this.config;
            var $tr = $("<tr class='qpx-datagrid-filter-row'></tr>");

            if (this._isMultipleSelection() && this._showCheckBoxes()) {
                $tr.append("<th class='qpx-datagrid-header-cell qpx-datagrid-cell-select'></th>");
            }

            this._visibleColumns().forEach(function (col) {
                var $th = $("<th class='qpx-datagrid-header-cell'></th>");
                if (col.allowFiltering !== false) {
                    var $input = $("<input type='text' class='qpx-datagrid-filter-input'>")
                        .attr("placeholder", "Filtr...")
                        .val(self._filterValues[col.dataField] || "");

                    var timer = null;
                    $input.on("input.qpxDataGrid", function () {
                        var val = this.value;
                        clearTimeout(timer);
                        timer = setTimeout(function () {
                            self._filterValues[col.dataField] = val;
                            self._pageIndex = 0;
                            self._renderBody();
                            self._renderPager();
                        }, 200);
                    });
                    $th.append($input);
                }
                $tr.append($th);
            });

            if (this._adaptiveActive) { $tr.append("<th class='qpx-datagrid-header-cell qpx-datagrid-cell-adaptive'></th>"); }
            if (this._editingEnabled()) { $tr.append("<th class='qpx-datagrid-header-cell qpx-datagrid-cell-command'></th>"); }

            this.$thead.append($tr);
        },

        _bindColumnResize: function ($handle, col, $th) {
            var self = this;
            $handle.on("mousedown.qpxDataGrid", function (e) {
                e.preventDefault();
                e.stopPropagation();
                var startX = e.pageX;
                var startWidth = $th.outerWidth();

                function onMove(ev) {
                    var newWidth = Math.max(30, startWidth + (ev.pageX - startX));
                    $th.css("width", newWidth + "px");
                    col.width = newWidth;
                }
                function onUp() {
                    $(document).off(".qpxDataGridResize");
                    self._computeAdaptiveLayout();
                    self._renderHeader();
                    self._renderBody();
                }

                $(document).on("mousemove.qpxDataGridResize", onMove);
                $(document).on("mouseup.qpxDataGridResize", onUp);
            });
        },

        // ---------------------------------------------------------------
        // Tělo tabulky
        // ---------------------------------------------------------------
        _renderBody: function () {
            var self = this;
            var cfg = this.config;
            this.$tbody.empty();
            this._closeAdaptiveAccordion();

            var pageData = this._getPagedData();

            if (this._isNewRow) {
                this._renderRow(this._editRowData, true, -1);
            }

            if (!pageData.length && !this._isNewRow) {
                var colCount = this.$thead.find("tr").first().find("th").length || 1;
                this.$tbody.append(
                    $("<tr class='qpx-datagrid-no-data-row'></tr>").append(
                        $("<td class='qpx-datagrid-no-data-cell'></td>")
                            .attr("colspan", colCount)
                            .text(cfg.noDataText)
                    )
                );
                return;
            }

            pageData.forEach(function (row, idx) {
                self._renderRow(row, false, idx);
            });
        },

        _renderRow: function (row, isEditBuffer, rowIndex) {
            var self = this;
            var cfg = this.config;
            var key = row[cfg.keyExpr];
            var isEditing = isEditBuffer || (key === this._editRowKey);
            var selected = !isEditBuffer && this._selectedKeys.indexOf(key) !== -1;

            var $tr = $("<tr class='qpx-datagrid-row'></tr>")
                .attr("data-key", key)
                .toggleClass("qpx-state-selected", selected)
                .toggleClass("qpx-datagrid-row-edit", isEditing)
                .toggleClass("qpx-datagrid-row-alt", cfg.rowAlternationEnabled && rowIndex >= 0 && rowIndex % 2 === 1);

            if (this._isMultipleSelection() && this._showCheckBoxes() && !isEditBuffer) {
                var $tdSel = $("<td class='qpx-datagrid-cell qpx-datagrid-cell-select'></td>");
                var $cb = $("<input type='checkbox' class='qpx-datagrid-select-checkbox'>").prop("checked", selected);
                $cb.on("click.qpxDataGrid", function (e) {
                    e.stopPropagation();
                    self._handleRowClick(row, $tr);
                });
                $tdSel.append($cb);
                $tr.append($tdSel);
            } else if (this._isMultipleSelection() && this._showCheckBoxes() && isEditBuffer) {
                $tr.append("<td class='qpx-datagrid-cell qpx-datagrid-cell-select'></td>");
            }

            this._visibleColumns().forEach(function (col) {
                var $td = $("<td class='qpx-datagrid-cell'></td>")
                    .attr("data-field", col.dataField)
                    .css("text-align", self._columnAlign(col));

                if (isEditing) {
                    self._renderEditCell($td, col, row);
                } else {
                    var rawValue = qpx.isFunction(col.calculateCellValue) ? col.calculateCellValue(row) : row[col.dataField];

                    if (qpx.isFunction(col.cellTemplate)) {
                        var result = col.cellTemplate.call(self, $td[0], { value: rawValue, data: row, column: col, rowIndex: rowIndex });
                        if (result !== undefined && result !== null) { $td.append(result); }
                    } else {
                        $td.text(self._formatCellValue(rawValue, col));
                    }

                    $td.on("click.qpxDataGrid", function () {
                        self._handleCellClick(row, col, $td);
                    });
                }

                $tr.append($td);
            });

            // adaptivní "⋯" sloupec
            if (this._adaptiveActive) {
                var $adaptiveCell = $("<td class='qpx-datagrid-cell qpx-datagrid-cell-adaptive'></td>");
                if (!isEditing) {
                    var $btn = $("<span class='qpx-datagrid-adaptive-btn' tabindex='0' role='button'>⋯</span>");
                    $btn.on("click.qpxDataGrid", function (e) {
                        e.stopPropagation();
                        self._toggleAdaptiveAccordion(key, row, $tr);
                    });
                    $adaptiveCell.append($btn);
                }
                $tr.append($adaptiveCell);
            }

            // editační příkazový sloupec
            if (this._editingEnabled()) {
                $tr.append(this._buildCommandCell(row, key, isEditing, isEditBuffer));
            }

            if (!isEditing) {
                $tr.on("click.qpxDataGrid", function () {
                    self._handleRowClick(row, $tr);
                });
            }

            this.$tbody.append($tr);
            this.trigger("rowPrepared", { rowElement: $tr[0], key: key, data: row, rowIndex: rowIndex, component: this });
        },

        _renderEditCell: function ($td, col, row) {
            var self = this;
            var value = this._editRowData[col.dataField];
            var $input;

            if (col.dataType === "boolean") {
                $input = $("<input type='checkbox' class='qpx-datagrid-edit-input'>").prop("checked", !!value);
                $input.on("change.qpxDataGrid", function () { self._editRowData[col.dataField] = this.checked; });
            } else if (col.dataType === "number") {
                $input = $("<input type='number' class='qpx-datagrid-edit-input'>").val(value == null ? "" : value);
                $input.on("input.qpxDataGrid", function () { self._editRowData[col.dataField] = this.value === "" ? null : Number(this.value); });
            } else if (col.dataType === "date") {
                var dv = value instanceof Date ? value.toISOString().slice(0, 10) : (value || "");
                $input = $("<input type='date' class='qpx-datagrid-edit-input'>").val(dv);
                $input.on("input.qpxDataGrid", function () { self._editRowData[col.dataField] = this.value; });
            } else {
                $input = $("<input type='text' class='qpx-datagrid-edit-input'>").val(value == null ? "" : value);
                $input.on("input.qpxDataGrid", function () { self._editRowData[col.dataField] = this.value; });
            }

            $input.on("click.qpxDataGrid", function (e) { e.stopPropagation(); });
            $td.append($input);
        },

        _buildCommandCell: function (row, key, isEditing, isEditBuffer) {
            var self = this;
            var cfg = this.config;
            var $td = $("<td class='qpx-datagrid-cell qpx-datagrid-cell-command'></td>");

            if (isEditing) {
                var $save = $("<span class='qpx-datagrid-cmd-btn qpx-datagrid-save-btn' tabindex='0' role='button' title='Uložit'>✓</span>");
                var $cancel = $("<span class='qpx-datagrid-cmd-btn qpx-datagrid-cancel-btn' tabindex='0' role='button' title='Zrušit'>✕</span>");
                $save.on("click.qpxDataGrid", function (e) { e.stopPropagation(); self.saveEditData(); });
                $cancel.on("click.qpxDataGrid", function (e) { e.stopPropagation(); self.cancelEditData(); });
                $td.append($save, $cancel);
            } else {
                if (cfg.editing.allowUpdating) {
                    var $edit = $("<span class='qpx-datagrid-cmd-btn qpx-datagrid-edit-btn' tabindex='0' role='button' title='Upravit'>✎</span>");
                    $edit.on("click.qpxDataGrid", function (e) { e.stopPropagation(); self.editRow(key); });
                    $td.append($edit);
                }
                if (cfg.editing.allowDeleting) {
                    var $del = $("<span class='qpx-datagrid-cmd-btn qpx-datagrid-delete-btn' tabindex='0' role='button' title='Smazat'>🗑</span>");
                    $del.on("click.qpxDataGrid", function (e) { e.stopPropagation(); self.deleteRow(key); });
                    $td.append($del);
                }
            }

            return $td;
        },

        _formatCellValue: function (value, col) {
            col = col || {};
            if (value === null || value === undefined) { return ""; }
            if (qpx.isFunction(col.format)) { return col.format(value); }

            if (col.format === "date" || col.format === "shortDate" || col.dataType === "date") {
                var d = (value instanceof Date) ? value : new Date(value);
                return isNaN(d.getTime()) ? String(value) : d.toLocaleDateString();
            }
            if (col.format === "fixedPoint" || col.dataType === "number") {
                var n = Number(value);
                if (isNaN(n)) { return String(value); }
                return col.precision !== undefined ? n.toFixed(col.precision) : String(n);
            }
            if (col.format === "percent") {
                var p = Number(value);
                if (isNaN(p)) { return String(value); }
                return (p * 100).toFixed(col.precision !== undefined ? col.precision : 0) + "%";
            }
            if (col.format === "currency") {
                var c = Number(value);
                if (isNaN(c)) { return String(value); }
                return c.toLocaleString(undefined, { style: "currency", currency: col.currency || "CZK" });
            }
            if (col.dataType === "boolean") { return value ? "✓" : "✗"; }

            return String(value);
        },

        // ---------------------------------------------------------------
        // Filtrování / hledání / řazení / stránkování
        // ---------------------------------------------------------------
        _rowMatchesFilters: function (row) {
            var self = this;
            var cfg = this.config;

            for (var field in this._filterValues) {
                var needle = (this._filterValues[field] || "").toLowerCase();
                if (!needle) { continue; }
                var col = cfg.columns.filter(function (c) { return c.dataField === field; })[0] || {};
                var val = qpx.isFunction(col.calculateCellValue) ? col.calculateCellValue(row) : row[field];
                var text = self._formatCellValue(val, col).toLowerCase();
                if (text.indexOf(needle) === -1) { return false; }
            }

            if (this._searchText) {
                var needle2 = this._searchText.toLowerCase();
                var found = this._configuredColumns().some(function (col) {
                    var val2 = qpx.isFunction(col.calculateCellValue) ? col.calculateCellValue(row) : row[col.dataField];
                    var text2 = self._formatCellValue(val2, col).toLowerCase();
                    return text2.indexOf(needle2) !== -1;
                });
                if (!found) { return false; }
            }

            return true;
        },

        _getFilteredData: function () {
            var self = this;
            return (this.config.dataSource || []).filter(function (row) { return self._rowMatchesFilters(row); });
        },

        _getSortedData: function () {
            var data = this._getFilteredData();
            var sortState = this._sortState.slice();
            if (!sortState.length) { return data; }

            data.sort(function (a, b) {
                for (var i = 0; i < sortState.length; i++) {
                    var s = sortState[i];
                    var av = a[s.dataField];
                    var bv = b[s.dataField];

                    if (av == null && bv != null) { return s.desc ? 1 : -1; }
                    if (av != null && bv == null) { return s.desc ? -1 : 1; }
                    if (av < bv) { return s.desc ? 1 : -1; }
                    if (av > bv) { return s.desc ? -1 : 1; }
                }
                return 0;
            });

            return data;
        },

        _getPagedData: function () {
            var data = this._getSortedData();
            var cfg = this.config;
            if (!cfg.paging || !cfg.paging.enabled) { return data; }

            var size = cfg.paging.pageSize || data.length || 1;
            var count = Math.max(1, Math.ceil(data.length / size));
            if (this._pageIndex >= count) { this._pageIndex = count - 1; }
            if (this._pageIndex < 0) { this._pageIndex = 0; }

            var start = this._pageIndex * size;
            return data.slice(start, start + size);
        },

        _sortInfo: function (dataField) {
            for (var i = 0; i < this._sortState.length; i++) {
                if (this._sortState[i].dataField === dataField) { return { desc: this._sortState[i].desc, order: i }; }
            }
            return null;
        },

        _toggleSort: function (dataField, appendMode) {
            var mode = this.config.sorting && this.config.sorting.mode;
            if (!mode || mode === "none") { return; }

            var multiple = (mode === "multiple") && appendMode;
            var existing = this._sortState.filter(function (s) { return s.dataField === dataField; })[0];

            if (!multiple) {
                this._sortState = existing ? [existing] : [];
            }

            if (!existing) {
                this._sortState.push({ dataField: dataField, desc: false });
            } else if (!existing.desc) {
                existing.desc = true;
            } else {
                this._sortState = this._sortState.filter(function (s) { return s.dataField !== dataField; });
            }

            this._pageIndex = 0;
            this._computeAdaptiveLayout();
            this._renderHeader();
            this._renderBody();
            this._renderPager();
        },

        // ---------------------------------------------------------------
        // Pager
        // ---------------------------------------------------------------
        _renderPager: function () {
            var self = this;
            var cfg = this.config;
            this.$pager.empty();

            var shouldShow = cfg.paging.enabled &&
                (cfg.pager.visible === true || (cfg.pager.visible === "auto" && this._getFilteredData().length > cfg.paging.pageSize));

            this.$pager.toggle(!!shouldShow);
            if (!shouldShow) { return; }

            var total = this._getFilteredData().length;
            var count = this.pageCount();

            if (cfg.pager.showPageSizeSelector && cfg.pager.allowedPageSizes && cfg.pager.allowedPageSizes.length) {
                var $sizes = $("<div class='qpx-datagrid-pager-sizes'></div>");
                cfg.pager.allowedPageSizes.forEach(function (size) {
                    var $btn = $("<span class='qpx-datagrid-pager-size'></span>")
                        .text(size)
                        .toggleClass("qpx-state-selected", size === cfg.paging.pageSize)
                        .on("click.qpxDataGrid", function () { self.pageSize(size); });
                    $sizes.append($btn);
                });
                this.$pager.append($sizes);
            }

            if (cfg.pager.showNavigationButtons) {
                var $nav = $("<div class='qpx-datagrid-pager-nav'></div>");
                var mkBtn = function (label, title, disabled, handler) {
                    var $b = $("<span class='qpx-datagrid-pager-btn'></span>")
                        .text(label).attr("title", title)
                        .toggleClass("qpx-state-disabled", disabled);
                    if (!disabled) { $b.on("click.qpxDataGrid", handler); }
                    return $b;
                };

                $nav.append(mkBtn("«", "První", this._pageIndex === 0, function () { self.pageIndex(0); }));
                $nav.append(mkBtn("‹", "Předchozí", this._pageIndex === 0, function () { self.pageIndex(self._pageIndex - 1); }));

                var $pages = $("<span class='qpx-datagrid-pager-pages'></span>");
                for (var i = 0; i < count; i++) {
                    (function (pageIdx) {
                        $pages.append(
                            $("<span class='qpx-datagrid-pager-page'></span>")
                                .text(pageIdx + 1)
                                .toggleClass("qpx-state-selected", pageIdx === self._pageIndex)
                                .on("click.qpxDataGrid", function () { self.pageIndex(pageIdx); })
                        );
                    })(i);
                }
                $nav.append($pages);

                $nav.append(mkBtn("›", "Další", this._pageIndex >= count - 1, function () { self.pageIndex(self._pageIndex + 1); }));
                $nav.append(mkBtn("»", "Poslední", this._pageIndex >= count - 1, function () { self.pageIndex(count - 1); }));

                this.$pager.append($nav);
            }

            if (cfg.pager.showInfo) {
                var from = total === 0 ? 0 : this._pageIndex * cfg.paging.pageSize + 1;
                var to = Math.min(total, (this._pageIndex + 1) * cfg.paging.pageSize);
                this.$pager.append($("<div class='qpx-datagrid-pager-info'></div>").text(from + "-" + to + " z " + total));
            }
        },

        // ---------------------------------------------------------------
        // Výběr řádků
        // ---------------------------------------------------------------
        _handleSelectAll: function (checked) {
            var self = this;
            var prev = this._selectedKeys.slice();

            if (checked) {
                this._selectedKeys = this._getFilteredData().map(function (r) { return r[self.config.keyExpr]; });
            } else {
                this._selectedKeys = [];
            }

            this._renderBody();
            this.trigger("selectionChanged", {
                selectedRowKeys: this._selectedKeys.slice(),
                previousRowKeys: prev,
                component: this
            });
        },

        _handleRowClick: function (row, $tr) {
            var cfg = this.config;
            var key = row[cfg.keyExpr];
            var prev = this._selectedKeys.slice();

            if (cfg.selection.mode === "single") {
                this._selectedKeys = [key];
            } else if (cfg.selection.mode === "multiple") {
                var idx = this._selectedKeys.indexOf(key);
                if (idx === -1) { this._selectedKeys.push(key); }
                else { this._selectedKeys.splice(idx, 1); }
            }

            this.$tbody.find(".qpx-datagrid-row").removeClass("qpx-state-selected");
            this.$tbody.find(".qpx-datagrid-select-checkbox").prop("checked", false);
            this._selectedKeys.forEach(function (k) {
                var $row = this.$tbody.find("[data-key='" + k + "']");
                $row.addClass("qpx-state-selected");
                $row.find(".qpx-datagrid-select-checkbox").prop("checked", true);
            }.bind(this));

            if (this._$selectAllCheckbox) {
                var allKeys = this._getFilteredData().map(function (r) { return r[cfg.keyExpr]; });
                var allSelected = allKeys.length > 0 && allKeys.every(function (k) { return this._selectedKeys.indexOf(k) !== -1; }.bind(this));
                this._$selectAllCheckbox.prop("checked", allSelected);
            }

            this.trigger("rowClick", { data: row, key: key, component: this, rowElement: $tr[0] });

            if (cfg.selection.mode !== "none") {
                this.trigger("selectionChanged", {
                    selectedRowKeys: this._selectedKeys.slice(),
                    previousRowKeys: prev,
                    component: this
                });
            }
        },

        _handleCellClick: function (row, col, $td) {
            var key = row[this.config.keyExpr];
            this.trigger("cellClick", {
                data: row, key: key, column: col, field: col.dataField,
                cellElement: $td[0], component: this
            });
        },

        getSelectedRowKeys: function () { return this._selectedKeys.slice(); },
        getSelectedRowsData: function () {
            var cfg = this.config;
            return cfg.dataSource.filter(function (r) { return this._selectedKeys.indexOf(r[cfg.keyExpr]) !== -1; }.bind(this));
        },
        selectRows: function (keys, preserve) {
            this._selectedKeys = preserve ? this._selectedKeys.concat(keys) : keys.slice();
            this._renderBody();
            this.trigger("selectionChanged", { selectedRowKeys: this._selectedKeys.slice(), previousRowKeys: [], component: this });
            return this;
        },
        deselectRows: function (keys) {
            this._selectedKeys = this._selectedKeys.filter(function (k) { return keys.indexOf(k) === -1; });
            this._renderBody();
            this.trigger("selectionChanged", { selectedRowKeys: this._selectedKeys.slice(), previousRowKeys: [], component: this });
            return this;
        },
        clearSelection: function () { return this.selectRows([]); },

        // ---------------------------------------------------------------
        // Adaptivní (responzivní) sloupce — akordeon detail pod řádkem
        // ---------------------------------------------------------------
        // Spočítá, které sloupce se při aktuální šířce kontejneru nevejdou
        // a musí se schovat do akordeonu pod řádkem. Sloupce, které se
        // rozhodneme skrýt, se NEVYKRESLUJÍ (viz _visibleColumns) —
        // tabulka má table-layout:fixed a pevný počet <col> v <colgroup>,
        // takže pouhé schování <th>/<td> přes display:none (jak to dělala
        // původní verze) rozhodí přiřazení <col> šířek ke zbývajícím
        // buňkám a layout se rozsype. Proto se místo skrývání buněk
        // sloupec z DOM úplně vynechá a zbylé sloupce se korektně
        // roztáhnou přes celou šířku (stejně jako u dxDataGrid).
        _computeAdaptiveLayout: function () {
            var cfg = this.config;
            var cols = this._configuredColumns();

            cols.forEach(function (col) { col.adaptiveHidden = false; });
            this._adaptiveActive = false;

            if (!cfg.responsive || !this.$table || !this.$table.length) {
                return;
            }

            var availableWidth = this.$table.parent().width();
            if (!availableWidth) { return; }

            // Pro odhad SKUTEČNĚ obsazené šířky musí mít přednost reálná
            // vykreslená šířka sloupce (col.width) — tabulka je
            // table-layout:fixed, takže se sloupec vždy vykreslí přesně
            // na tuto šířku (na rozdíl od minWidth, které je jen pomocná
            // hranice pro rozhodování, které sloupce schovat dřív/později).
            // Použití minWidth jako prioritního odhadu způsobovalo, že se
            // adaptivní skrývání spustilo pozdě a tabulka mezitím reálně
            // přetékala (dole se objevil vodorovný scrollbar).
            function colWidth(col) { return col.width || col.minWidth || 80; }

            // rezervovaná šířka sloupců, které nejsou v `cols` (výběr,
            // editační příkazy, "⋯" pro akordeon) — musí se také vejít
            var reservedWidth = 0;
            if (this._isMultipleSelection() && this._showCheckBoxes()) { reservedWidth += 36; }
            if (this._editingEnabled()) { reservedWidth += 76; }
            reservedWidth += 40; // sloupec "⋯", se kterým je nutno počítat i než se zjistí, že je potřeba

            var totalWidth = reservedWidth;
            cols.forEach(function (col) { totalWidth += colWidth(col); });

            var needAdaptive = totalWidth > availableWidth;
            if (!needAdaptive) { return; }

            var remaining = totalWidth;
            cols.slice().reverse().forEach(function (col) {
                if (remaining <= availableWidth) { return; }
                col.adaptiveHidden = true;
                remaining -= colWidth(col);
            });

            this._adaptiveActive = cols.some(function (c) { return c.adaptiveHidden; });
        },

        _openAdaptiveAccordion: function (key, row, $row) {
            var self = this;
            this._closeAdaptiveAccordion();

            var cols = this.config.columns.filter(function (c) { return c.visible !== false && c.adaptiveHidden; });
            if (!cols.length) { return; }

            var colspan = this.$thead.find("tr").first().find("th").length;

            var $detail = $("<tr class='qpx-datagrid-detail-row'></tr>");
            var $td = $("<td class='qpx-datagrid-detail-cell'></td>").attr("colspan", colspan);
            var $acc = $("<div class='qpx-datagrid-accordion'></div>");

            cols.forEach(function (col) {
                var rawValue = qpx.isFunction(col.calculateCellValue) ? col.calculateCellValue(row) : row[col.dataField];

                var $item = $("<div class='qpx-datagrid-accordion-item'></div>");
                var $header = $("<div class='qpx-datagrid-accordion-header'></div>").text(col.caption || col.dataField);
                // hodnota se zobrazuje rovnou, ne až po dalším kliku
                var $content = $("<div class='qpx-datagrid-accordion-content'></div>");

                if (qpx.isFunction(col.cellTemplate)) {
                    var result = col.cellTemplate.call(self, $content[0], { value: rawValue, data: row, column: col });
                    if (result !== undefined && result !== null) { $content.append(result); }
                } else {
                    $content.text(self._formatCellValue(rawValue, col));
                }

                $item.append($header, $content);
                $acc.append($item);
            });

            $td.append($acc);
            $detail.append($td);
            $row.after($detail);
            this._adaptiveOpenRowKey = key;
        },

        _closeAdaptiveAccordion: function () {
            this.$tbody.find(".qpx-datagrid-detail-row").remove();
            this._adaptiveOpenRowKey = null;
        },

        _toggleAdaptiveAccordion: function (key, row, $row) {
            if (this._adaptiveOpenRowKey === key) { this._closeAdaptiveAccordion(); return; }
            this._openAdaptiveAccordion(key, row, $row);
        },

        // ---------------------------------------------------------------
        // Editace (row mode) — add / edit / delete
        // ---------------------------------------------------------------
        addRow: function () {
            var cfg = this.config;
            var data = {};
            cfg.columns.forEach(function (c) { data[c.dataField] = (c.dataType === "boolean") ? false : ""; });
            data[cfg.keyExpr] = qpx.uid("new");

            this._editRowData = data;
            this._editRowKey = data[cfg.keyExpr];
            this._isNewRow = true;

            this.trigger("editingStart", { data: data, key: this._editRowKey, isNewRow: true, component: this });
            this._renderBody();
            return this;
        },

        editRow: function (key) {
            var cfg = this.config;
            var row = cfg.dataSource.filter(function (r) { return r[cfg.keyExpr] === key; })[0];
            if (!row) { return this; }

            this._editRowData = $.extend({}, row);
            this._editRowKey = key;
            this._isNewRow = false;

            this.trigger("editingStart", { data: row, key: key, isNewRow: false, component: this });
            this._renderBody();
            return this;
        },

        deleteRow: function (key) {
            var cfg = this.config;
            if (cfg.editing.confirmDelete && !window.confirm("Opravdu smazat tento záznam?")) { return this; }

            var row = cfg.dataSource.filter(function (r) { return r[cfg.keyExpr] === key; })[0];
            cfg.dataSource = cfg.dataSource.filter(function (r) { return r[cfg.keyExpr] !== key; });
            this.config.dataSource = cfg.dataSource;

            this._selectedKeys = this._selectedKeys.filter(function (k) { return k !== key; });

            this.trigger("rowRemoved", { data: row, key: key, component: this });
            this._pageIndex = Math.min(this._pageIndex, Math.max(0, this.pageCount() - 1));
            this._renderAll();
            return this;
        },

        saveEditData: function () {
            var cfg = this.config;
            if (!this._editRowData) { return this; }

            if (this._isNewRow) {
                cfg.dataSource.push($.extend({}, this._editRowData));
                this.trigger("rowInserted", { data: this._editRowData, key: this._editRowKey, component: this });
            } else {
                var idx = -1;
                for (var i = 0; i < cfg.dataSource.length; i++) {
                    if (cfg.dataSource[i][cfg.keyExpr] === this._editRowKey) { idx = i; break; }
                }
                if (idx > -1) {
                    $.extend(cfg.dataSource[idx], this._editRowData);
                    this.trigger("rowUpdated", { data: cfg.dataSource[idx], key: this._editRowKey, component: this });
                }
            }

            this._editRowKey = null;
            this._editRowData = null;
            this._isNewRow = false;

            this._renderAll();
            return this;
        },

        cancelEditData: function () {
            this._editRowKey = null;
            this._editRowData = null;
            this._isNewRow = false;
            this._renderBody();
            return this;
        },

        hasEditData: function () { return this._editRowData !== null; },

        // ---------------------------------------------------------------
        // Stránkování / hledání / filtr — veřejné API
        // ---------------------------------------------------------------
        pageIndex: function (idx) {
            if (idx === undefined) { return this._pageIndex; }
            var count = this.pageCount();
            this._pageIndex = Math.max(0, Math.min(idx, count - 1));
            this._renderBody();
            this._renderPager();
            return this;
        },

        pageSize: function (size) {
            if (size === undefined) { return this.config.paging.pageSize; }
            this.config.paging.pageSize = size;
            this._pageIndex = 0;
            this._renderBody();
            this._renderPager();
            return this;
        },

        pageCount: function () {
            var total = this._getFilteredData().length;
            var size = this.config.paging.pageSize || total || 1;
            return Math.max(1, Math.ceil(total / size));
        },

        searchByText: function (text) {
            this._searchText = text || "";
            this.$searchInput.val(this._searchText);
            this._pageIndex = 0;
            this._renderBody();
            this._renderPager();
            return this;
        },

        clearFilter: function () {
            this._filterValues = {};
            this._searchText = "";
            this.$searchInput.val("");
            this.$thead.find(".qpx-datagrid-filter-input").val("");
            this._pageIndex = 0;
            this._renderBody();
            this._renderPager();
            return this;
        },

        // ---------------------------------------------------------------
        // Ostatní veřejné API
        // ---------------------------------------------------------------
        getDataSource: function () { return this.config.dataSource; },

        getRowElement: function (key) {
            var el = this.$tbody.find("[data-key='" + key + "']");
            return el.length ? el[0] : undefined;
        },

        columnOption: function (dataField, optionName, value) {
            var col = this.config.columns.filter(function (c) { return c.dataField === dataField; })[0];
            if (!col) { return undefined; }
            if (value === undefined) { return col[optionName]; }
            col[optionName] = value;
            this._renderAll();
            return this;
        },

        // ---------------------------------------------------------------
        // option() — vč. podpory tečkové cesty, např. "paging.pageSize"
        // ---------------------------------------------------------------
        option: function (name, value) {
            if (arguments.length === 0) { return this.config; }
            if (qpx.isObject(name)) {
                var self = this;
                $.each(name, function (k, v) { self.option(k, v); });
                return this;
            }
            if (arguments.length === 1) { return qpx.resolve(this.config, name); }

            var rootName = String(name).split(".")[0];

            if (name.indexOf(".") > -1) {
                var parts = name.split(".");
                var obj = this.config;
                for (var i = 0; i < parts.length - 1; i++) {
                    obj[parts[i]] = obj[parts[i]] || {};
                    obj = obj[parts[i]];
                }
                obj[parts[parts.length - 1]] = value;
            } else {
                if (this.config[name] === value) { return this; }
                this.config[name] = value;
            }

            this._applyOption(rootName);
            this.trigger("optionChanged", { name: name, value: value, component: this });
            return this;
        },

        _applyOption: function (rootName) {
            var cfg = this.config;

            switch (rootName) {
                case "dataSource":
                case "columns":
                    this._pageIndex = 0;
                    this._renderAll();
                    break;

                case "selectionMode":
                    cfg.selection.mode = cfg.selectionMode;
                    this._selectedKeys = [];
                    this._renderAll();
                    break;

                case "selection":
                case "sorting":
                case "paging":
                case "pager":
                case "filterRow":
                case "searchPanel":
                case "editing":
                case "responsive":
                case "noDataText":
                    this._renderAll();
                    break;

                case "visible":
                    this.$container.toggleClass("qpx-hidden", !cfg.visible);
                    break;
                case "disabled":
                    this.$container.toggleClass("qpx-state-disabled", !!cfg.disabled);
                    break;
                case "rowAlternationEnabled":
                    this.$container.toggleClass("qpx-datagrid-alternation", !!cfg.rowAlternationEnabled);
                    this._renderBody();
                    break;
                case "showBorders":
                    this.$container.toggleClass("qpx-datagrid-no-borders", !cfg.showBorders);
                    break;
                case "showRowLines":
                    this.$container.toggleClass("qpx-datagrid-no-row-lines", !cfg.showRowLines);
                    break;
                case "showColumnLines":
                    this.$container.toggleClass("qpx-datagrid-no-column-lines", !cfg.showColumnLines);
                    break;
                case "wordWrapEnabled":
                    this.$container.toggleClass("qpx-datagrid-wordwrap", !!cfg.wordWrapEnabled);
                    break;
                case "allowColumnResizing":
                    this._renderHeader();
                    break;
            }
        },

        destroy: function () {
            if (this._resizeObserver) { this._resizeObserver.disconnect(); this._resizeObserver = null; }
            $(window).off(".qpxDataGrid" + this.id);
            $(document).off(".qpxDataGridResize");
            this.$container.off(".qpxDataGrid");
            this._super();
        }
    });

    qpx.registerWidget("qpDataGrid", DataGrid);
    qpx.qpDataGrid = DataGrid;

})(window.qpx, jQuery);
