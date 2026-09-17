/*!
 * qpx - qpRibbon
 * "Pás karet" ve stylu MS Office (Word/Excel Online) - přepracování
 * původního jQuery pluginu jquery.ribbon.js (div.officebar) do podoby
 * qpx widgetu. Struktura zůstala koncepčně stejná jako v originále
 * (karty -> skupiny -> položky), ale položky ("items") už NEJSOU jen
 * kus HTML - každá je samostatná instance existujícího qpx widgetu
 * (qpRibbonButton, qpRibbonDropDownButton, qpTextBox, qpNumberBox, qpCheckBox, ...),
 * se kterou lze dál pracovat úplně stejně, jako by byla vytvořená
 * samostatně přes qpx.ui() - viz getItemWidget().
 *
 * Struktura konfigurace (tabs -> groups -> items):
 *
 *   qpx.ui({
 *       view: "qpRibbon",
 *       activeTabKey: "home",
 *       tabs: [{
 *           key: "home", text: "Domů",
 *           groups: [{
 *               key: "clipboard", title: "Schránka",
 *               items: [
 *                   { widget: "qpRibbonButton", size: "large", options: { text: "Vložit", icon: "...", onClick: fn } },
 *                   { widget: "qpRibbonButton", stack: true, options: { text: "Kopírovat", icon: "...", onClick: fn } },
 *                   { widget: "qpRibbonButton", stack: true, options: { text: "Vyjmout", icon: "...", onClick: fn } },
 *                   { type: "separator" },
 *                   { widget: "qpDropDownButton", options: { text: "Vložit jinak", splitButton: true, items: [...] } }
 *               ]
 *           }, {
 *               key: "font", title: "Písmo",
 *               items: [
 *                   { widget: "qpTextBox", options: { width: 90, value: "Calibri" } },
 *                   { widget: "qpNumberBox", options: { width: 50, value: 11, min: 1, max: 400 } }
 *               ]
 *           }]
 *       }]
 *   }, "#ribbon");
 *
 * Konfigurace položky (item):
 *   {
 *     widget: "qpRibbonButton" | "qpRibbonDropDownButton" | "qpTextBox" | "qpNumberBox" |
 *             "qpCheckBox" | ... (libovolný zaregistrovaný qpx widget;
 *             výchozí, pokud "widget" chybí, je "qpRibbonButton"),
 *     type:   "separator" | "template"  (alternativa k "widget"),
 *     template: function(itemCfg, $cell)   // jen pro type:"template"
 *     size:  "large" | "small"           // pro qpRibbonButton/qpRibbonDropDownButton -
 *                                         // viz qpx.ribbonbutton.js / qpx.ribbondropdownbutton.js
 *     stack: true | false                // true = zařadí položku do svislého "mini-sloupce" spolu se sousedními stack:true položkami
 *     options: { ...konfigurace vnitřního widgetu, vč. onClick/onValueChanged apod. }
 *   }
 *
 * options (widget qpRibbon):
 *   tabs, activeTabKey, collapsible, collapsed, disabled, visible, theme
 *
 * events:
 *   onInitialized, onContentReady, onTabChanged ({ key, previousKey, component }),
 *   onItemClick (agregovaně za všechny typy položek - stejně jako u qpToolBar),
 *   onOptionChanged, onDisposing
 *
 * methods:
 *   option(name[, value]), getActiveTabKey(), setActiveTab(key),
 *   collapse(), expand(), toggleCollapse(), isCollapsed(),
 *   getItemWidget(tabKey, groupKey, itemIndex), addTab(tabCfg[, beforeKey]),
 *   removeTab(key), enable(), disable(), destroy()
 *
 * Pozn. k tématu: qpRibbon se (stejně jako qpToolBar/qpTextBox/qpTabView/
 * qpDataGrid) vykresluje čistě přes CSS proměnné (--qpx-*), takže žádné
 * theme sám nevynucuje - normálně zdědí motiv z okolí (typicky <body>,
 * viz qpx.setTheme()). Volitelná options.theme slouží jen k vynucení
 * konkrétního motivu na jedné konkrétní instanci.
 */
