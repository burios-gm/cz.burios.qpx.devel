/*!
 * qpx - qpGroupList
 * Seznam s položkami rozdělenými do skupin, inspirovaný Webix GroupList
 * (typicky seznam kontaktů seskupených podle prvního písmene, úkolů podle
 * stavu apod.):
 *  - "data": plochý seznam { id, group, text, icon, disabled }, widget si
 *    položky sám seskupí podle pole "group" (groupBy)
 *  - záhlaví skupiny při scrollování "lepí" nahoře scrollovatelné oblasti
 *    (position: sticky, čistě CSS - stejný princip jako u responzivní
 *    mřížky v qpScrollView, žádný JS listener na scroll není potřeba)
 *  - volitelný boční rychlý index (showIndex) pro skok na skupinu
 *  - jednoduchý (single) i vícenásobný (multiselect) výběr, klávesová
 *    navigace šipkami
 *  - "drillDown": hierarchické procházení dat "na místě" (bez vnořeného
 *    breadcrumb) - položky mohou mít vlastní pole "children" (další
 *    úroveň se stejnou strukturou); klik na položku s potomky zobrazí
 *    tuto další úroveň, nahoře se automaticky objeví klikatelný řádek
 *    "Zpět" pro návrat o úroveň výš (inspirováno Webix GroupList
 *    drill-down ukázkou)
 *
 * options:
 *   data, groupBy, sortGroups, value, multiselect, stickyHeaders,
 *   showIndex, height, disabled, visible, groupTemplate, itemTemplate,
 *   drillDown, drillIcon, backIcon, backLabel, backTemplate
 *
 * events:
 *   onItemClick, onSelectionChanged, onDrillChange, onOptionChanged
 *
 * methods:
 *   option(name[, value]), value([val]), data([data]),
 *   select(id[, addToSelection]), unselect(id),
 *   getSelectedItem(), getSelectedItems(), scrollToGroup(key[, animate]),
 *   drillInto(node), drillUp(), drillReset(), getDrillPath(), getDrillLevel(),
 *   enable(), disable(), focus()
 */
