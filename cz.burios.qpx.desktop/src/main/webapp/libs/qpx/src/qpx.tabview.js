/*!
 * qpx - qpTabView
 * Panel se záložkami koncipovaný podobně jako DevExtreme dxTabPanel:
 *  - "items" = pole záložek, každá má title/icon a obsah panelu
 *  - obsah panelu lze zadat jako template (string/funkce), html/text,
 *    nebo jako vnořenou qpx konfiguraci (view / rows / cols) - stejně
 *    jako u qpToolBar, takže lze skládat plné qpx widgety.
 *  - vizuálně i chováním se blíží dxTabPanel: posuvný indikátor pod
 *    aktivní záložkou, tlačítka pro scroll při přetečení, klávesová
 *    navigace (šipky/Home/End) podle WAI-ARIA "tabs" patternu,
 *    volitelný swipe na dotykových zařízeních, deferRendering apod.
 *
 * Options (nejbližší ekvivalent k dxTabPanel):
 *   items, dataSource, selectedIndex, selectedItem,
 *   tabsPosition: "top"|"bottom"|"left"|"right",
 *   stylingMode:  "primary" (podtržený indikátor) | "secondary" (vyplněné "pilulky"),
 *   iconPosition: "start"|"end"|"top"|"bottom",
 *   animationEnabled, swipeEnabled, deferRendering, repaintChangesOnly,
 *   showNavButtons, scrollingEnabled, loop, rtlEnabled,
 *   disabled, visible, focusStateEnabled, hoverStateEnabled,
 *   itemHoldTimeout, itemTemplate, itemTitleTemplate,
 *   width, height (řeší už qpx.Widget)
 *
 * Events:
 *   onInitialized, onContentReady, onSelectionChanged,
 *   onItemClick, onTitleClick, onItemHold, onItemContextMenu,
 *   onItemRendered, onOptionChanged, onDisposing
 *
 * Methods:
 *   option(name[, value]), selectItem(indexOrItem),
 *   getSelectedIndex(), getSelectedItem(),
 *   getItemElement(index), getTabElement(index),
 *   repaint(), destroy()
 */