(function (qpx, $) {
    "use strict";

    var Ribbon = qpx.Widget.extend({

        defaults: {
            tabs: [],
            activeTabKey: null,      // null = použije se key první karty
            collapsible: true,
            collapsed: false,
            disabled: false,
            visible: true,
            theme: null,             // volitelné vynucení tématu jen pro tuto instanci

            onTabChanged: null,
            onItemClick: null,
            onOptionChanged: null,
            onInitialized: null,
            onContentReady: null,
            onDisposing: null
        },

        // ---------------------------------------------------------------
        render: function () {
            var cfg = this.config;
            var self = this;

            this.$container
                .addClass("qpx-ribbon")
                .toggleClass("qpx-hidden", !cfg.visible)
                .toggleClass("qpx-state-disabled", !!cfg.disabled)
                .toggleClass("qpx-ribbon-collapsed", !!cfg.collapsed)
                .attr("role", "navigation");

            if (cfg.theme) { this.$container.addClass("qpx-theme-" + cfg.theme); }

            if (cfg.onTabChanged) { this.on("tabChanged", cfg.onTabChanged); }
            if (cfg.onItemClick) { this.on("itemClick", cfg.onItemClick); }
            if (cfg.onOptionChanged) { this.on("optionChanged", cfg.onOptionChanged); }
            if (cfg.onInitialized) { this.on("ready", cfg.onInitialized); }
            if (cfg.onContentReady) { this.on("contentReady", cfg.onContentReady); }
            if (cfg.onDisposing) { this.on("destroy", cfg.onDisposing); }

            if (!cfg.activeTabKey && cfg.tabs.length) { cfg.activeTabKey = cfg.tabs[0].key; }

            this._itemRefs = [];   // { tabKey, groupKey, itemIndex, widget, $cell }
            this._tabRefs = {};    // key -> { $tab, $panel, config }

            this._buildDom();

            var self2 = this;
            setTimeout(function () { self2.trigger("contentReady", { component: self2 }); }, 0);
        },

        // ---------------------------------------------------------------
        // DOM
        // ---------------------------------------------------------------
        _buildDom: function () {
            var self = this;
            var cfg = this.config;

            this._destroyItemWidgets();
            this.$container.empty();
            this._tabRefs = {};

            this.$tabsList = $("<div class='qpx-ribbon-tabs' role='tablist'></div>");

            this.$collapseBtn = $("<div class='qpx-ribbon-collapse-btn' role='button' tabindex='0' title='Sbalit/rozbalit pás karet'></div>")
                .html("&#9650;")
                .toggle(!!cfg.collapsible);

            this.$tabStrip = $("<div class='qpx-ribbon-tabstrip'></div>").append(this.$tabsList, this.$collapseBtn);

            this.$panels = $("<div class='qpx-ribbon-panels'></div>");

            this.$container.append(this.$tabStrip, this.$panels);

            cfg.tabs.forEach(function (tabCfg) {
                self._buildTab(tabCfg);
            });

            this._updateCollapseIcon();
            this._bindEvents();
            this._applyActiveTab();
        },

        _buildTab: function (tabCfg) {
            var self = this;
            var cfg = this.config;

            var $tab = $("<div class='qpx-ribbon-tab' role='tab' tabindex='0'></div>")
                .text(tabCfg.text || tabCfg.key)
                .toggleClass("qpx-state-disabled", !!tabCfg.disabled);

            $tab.on("click.qpxRibbon", function () {
                if (tabCfg.disabled || cfg.disabled) { return; }
                self._selectTab(tabCfg.key, true);
            });
            $tab.on("keydown.qpxRibbon", function (e) {
                if (tabCfg.disabled || cfg.disabled) { return; }
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    self._selectTab(tabCfg.key, true);
                }
            });

            this.$tabsList.append($tab);

            var $panel = $("<div class='qpx-ribbon-panel'></div>").hide();
            (tabCfg.groups || []).forEach(function (groupCfg) {
                $panel.append(self._buildGroup(tabCfg.key, groupCfg));
            });
            this.$panels.append($panel);

            this._tabRefs[tabCfg.key] = { $tab: $tab, $panel: $panel, config: tabCfg };
        },

        _buildGroup: function (tabKey, groupCfg) {
            var self = this;

            var $items = $("<div class='qpx-ribbon-group-items'></div>");
            var $stackBuffer = null;

            var flushStack = function () { $stackBuffer = null; };

            (groupCfg.items || []).forEach(function (itemCfg, itemIndex) {
                if (itemCfg.stack) {
                    if (!$stackBuffer) {
                        $stackBuffer = $("<div class='qpx-ribbon-item-stack'></div>");
                        $items.append($stackBuffer);
                    }
                    self._buildItem(tabKey, groupCfg.key, itemCfg, itemIndex, $stackBuffer);
                } else {
                    flushStack();
                    self._buildItem(tabKey, groupCfg.key, itemCfg, itemIndex, $items);
                }
            });

            var $title = $("<div class='qpx-ribbon-group-title'></div>").text(groupCfg.title || "");

            return $("<div class='qpx-ribbon-group'></div>")
                .attr("data-qpx-group", groupCfg.key || "")
                .append($items, $title);
        },

        _buildItem: function (tabKey, groupKey, itemCfg, itemIndex, $target) {
            var self = this;

            if (itemCfg.type === "separator") {
                $target.append($("<div class='qpx-ribbon-separator'></div>"));
                return;
            }

            var $cell = $("<div class='qpx-ribbon-item'></div>")
                .toggleClass("qpx-ribbon-item-large", itemCfg.size === "large");

            if (itemCfg.type === "template" && qpx.isFunction(itemCfg.template)) {
                itemCfg.template(itemCfg, $cell);
                $target.append($cell);
                return;
            }

            var widgetName = itemCfg.widget || "qpRibbonButton";
            if (!qpx.getWidgetClass(widgetName)) {
                console.warn("qpRibbon: neznámý widget '" + widgetName + "'.");
            }

            var options = $.extend({}, itemCfg.options);

            // "size" zadané na úrovni položky (item.size) se automaticky
            // promítne i do options.size dedikovaných ribbon-widgetů
            // (qpRibbonButton, qpRibbonDropDownButton), pokud ho tam
            // vývojář už explicitně nezadal - nemusí se tak psát na dvou místech.
            var SIZE_AWARE_WIDGETS = ["qpRibbonButton", "qpRibbonDropDownButton"];
            if (itemCfg.size && SIZE_AWARE_WIDGETS.indexOf(widgetName) !== -1 && options.size === undefined) {
                options.size = itemCfg.size;
            }

            options.view = widgetName;

            var widget = qpx.ui(options, $cell);
            $target.append($cell);

            var ref = { tabKey: tabKey, groupKey: groupKey, itemIndex: itemIndex, widget: widget, $cell: $cell };
            this._itemRefs.push(ref);

            // agregace klikacích/hodnotových událostí položek do ribbon.onItemClick
            // (stejný princip jako u qpToolBar)
            ["click", "itemClick"].forEach(function (evName) {
                if (widget.on) {
                    widget.on(evName, function (e) {
                        self.trigger("itemClick", $.extend({
                            tabKey: tabKey,
                            groupKey: groupKey,
                            itemIndex: itemIndex,
                            itemData: itemCfg,
                            itemElement: $cell[0],
                            component: self
                        }, e || {}));
                    });
                }
            });
        },

        // ---------------------------------------------------------------
        // Přepínání karet / sbalení
        // ---------------------------------------------------------------
        _bindEvents: function () {
            var self = this;

            this.$collapseBtn.on("click.qpxRibbon", function (e) {
                e.stopPropagation();
                self.toggleCollapse();
            });
            this.$collapseBtn.on("keydown.qpxRibbon", function (e) {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    self.toggleCollapse();
                }
            });
        },

        _selectTab: function (key, userExpand) {
            var cfg = this.config;
            if (cfg.activeTabKey === key && !(userExpand && cfg.collapsed)) { return; }
            this.option("activeTabKey", key);
            // kliknutí na kartu myší/klávesnicí pás karet i rozbalí (chování jako v Office)
            if (userExpand && cfg.collapsed) { this.option("collapsed", false); }
        },

        _applyActiveTab: function () {
            var cfg = this.config;
            $.each(this._tabRefs, function (key, ref) {
                var active = key === cfg.activeTabKey;
                ref.$tab.toggleClass("qpx-state-selected", active).attr("aria-selected", active);
                ref.$panel.toggle(active);
            });
        },

        _updateCollapseIcon: function () {
            this.$collapseBtn
                .toggle(!!this.config.collapsible)
                .html(this.config.collapsed ? "&#9660;" : "&#9650;")
                .attr("title", this.config.collapsed ? "Rozbalit pás karet" : "Sbalit pás karet");
        },

        // ---------------------------------------------------------------
        // Veřejné API
        // ---------------------------------------------------------------
        getActiveTabKey: function () { return this.config.activeTabKey; },
        setActiveTab: function (key) { return this.option("activeTabKey", key); },

        collapse: function () { return this.option("collapsed", true); },
        expand: function () { return this.option("collapsed", false); },
        toggleCollapse: function () { return this.option("collapsed", !this.config.collapsed); },
        isCollapsed: function () { return !!this.config.collapsed; },

        getItemWidget: function (tabKey, groupKey, itemIndex) {
            var found = this._itemRefs.filter(function (ref) {
                return ref.tabKey === tabKey && ref.groupKey === groupKey && ref.itemIndex === itemIndex;
            })[0];
            return found ? found.widget : undefined;
        },

        addTab: function (tabCfg, beforeKey) {
            var cfg = this.config;
            cfg.tabs = cfg.tabs || [];
            var idx = cfg.tabs.length;
            if (beforeKey !== undefined && beforeKey !== null) {
                var i = this._indexOfTab(beforeKey);
                if (i !== -1) { idx = i; }
            }
            cfg.tabs.splice(idx, 0, tabCfg);
            this._buildDom();
            return this;
        },

        removeTab: function (key) {
            var cfg = this.config;
            var i = this._indexOfTab(key);
            if (i === -1) { return this; }
            cfg.tabs.splice(i, 1);
            if (cfg.activeTabKey === key) { cfg.activeTabKey = cfg.tabs.length ? cfg.tabs[0].key : null; }
            this._buildDom();
            return this;
        },

        _indexOfTab: function (key) {
            var arr = this.config.tabs || [];
            for (var i = 0; i < arr.length; i++) { if (arr[i].key === key) { return i; } }
            return -1;
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
                case "tabs":
                    if (!this._indexOfTab(this.config.activeTabKey) && this.config.activeTabKey === null && value.length) {
                        this.config.activeTabKey = value[0].key;
                    }
                    this._buildDom();
                    break;

                case "activeTabKey": {
                    this._applyActiveTab();
                    this.trigger("tabChanged", { key: value, previousValue: prev, component: this });
                    break;
                }

                case "collapsed":
                    this.$container.toggleClass("qpx-ribbon-collapsed", !!value);
                    this._updateCollapseIcon();
                    break;

                case "collapsible":
                    this._updateCollapseIcon();
                    break;

                case "disabled":
                    this.$container.toggleClass("qpx-state-disabled", !!value);
                    break;

                case "visible":
                    this.$container.toggleClass("qpx-hidden", !value);
                    break;

                case "theme":
                    if (prev) { this.$container.removeClass("qpx-theme-" + prev); }
                    if (value) { this.$container.addClass("qpx-theme-" + value); }
                    break;
            }

            this.trigger("optionChanged", { name: name, value: value, previousValue: prev, component: this });
            return this;
        },

        _destroyItemWidgets: function () {
            (this._itemRefs || []).forEach(function (ref) {
                if (ref.widget && ref.widget.destroy) { ref.widget.destroy(); }
            });
            this._itemRefs = [];
        },

        destroy: function () {
            this.$container.off(".qpxRibbon");
            if (this.$tabsList) { this.$tabsList.find(".qpx-ribbon-tab").off(".qpxRibbon"); }
            if (this.$collapseBtn) { this.$collapseBtn.off(".qpxRibbon"); }
            this._destroyItemWidgets();
            this._super();
        }
    });

    qpx.registerWidget("qpRibbon", Ribbon);
    qpx.qpRibbon = Ribbon;

})(window.qpx, jQuery);