(function (qpx, $) {
    "use strict";

    var GroupList = qpx.Widget.extend({

        defaults: {
            data: [],                // [{ id, group, text, icon, disabled }]
            groupBy: "group",         // název pole, podle kterého se seskupuje
            sortGroups: false,        // seřadit skupiny abecedně (jinak pořadí prvního výskytu)

            value: null,              // single: id vybrané položky; multiselect: pole id
            multiselect: false,

            stickyHeaders: true,      // "lepivé" záhlaví skupiny při scrollování (CSS sticky)
            showIndex: false,         // boční rychlý index (A, B, C, ...) pro skok na skupinu
            height: null,             // volitelná výška (px); jinak 100 % rodiče

            disabled: false,
            visible: true,

            groupTemplate: null,      // function(groupKey, items) -> html; default = groupKey
            itemTemplate: null,       // function(item) -> html; default = item.text

            // --- drill-down (hierarchické procházení bez breadcrumb) -------
            drillDown: false,         // zapne procházení "children" na místě
            drillIcon: "fa-angle-right",  // ikona u položky, která má potomky
            backIcon: "fa-angle-left",    // ikona řádku "Zpět"
            backLabel: "Zpět",            // výchozí text řádku "Zpět"
            backTemplate: null,       // function(parentNode, path) -> html; přepíše vzhled řádku "Zpět"

            onItemClick: null,
            onSelectionChanged: null,
            onDrillChange: null,
            onOptionChanged: null
        },

        // ---------------------------------------------------------------
        render: function () {
            var cfg = this.config;

            this.$container
                .addClass("qpx-grouplist")
                .toggleClass("qpx-hidden", !cfg.visible)
                .toggleClass("qpx-state-disabled", !!cfg.disabled)
                .toggleClass("qpx-grouplist-no-sticky", !cfg.stickyHeaders)
                .attr("role", "listbox")
                .attr("aria-multiselectable", !!cfg.multiselect);

            this.$container.css("height", cfg.height != null ? qpx.toPx(cfg.height) : "");

            if (cfg.onItemClick) { this.off("itemClick"); this.on("itemClick", cfg.onItemClick); }
            if (cfg.onSelectionChanged) { this.off("selectionChanged"); this.on("selectionChanged", cfg.onSelectionChanged); }
            if (cfg.onDrillChange) { this.off("drillChange"); this.on("drillChange", cfg.onDrillChange); }
            if (cfg.onOptionChanged) { this.off("optionChanged"); this.on("optionChanged", cfg.onOptionChanged); }

            if (!this._path) { this._path = []; } // aktuální pozice v hierarchii (drillDown)

            this._normalizeValue();
            this._buildDom();
            this._renderList();
            this._bindKeys();
        },

        // ---------------------------------------------------------------
        // DOM
        // ---------------------------------------------------------------
        _buildDom: function () {
            var cfg = this.config;

            this.$container.empty();

            this.$scroller = $("<div class='qpx-grouplist-scroller'></div>")
                .attr("tabindex", cfg.disabled ? "-1" : "0");
            this.$container.append(this.$scroller);

            if (cfg.showIndex) {
                this.$index = $("<div class='qpx-grouplist-index'></div>");
                this.$container.append(this.$index);
            } else {
                this.$index = null;
            }
        },

        _normalizeValue: function () {
            var cfg = this.config;
            if (cfg.multiselect) {
                cfg.value = $.isArray(cfg.value) ? cfg.value : (cfg.value != null ? [cfg.value] : []);
            } else if ($.isArray(cfg.value)) {
                cfg.value = cfg.value.length ? cfg.value[0] : null;
            }
        },

        // položky aktuálně zobrazené úrovně: kořen ("data"), nebo "children"
        // posledního uzlu v _path, pokud je drillDown zapnuté a jsme níž
        _currentItems: function () {
            var cfg = this.config;
            if (cfg.drillDown && this._path && this._path.length) {
                var parent = this._path[this._path.length - 1];
                return (parent && parent.children) || [];
            }
            return cfg.data || [];
        },

        _groupData: function (items) {
            var cfg = this.config;
            var groups = [];
            var map = {};

            (items || []).forEach(function (item) {
                var key = item[cfg.groupBy] != null ? String(item[cfg.groupBy]) : "";
                if (!map[key]) {
                    map[key] = { key: key, items: [] };
                    groups.push(map[key]);
                }
                map[key].items.push(item);
            });

            if (cfg.sortGroups) {
                groups.sort(function (a, b) { return a.key.localeCompare(b.key, "cs"); });
            }
            return groups;
        },

        _escape: function (str) {
            return $("<div></div>").text(str == null ? "" : String(str)).html();
        },

        // ---------------------------------------------------------------
        _renderList: function () {
            var self = this;
            var cfg = this.config;

            this.$scroller.empty();
            if (this.$index) { this.$index.empty(); }

            if (cfg.drillDown && this._path && this._path.length) {
                this.$scroller.append(this._buildBackNode());
            }

            var groups = this._groupData(this._currentItems());
            this._groupNodes = {};

            groups.forEach(function (g) {
                var $header = $("<div class='qpx-grouplist-group-header'></div>")
                    .attr("data-qpx-group", g.key)
                    .html(cfg.groupTemplate ? cfg.groupTemplate(g.key, g.items) : self._escape(g.key));
                self.$scroller.append($header);
                self._groupNodes[g.key] = $header;

                g.items.forEach(function (item) {
                    self.$scroller.append(self._buildItemNode(item));
                });

                if (self.$index) {
                    var $idxItem = $("<button type='button' class='qpx-grouplist-index-item'></button>")
                        .text((g.key || "").charAt(0).toUpperCase() || "•")
                        .attr("title", g.key)
                        .attr("aria-label", g.key);
                    $idxItem.on("click.qpxGroupList", function () { self.scrollToGroup(g.key); });
                    self.$index.append($idxItem);
                }
            });
        },

        // řádek "Zpět" nahoře seznamu, jsme-li v drillDown módu níž než
        // v kořeni - klik (nebo Enter/mezerník) odscrolluje o úroveň výš
        _buildBackNode: function () {
            var self = this;
            var cfg = this.config;
            var parent = this._path[this._path.length - 1];

            var html = cfg.backTemplate
                ? cfg.backTemplate(parent, this._path.slice())
                : ("<i class='fa " + cfg.backIcon + "'></i><span>" + this._escape(cfg.backLabel) + "</span>");

            var $back = $("<div class='qpx-grouplist-back' role='button' tabindex='0'></div>").html(html);

            $back.on("click.qpxGroupList", function () { self.drillUp(); });
            $back.on("keydown.qpxGroupList", function (e) {
                if (e.key === "Enter" || e.key === " ") { e.preventDefault(); self.drillUp(); }
            });

            return $back;
        },

        _buildItemNode: function (item) {
            var self = this;
            var cfg = this.config;
            var isDisabled = !!item.disabled || !!cfg.disabled;
            var isSelected = this._isSelected(item.id);

            var $it = $("<div></div>")
                .addClass("qpx-grouplist-item")
                .toggleClass("qpx-state-disabled", isDisabled)
                .toggleClass("qpx-state-selected", isSelected)
                .attr("data-qpx-id", item.id)
                .attr("role", "option")
                .attr("aria-selected", isSelected ? "true" : "false")
                .attr("tabindex", "-1")
                .data("qpx-item", item);

            if (item.icon) {
                $it.append($("<i></i>").addClass("fa " + item.icon + " qpx-grouplist-item-icon"));
            }

            var $text = $("<span class='qpx-grouplist-item-text'></span>");
            if (cfg.itemTemplate) { $text.html(cfg.itemTemplate(item)); }
            else { $text.text(item.text != null ? item.text : ""); }
            $it.append($text);

            if (cfg.drillDown && item.children && item.children.length) {
                $it.addClass("qpx-grouplist-item-drillable");
                $it.append($("<i></i>").addClass("fa " + cfg.drillIcon + " qpx-grouplist-item-drill"));
            }

            if (!isDisabled) {
                $it.on("click.qpxGroupList", function () { self._handleItemClick(item); });
            }

            return $it;
        },

        _isSelected: function (id) {
            var v = this.config.value;
            if (this.config.multiselect) { return $.isArray(v) && v.indexOf(id) >= 0; }
            return v === id;
        },

        _handleItemClick: function (item) {
            this.trigger("itemClick", { item: item, component: this, element: this.getNode() });

            if (this.config.drillDown && item.children && item.children.length) {
                this.drillInto(item);
                return;
            }

            if (this.config.multiselect) {
                var val = (this.config.value || []).slice();
                var idx = val.indexOf(item.id);
                if (idx >= 0) { val.splice(idx, 1); } else { val.push(item.id); }
                this.option("value", val);
            } else {
                this.option("value", item.id);
            }
        },

        // ---------------------------------------------------------------
        // Klávesová navigace (šipky/Home/End) mezi (ne-disabled) položkami
        // ---------------------------------------------------------------
        _bindKeys: function () {
            var self = this;

            this.$scroller.off("keydown.qpxGroupList");
            this.$scroller.on("keydown.qpxGroupList", function (e) {
                if (self.config.disabled) { return; }

                if (e.key === "Escape" && self.config.drillDown) { e.preventDefault(); self.drillUp(); return; }

                var $items = self.$scroller.find(".qpx-grouplist-item:not(.qpx-state-disabled)");
                if (!$items.length) { return; }

                var currentId = self.config.multiselect
                    ? (self.config.value || [])[(self.config.value || []).length - 1]
                    : self.config.value;

                var idx = -1;
                $items.each(function (i) {
                    var it = $(this).data("qpx-item");
                    if (it && it.id === currentId) { idx = i; }
                });

                if (e.key === "ArrowDown") { e.preventDefault(); self._selectByIndex($items, Math.min($items.length - 1, idx + 1)); }
                else if (e.key === "ArrowUp") { e.preventDefault(); self._selectByIndex($items, Math.max(0, idx <= 0 ? 0 : idx - 1)); }
                else if (e.key === "Home") { e.preventDefault(); self._selectByIndex($items, 0); }
                else if (e.key === "End") { e.preventDefault(); self._selectByIndex($items, $items.length - 1); }
            });
        },

        _selectByIndex: function ($items, idx) {
            var $it = $items.eq(idx);
            var item = $it.data("qpx-item");
            if (!item) { return; }
            this._handleItemClick(item);
            if ($it[0] && $it[0].scrollIntoView) { $it[0].scrollIntoView({ block: "nearest" }); }
        },

        // ---------------------------------------------------------------
        // Veřejné API
        // ---------------------------------------------------------------
        value: function (val) {
            if (arguments.length === 0) { return this.config.value; }
            return this.option("value", val);
        },

        data: function (newData) {
            if (arguments.length === 0) { return this.config.data; }
            return this.option("data", newData);
        },

        select: function (id, addToSelection) {
            if (this.config.multiselect) {
                var val = addToSelection ? (this.config.value || []).slice() : [];
                if (val.indexOf(id) < 0) { val.push(id); }
                return this.option("value", val);
            }
            return this.option("value", id);
        },

        unselect: function (id) {
            if (this.config.multiselect) {
                var val = (this.config.value || []).slice();
                var idx = val.indexOf(id);
                if (idx >= 0) { val.splice(idx, 1); }
                return this.option("value", val);
            }
            if (this.config.value === id) { return this.option("value", null); }
            return this;
        },

        // rekurzivně sloučí data (i s vnořenými "children") do jednoho pole -
        // používá se pro hledání položek podle id, ať leží v jakékoli hloubce
        _flattenTree: function (nodes) {
            var out = [];
            (nodes || []).forEach(function walk(item) {
                out.push(item);
                if (item.children && item.children.length) { item.children.forEach(walk); }
            });
            return out;
        },

        getSelectedItem: function () {
            var id = this.config.multiselect ? (this.config.value || [])[0] : this.config.value;
            var found = null;
            this._flattenTree(this.config.data).some(function (it) {
                if (it.id === id) { found = it; return true; }
                return false;
            });
            return found;
        },

        getSelectedItems: function () {
            var ids = this.config.multiselect ? (this.config.value || []) : (this.config.value != null ? [this.config.value] : []);
            return this._flattenTree(this.config.data).filter(function (it) { return ids.indexOf(it.id) >= 0; });
        },

        scrollToGroup: function (key, animate) {
            var $header = this._groupNodes && this._groupNodes[key];
            if (!$header || !$header.length) { return this; }

            var top = $header.position().top + this.$scroller.scrollTop();
            if (animate === undefined) { animate = true; }

            if (animate) { this.$scroller.stop(true).animate({ scrollTop: top }, 200); }
            else { this.$scroller.scrollTop(top); }
            return this;
        },

        // --- drill-down navigace ---------------------------------------
        drillInto: function (node) {
            if (!node || !node.children || !node.children.length) { return this; }
            if (!this._path) { this._path = []; }
            this._path.push(node);
            this._renderList();
            this.trigger("drillChange", {
                level: this._path.length,
                node: node,
                path: this._path.slice(),
                direction: "down",
                component: this,
                element: this.getNode()
            });
            return this;
        },

        drillUp: function () {
            if (!this._path || !this._path.length) { return this; }
            this._path.pop();
            this._renderList();
            this.trigger("drillChange", {
                level: this._path.length,
                node: this._path.length ? this._path[this._path.length - 1] : null,
                path: this._path.slice(),
                direction: "up",
                component: this,
                element: this.getNode()
            });
            return this;
        },

        drillReset: function () {
            if (!this._path || !this._path.length) { return this; }
            this._path = [];
            this._renderList();
            this.trigger("drillChange", {
                level: 0,
                node: null,
                path: [],
                direction: "up",
                component: this,
                element: this.getNode()
            });
            return this;
        },

        getDrillPath: function () { return (this._path || []).slice(); },
        getDrillLevel: function () { return this._path ? this._path.length : 0; },

        enable: function () { return this.option("disabled", false); },
        disable: function () { return this.option("disabled", true); },
        focus: function () { this.$scroller.trigger("focus"); return this; },

        // option("x") -> čtení; option("x", v) -> zápis; option({x:..}) -> hromadně
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
                    if (this.config.multiselect) {
                        this.config.value = $.isArray(value) ? value.slice() : (value != null ? [value] : []);
                    } else {
                        this.config.value = $.isArray(value) ? (value.length ? value[0] : null) : value;
                    }
                    this._renderList();
                    this.trigger("selectionChanged", {
                        value: this.config.value,
                        previousValue: prev,
                        component: this,
                        element: this.getNode()
                    });
                    break;

                case "visible":
                    this.$container.toggleClass("qpx-hidden", !value);
                    break;

                case "disabled":
                    this.$container.toggleClass("qpx-state-disabled", !!value);
                    this.$scroller.attr("tabindex", value ? "-1" : "0");
                    this._renderList();
                    break;

                case "stickyHeaders":
                    this.$container.toggleClass("qpx-grouplist-no-sticky", !value);
                    break;

                case "height":
                    this.$container.css("height", value != null ? qpx.toPx(value) : "");
                    break;

                case "showIndex":
                    // mění strukturu DOM (přidání/odebrání panelu indexu) -
                    // nejjednodušší a nejspolehlivější je kompletní refresh
                    this.refresh();
                    break;

                case "data":
                    // nová kořenová data - stará pozice v hierarchii by mohla
                    // ukazovat na uzly, které už neexistují
                    this._path = [];
                    this._normalizeValue();
                    this._renderList();
                    break;

                // groupBy/sortGroups/multiselect/groupTemplate/itemTemplate/
                // drillDown/drillIcon/backIcon/backLabel/backTemplate
                default:
                    this._normalizeValue();
                    this._renderList();
                    break;
            }

            this.trigger("optionChanged", { name: name, value: value, previousValue: prev, component: this });
            return this;
        },

        destroy: function () {
            if (this.$index) { this.$index.off(".qpxGroupList"); }
            if (this.$scroller) { this.$scroller.off(".qpxGroupList"); }
            this.$container.off(".qpxGroupList");
            this._super();
        }
    });

    qpx.registerWidget("qpGroupList", GroupList);
    qpx.qpGroupList = GroupList;

})(window.qpx, jQuery);