(function (qpx, $) {
    "use strict";

    var TabView = qpx.Widget.extend({

        defaults: {
            items: [],
            dataSource: null,
            selectedIndex: 0,
            selectedItem: null,

            tabsPosition: "top",     // top | bottom | left | right
            stylingMode: "primary",  // primary | secondary
            iconPosition: "start",   // start | end | top | bottom

            animationEnabled: true,
            swipeEnabled: true,
            deferRendering: true,
            repaintChangesOnly: false,

            showNavButtons: false,
            scrollingEnabled: true,
            loop: false,
            rtlEnabled: false,

            disabled: false,
            visible: true,
            focusStateEnabled: true,
            hoverStateEnabled: true,

            itemHoldTimeout: 750,
            itemTemplate: null,
            itemTitleTemplate: null,

            onInitialized: null,
            onContentReady: null,
            onSelectionChanged: null,
            onItemClick: null,
            onTitleClick: null,
            onItemHold: null,
            onItemContextMenu: null,
            onItemRendered: null,
            onOptionChanged: null,
            onDisposing: null
        },

        // ---------------------------------------------------------------
        // Vykreslení
        // ---------------------------------------------------------------
        render: function () {
            var cfg = this.config;
            var self = this;

            if ((!cfg.items || !cfg.items.length) && cfg.dataSource) {
                cfg.items = cfg.dataSource;
            }
            cfg.items = cfg.items || [];

            this.$container
                .addClass("qpx-tabview")
                .addClass("qpx-tabview-pos-" + cfg.tabsPosition)
                .addClass("qpx-tabview-styling-" + cfg.stylingMode)
                .addClass("qpx-icon-position-" + cfg.iconPosition)
                .toggleClass("qpx-rtl", !!cfg.rtlEnabled)
                .toggleClass("qpx-hidden", !cfg.visible)
                .toggleClass("qpx-state-disabled", !!cfg.disabled)
                .toggleClass("qpx-focusable", !!cfg.focusStateEnabled)
                .toggleClass("qpx-hoverable", !!cfg.hoverStateEnabled)
                .attr("dir", cfg.rtlEnabled ? "rtl" : "ltr");

            if (cfg.onInitialized) { this.on("ready", cfg.onInitialized); }
            if (cfg.onContentReady) { this.on("contentReady", cfg.onContentReady); }
            if (cfg.onSelectionChanged) { this.on("selectionChanged", cfg.onSelectionChanged); }
            if (cfg.onItemClick) { this.on("itemClick", cfg.onItemClick); }
            if (cfg.onTitleClick) { this.on("titleClick", cfg.onTitleClick); }
            if (cfg.onItemHold) { this.on("itemHold", cfg.onItemHold); }
            if (cfg.onItemContextMenu) { this.on("itemContextMenu", cfg.onItemContextMenu); }
            if (cfg.onItemRendered) { this.on("itemRendered", cfg.onItemRendered); }
            if (cfg.onOptionChanged) { this.on("optionChanged", cfg.onOptionChanged); }
            if (cfg.onDisposing) { this.on("destroy", cfg.onDisposing); }

            // --- DOM kostra -------------------------------------------------
            this.$tabsWrapper = $("<div class='qpx-tabview-tabswrapper'></div>");
            this.$navPrev = $("<div class='qpx-tabview-nav qpx-tabview-nav-prev' tabindex='-1' role='button' aria-label='Předchozí záložky'>&#8249;</div>").hide();
            this.$navNext = $("<div class='qpx-tabview-nav qpx-tabview-nav-next' tabindex='-1' role='button' aria-label='Další záložky'>&#8250;</div>").hide();
            this.$tabsScroll = $("<div class='qpx-tabview-tabsscroll'></div>");
            this.$tabsList = $("<div class='qpx-tabview-tabslist' role='tablist'></div>");
            this.$indicator = $("<div class='qpx-tabview-indicator qpx-no-anim'></div>");

            this.$tabsList.append(this.$indicator);
            this.$tabsScroll.append(this.$tabsList);
            this.$tabsWrapper.append(this.$navPrev, this.$tabsScroll, this.$navNext);

            this.$content = $("<div class='qpx-tabview-content' role='presentation'></div>");

            if (cfg.tabsPosition === "bottom") {
                this.$container.append(this.$content, this.$tabsWrapper);
            } else {
                this.$container.append(this.$tabsWrapper, this.$content);
            }

            this._itemRefs = [];
            this._selectedIndex = -1;
            this._layoutRaf = null;
            this._resizeObserver = null;

            this._buildItems();
            this._bindNav();
            this._bindKeyboard();
            if (cfg.swipeEnabled) { this._bindSwipe(); }
            this._bindResize();

            var initialIndex = this._resolveInitialIndex();
            this._selectIndex(initialIndex, { initial: true, silent: false });

            setTimeout(function () {
                self._updateNavVisibility();
                self._moveIndicator(false);
                self.trigger("contentReady", { component: self });
            }, 0);
        },

        _resolveInitialIndex: function () {
            var cfg = this.config;
            if (cfg.selectedItem != null) {
                var idx = this._indexOfItem(cfg.selectedItem);
                if (idx > -1) { return idx; }
            }
            return cfg.selectedIndex || 0;
        },

        // ---------------------------------------------------------------
        // Sestavení položek (záložka + panel)
        // ---------------------------------------------------------------
        _buildItems: function () {
            var self = this;
            this._itemRefs = [];
            (this.config.items || []).forEach(function (itemCfg, index) {
                self._itemRefs.push(self._createItemRef(itemCfg || {}, index));
            });

            if (!this.config.deferRendering) {
                this._itemRefs.forEach(function (ref) { self._renderPanelContent(ref); });
            }
        },

        _rebuildItems: function () {
            this._itemRefs.forEach(function (ref) {
                if (ref.widget && ref.widget.destroy) { ref.widget.destroy(); }
                ref.$tab.remove();
                ref.$panel.remove();
            });
            this._itemRefs = [];
            this._selectedIndex = -1;

            this.$tabsList.empty().append(this.$indicator);
            this.$content.empty();

            this._buildItems();
            var idx = this._resolveInitialIndex();
            this._selectIndex(idx, { initial: true });
            this._updateNavVisibility();
        },

        _createItemRef: function (itemCfg, index) {
            var self = this;
            var cfg = this.config;

            var $tab = $("<div class='qpx-tabview-tab' role='tab' tabindex='-1'></div>")
                .attr("aria-selected", "false")
                .attr("id", this.id + "-tab-" + index)
                .attr("aria-controls", this.id + "-panel-" + index);

            if (itemCfg.disabled) { $tab.addClass("qpx-state-disabled").attr("aria-disabled", "true"); }
            if (itemCfg.visible === false) { $tab.addClass("qpx-hidden"); }
            if (itemCfg.cssClass) { $tab.addClass(itemCfg.cssClass); }

            var $icon = null;
            if (itemCfg.icon) {
                $icon = $("<span class='qpx-icon'></span>").addClass("qpx-icon-" + itemCfg.icon);
            }

            var $title = $("<span class='qpx-tabview-tab-title'></span>");
            if (qpx.isFunction(cfg.itemTitleTemplate)) {
                var tContent = cfg.itemTitleTemplate.call(this, itemCfg, index, $title[0]);
                if (tContent !== undefined) { $title.append(tContent); }
            } else {
                $title.text(itemCfg.title != null ? itemCfg.title : (itemCfg.text || ""));
            }

            if ($icon) {
                if (cfg.iconPosition === "end" || cfg.iconPosition === "bottom") {
                    $tab.append($title, $icon);
                } else {
                    $tab.append($icon, $title);
                }
            } else {
                $tab.append($title);
            }

            var $badge = null;
            if (itemCfg.badge !== undefined && itemCfg.badge !== null && itemCfg.badge !== "") {
                $badge = $("<span class='qpx-tabview-tab-badge'></span>").text(itemCfg.badge);
                $tab.append($badge);
            }

            var $panel = $("<div class='qpx-tabview-panel' role='tabpanel'></div>")
                .attr("id", this.id + "-panel-" + index)
                .attr("aria-labelledby", this.id + "-tab-" + index)
                .hide();

            this.$tabsList.append($tab);
            this.$content.append($panel);

            var ref = {
                config: itemCfg,
                index: index,
                $tab: $tab,
                $panel: $panel,
                widget: null,
                rendered: false
            };

            // klik na záložku
            $tab.on("click.qpxTabView", function (e) {
                if (itemCfg.disabled || cfg.disabled) { return; }
                self.trigger("titleClick", { itemData: itemCfg, itemIndex: index, itemElement: $tab[0], component: self, event: e });
                self.trigger("itemClick", { itemData: itemCfg, itemIndex: index, itemElement: $tab[0], component: self, event: e });
                self.option("selectedIndex", index);
            });

            // podržení položky (itemHold), stejně jako u dx widgetů
            var holdTimer = null;
            $tab.on("mousedown.qpxTabView touchstart.qpxTabView", function (e) {
                if (itemCfg.disabled || cfg.disabled) { return; }
                window.clearTimeout(holdTimer);
                holdTimer = window.setTimeout(function () {
                    self.trigger("itemHold", { itemData: itemCfg, itemIndex: index, itemElement: $tab[0], component: self, event: e });
                }, cfg.itemHoldTimeout);
            });
            $tab.on("mouseup.qpxTabView mouseleave.qpxTabView touchend.qpxTabView touchmove.qpxTabView", function () {
                window.clearTimeout(holdTimer);
            });

            $tab.on("contextmenu.qpxTabView", function (e) {
                if (itemCfg.disabled || cfg.disabled) { return; }
                self.trigger("itemContextMenu", { itemData: itemCfg, itemIndex: index, itemElement: $tab[0], component: self, event: e });
            });

            return ref;
        },

        // vykreslení obsahu panelu (líné, dle deferRendering) —
        // podporuje template (string/funkce), html/text, nebo vnořenou qpx konfiguraci
        _renderPanelContent: function (ref) {
            if (ref.rendered) { return; }
            var itemCfg = ref.config;
            var cfg = this.config;
            var content = itemCfg.template !== undefined ? itemCfg.template : cfg.itemTemplate;

            if (qpx.isFunction(content)) {
                var result = content.call(this, itemCfg, ref.index, ref.$panel[0]);
                if (result !== undefined && result !== null) { ref.$panel.append(result); }
            } else if (qpx.isString(content)) {
                ref.$panel.html(content);
            } else if (itemCfg.view || itemCfg.rows || itemCfg.cols) {
                ref.widget = qpx.ui(itemCfg, ref.$panel);
                this.addChild(ref.widget);
            } else if (itemCfg.html !== undefined) {
                ref.$panel.html(itemCfg.html);
            } else if (itemCfg.text !== undefined && itemCfg.title !== undefined) {
                // "text" použit jako obsah, "title" jako popisek záložky
                ref.$panel.text(itemCfg.text);
            }

            ref.rendered = true;
            this.trigger("itemRendered", { itemData: itemCfg, itemIndex: ref.index, itemElement: ref.$panel[0], component: this });
        },

        // ---------------------------------------------------------------
        // Výběr záložky
        // ---------------------------------------------------------------
        _indexOfItem: function (item) {
            var refs = this._itemRefs;
            for (var i = 0; i < refs.length; i++) {
                if (refs[i].config === item) { return i; }
            }
            return -1;
        },

        _findSelectableIndex: function (fromIndex, direction) {
            var refs = this._itemRefs;
            if (!refs.length) { return -1; }
            var loop = this.config.loop;
            var i = fromIndex;
            var guard = 0;

            while (guard <= refs.length) {
                if (i < 0) { i = loop ? refs.length - 1 : 0; }
                if (i > refs.length - 1) { i = loop ? 0 : refs.length - 1; }

                var ref = refs[i];
                if (ref && !ref.config.disabled && ref.config.visible !== false) { return i; }
                if (i === fromIndex && guard > 0) { break; }

                i += direction;
                guard += 1;
            }
            return -1;
        },

        _selectIndex: function (index, opts) {
            opts = opts || {};
            var refs = this._itemRefs;
            if (!refs.length) { return; }

            index = Math.max(0, Math.min(index, refs.length - 1));
            if (refs[index] && refs[index].config.disabled) {
                var alt = this._findSelectableIndex(index, 1);
                if (alt === -1) { return; }
                index = alt;
            }
            if (index === this._selectedIndex && !opts.initial) { return; }

            var prevIndex = this._selectedIndex;
            var prevRef = refs[prevIndex];
            var ref = refs[index];

            if (prevRef) {
                prevRef.$tab.removeClass("qpx-state-selected").attr({ "aria-selected": "false", tabindex: "-1" });
                prevRef.$panel.hide();
            }

            this._selectedIndex = index;
            this.config.selectedIndex = index;
            this.config.selectedItem = ref.config;

            this._renderPanelContent(ref);

            ref.$tab.addClass("qpx-state-selected").attr({ "aria-selected": "true", tabindex: "0" });
            ref.$panel.show();

            this._scrollTabIntoView(ref);
            this._moveIndicator(this.config.animationEnabled && !opts.initial);

            if (!opts.silent) {
                this.trigger("selectionChanged", {
                    component: this,
                    addedItems: [ref.config],
                    removedItems: prevRef ? [prevRef.config] : []
                });
            }
        },

        _moveIndicator: function (animate) {
            var ref = this._itemRefs[this._selectedIndex];
            if (!ref || !this.$indicator) { return; }

            this.$indicator.toggleClass("qpx-no-anim", !animate);

            var vertical = (this.config.tabsPosition === "left" || this.config.tabsPosition === "right");
            if (vertical) {
                this.$indicator.css({ top: ref.$tab.position().top, height: ref.$tab.outerHeight(), left: "", width: "" });
            } else {
                this.$indicator.css({ left: ref.$tab.position().left, width: ref.$tab.outerWidth(), top: "", height: "" });
            }
        },

        // ---------------------------------------------------------------
        // Scrollování / nav tlačítka (při přetečení pásu záložek)
        // ---------------------------------------------------------------
        _bindNav: function () {
            var self = this;
            var step = function () { return Math.max(80, self.$tabsScroll.width() * 0.75); };

            this.$navPrev.on("click.qpxTabView", function () {
                self.$tabsScroll.stop
                    ? self.$tabsScroll.animate({ scrollLeft: "-=" + step() }, 150)
                    : (self.$tabsScroll[0].scrollLeft -= step());
            });
            this.$navNext.on("click.qpxTabView", function () {
                self.$tabsScroll.stop
                    ? self.$tabsScroll.animate({ scrollLeft: "+=" + step() }, 150)
                    : (self.$tabsScroll[0].scrollLeft += step());
            });
            this.$tabsScroll.on("scroll.qpxTabView", function () { self._updateNavVisibility(); });
        },

        _updateNavVisibility: function () {
            var cfg = this.config;
            var el = this.$tabsScroll[0];
            if (!el) { return; }

            var vertical = (cfg.tabsPosition === "left" || cfg.tabsPosition === "right");
            var overflowing = cfg.scrollingEnabled && (vertical
                ? el.scrollHeight - 1 > el.clientHeight
                : el.scrollWidth - 1 > el.clientWidth);

            var showButtons = !!cfg.showNavButtons && overflowing;
            this.$navPrev.toggle(showButtons);
            this.$navNext.toggle(showButtons);
            this.$tabsWrapper.toggleClass("qpx-tabview-overflowing", !!overflowing);
        },

        _scrollTabIntoView: function (ref) {
            var el = this.$tabsScroll[0];
            if (!el || !this.config.scrollingEnabled) { return; }
            var vertical = (this.config.tabsPosition === "left" || this.config.tabsPosition === "right");
            var tabEl = ref.$tab[0];

            if (vertical) {
                if (tabEl.offsetTop < el.scrollTop) { el.scrollTop = tabEl.offsetTop; }
                else if (tabEl.offsetTop + tabEl.offsetHeight > el.scrollTop + el.clientHeight) {
                    el.scrollTop = tabEl.offsetTop + tabEl.offsetHeight - el.clientHeight;
                }
            } else {
                if (tabEl.offsetLeft < el.scrollLeft) { el.scrollLeft = tabEl.offsetLeft; }
                else if (tabEl.offsetLeft + tabEl.offsetWidth > el.scrollLeft + el.clientWidth) {
                    el.scrollLeft = tabEl.offsetLeft + tabEl.offsetWidth - el.clientWidth;
                }
            }
        },

        _bindResize: function () {
            var self = this;
            var handler = function () { self._scheduleRelayout(); };

            if (window.ResizeObserver) {
                this._resizeObserver = new ResizeObserver(handler);
                this._resizeObserver.observe(this.getNode());
            } else {
                $(window).on("resize.qpxTabView" + this.id, handler);
            }
        },

        _scheduleRelayout: function () {
            var self = this;
            if (this._layoutRaf) { return; }
            var raf = window.requestAnimationFrame || window.setTimeout;
            this._layoutRaf = raf(function () {
                self._layoutRaf = null;
                self._updateNavVisibility();
                self._moveIndicator(false);
            });
        },

        // ---------------------------------------------------------------
        // Klávesová navigace (WAI-ARIA "tabs" pattern)
        // ---------------------------------------------------------------
        _bindKeyboard: function () {
            var self = this;
            var cfg = this.config;

            this.$tabsList.on("keydown.qpxTabView", ".qpx-tabview-tab", function (e) {
                if (cfg.disabled) { return; }
                var horizontal = !(cfg.tabsPosition === "left" || cfg.tabsPosition === "right");
                var rtl = !!cfg.rtlEnabled;
                var nextKey = horizontal ? (rtl ? "ArrowLeft" : "ArrowRight") : "ArrowDown";
                var prevKey = horizontal ? (rtl ? "ArrowRight" : "ArrowLeft") : "ArrowUp";
                var handled = true;

                if (e.key === nextKey) {
                    var n = self._findSelectableIndex(self._selectedIndex + 1, 1);
                    if (n > -1) { self.option("selectedIndex", n); self._itemRefs[n].$tab.trigger("focus"); }
                } else if (e.key === prevKey) {
                    var p = self._findSelectableIndex(self._selectedIndex - 1, -1);
                    if (p > -1) { self.option("selectedIndex", p); self._itemRefs[p].$tab.trigger("focus"); }
                } else if (e.key === "Home") {
                    var f = self._findSelectableIndex(0, 1);
                    if (f > -1) { self.option("selectedIndex", f); self._itemRefs[f].$tab.trigger("focus"); }
                } else if (e.key === "End") {
                    var l = self._findSelectableIndex(self._itemRefs.length - 1, -1);
                    if (l > -1) { self.option("selectedIndex", l); self._itemRefs[l].$tab.trigger("focus"); }
                } else if (e.key === "Enter" || e.key === " ") {
                    var focusedIndex = self._itemRefs.map(function (r) { return r.$tab[0]; }).indexOf(this);
                    if (focusedIndex > -1) { self.option("selectedIndex", focusedIndex); }
                } else {
                    handled = false;
                }

                if (handled) { e.preventDefault(); }
            });
        },

        // ---------------------------------------------------------------
        // Swipe (dotyková zařízení)
        // ---------------------------------------------------------------
        _bindSwipe: function () {
            var self = this;
            var startX = null, startY = null, tracking = false;

            this.$content.on("touchstart.qpxTabView", function (e) {
                if (self.config.disabled) { return; }
                var t = e.originalEvent.touches[0];
                startX = t.clientX;
                startY = t.clientY;
                tracking = true;
            });

            this.$content.on("touchmove.qpxTabView", function (e) {
                if (!tracking) { return; }
                var t = e.originalEvent.touches[0];
                if (Math.abs(t.clientX - startX) > Math.abs(t.clientY - startY)) {
                    e.preventDefault(); // horizontální swipe = nescrollovat stránku svisle
                }
            });

            this.$content.on("touchend.qpxTabView", function (e) {
                if (!tracking) { return; }
                tracking = false;
                var t = e.originalEvent.changedTouches[0];
                var dx = t.clientX - startX;
                var dy = t.clientY - startY;
                var threshold = 50;

                if (Math.abs(dx) > threshold && Math.abs(dx) > Math.abs(dy)) {
                    var rtl = !!self.config.rtlEnabled;
                    var dir = (dx < 0) !== rtl ? 1 : -1; // doleva = další, doprava = předchozí (v LTR)
                    var target = self._findSelectableIndex(self._selectedIndex + dir, dir);
                    if (target > -1) { self.option("selectedIndex", target); }
                }
            });
        },

        // ---------------------------------------------------------------
        // Veřejné API
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
            var cfg = this.config;

            switch (name) {
                case "items":
                case "dataSource":
                    cfg.items = value || [];
                    this._rebuildItems();
                    break;

                case "selectedIndex":
                    this._selectIndex(value);
                    break;

                case "selectedItem":
                    var idx = this._indexOfItem(value);
                    if (idx > -1) { this._selectIndex(idx); }
                    break;

                case "disabled":
                    cfg.disabled = !!value;
                    this.$container.toggleClass("qpx-state-disabled", cfg.disabled);
                    break;

                case "visible":
                    cfg.visible = !!value;
                    this.$container.toggleClass("qpx-hidden", !cfg.visible);
                    break;

                case "tabsPosition":
                    this.$container.removeClass("qpx-tabview-pos-" + prev).addClass("qpx-tabview-pos-" + value);
                    cfg.tabsPosition = value;
                    if (value === "bottom") { this.$container.append(this.$tabsWrapper); }
                    else { this.$container.prepend(this.$tabsWrapper); }
                    this._moveIndicator(false);
                    this._updateNavVisibility();
                    break;

                case "stylingMode":
                    this.$container.removeClass("qpx-tabview-styling-" + prev).addClass("qpx-tabview-styling-" + value);
                    cfg.stylingMode = value;
                    break;

                case "iconPosition":
                    this.$container.removeClass("qpx-icon-position-" + prev).addClass("qpx-icon-position-" + value);
                    cfg.iconPosition = value;
                    break;

                case "rtlEnabled":
                    cfg.rtlEnabled = !!value;
                    this.$container.toggleClass("qpx-rtl", cfg.rtlEnabled).attr("dir", cfg.rtlEnabled ? "rtl" : "ltr");
                    this._moveIndicator(false);
                    break;

                case "showNavButtons":
                case "scrollingEnabled":
                    cfg[name] = value;
                    this._updateNavVisibility();
                    break;

                default:
                    cfg[name] = value;
            }

            this.trigger("optionChanged", { name: name, value: value, previousValue: prev, component: this });
            return this;
        },

        selectItem: function (indexOrItem) {
            if (typeof indexOrItem === "number") { this.option("selectedIndex", indexOrItem); }
            else { this.option("selectedItem", indexOrItem); }
            return this;
        },

        getSelectedIndex: function () { return this._selectedIndex; },
        getSelectedItem: function () {
            var ref = this._itemRefs[this._selectedIndex];
            return ref ? ref.config : null;
        },
        getItemElement: function (index) {
            var ref = this._itemRefs[index];
            return ref ? ref.$panel[0] : undefined;
        },
        getTabElement: function (index) {
            var ref = this._itemRefs[index];
            return ref ? ref.$tab[0] : undefined;
        },

        repaint: function () {
            this._updateNavVisibility();
            this._moveIndicator(false);
            return this;
        },

        destroy: function () {
            if (this._resizeObserver) { this._resizeObserver.disconnect(); this._resizeObserver = null; }
            $(window).off(".qpxTabView" + this.id);
            if (this._layoutRaf && window.cancelAnimationFrame) { window.cancelAnimationFrame(this._layoutRaf); }
            this._layoutRaf = null;

            this._itemRefs.forEach(function (ref) {
                if (ref.widget && ref.widget.destroy) { ref.widget.destroy(); }
                ref.$tab.off(".qpxTabView");
            });
            this._itemRefs = [];

            this._super();
        }
    });

    qpx.registerWidget("qpTabView", TabView);
    qpx.qpTabView = TabView;

})(window.qpx, jQuery);
