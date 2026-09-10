/*!
 * qpx - qpToolBar (refactored)
 * Panel nástrojů koncipovaný stejně jako DevExtreme dxToolBar:
 *  - items rozdělené do "before" / "center" / "after"
 *  - každá položka je samostatný widget: button | buttonGroup | dropDownButton | template
 *  - responzivní chování: položky, které se nevejdou do šířky panelu,
 *    se automaticky přesunou do přetečeného menu (ikona "⋮" vpravo),
 *    podobně jako u panelu nástrojů v Google Chrome DevTools.
 *
 * Konfigurace položky (item):
 *   {
 *     location: "before" | "center" | "after",   // výchozí "before"
 *     widget:   "button" | "buttonGroup" | "dropDownButton" | "template",
 *     locateInMenu: "auto" | "always" | "never",  // výchozí "auto"
 *     visible: true,
 *     cssClass: "",
 *     options: { ...konfigurace vnitřního widgetu, vč. onClick/onItemClick apod. }
 *   }
 *
 * Události toolbaru: onItemClick (agregovaně za všechny typy položek),
 * onOptionChanged, layoutChanged.
 */
(function (qpx, $) {
    "use strict";

    var Toolbar = qpx.Widget.extend({

        defaults: {
            items: [],
            visible: true,
            disabled: false,
            // null (výchozí) = žádná vlastní theme třída na containeru -
            // qpToolBar pak normálně DĚDÍ --qpx-* proměnné z nejbližšího
            // předka se třídou qpx-theme-light/qpx-theme-dark (typicky
            // <body>), stejně jako qpTextBox/qpDataGrid/qpTabView/qpRibbon.
            // "light" / "dark" zadejte jen pokud chcete vynutit konkrétní
            // téma NA TÉTO KONKRÉTNÍ instanci bez ohledu na okolí.
            theme: null,     // null | "light" | "dark"
            overflowMenuIcon: "⋮",
            onItemClick: null,
            onOptionChanged: null
        },

        render: function () {
            var cfg = this.config;
            var self = this;

            this.$container
                .addClass("qpx-toolbar")
                .toggleClass("qpx-hidden", !cfg.visible)
                .toggleClass("qpx-state-disabled", !!cfg.disabled)
                .attr("role", "toolbar");

            // vlastní theme třída se přidává JEN pokud je explicitně
            // zadaná - jinak se nechá zdědit z předka (viz komentář u defaults.theme)
            if (cfg.theme) { this.$container.addClass("qpx-theme-" + cfg.theme); }

            if (cfg.onItemClick) { this.on("itemClick", cfg.onItemClick); }
            if (cfg.onOptionChanged) { this.on("optionChanged", cfg.onOptionChanged); }

            this.$content = $("<div class='qpx-toolbar-content'></div>");
            this.$before = $("<div class='qpx-toolbar-section qpx-toolbar-before'></div>");
            this.$center = $("<div class='qpx-toolbar-section qpx-toolbar-center'></div>");
            this.$after = $("<div class='qpx-toolbar-section qpx-toolbar-after'></div>");
            this.$content.append(this.$before, this.$center, this.$after);

            this.$overflowBtn = $("<div class='qpx-toolbar-overflow-btn' tabindex='0' role='button' title='Další položky'></div>")
                .text(cfg.overflowMenuIcon)
                .hide();

            this.$container.append(this.$content, this.$overflowBtn);

            this.$menu = $("<div class='qpx-toolbar-menu qpx-popup-list' role='menu'></div>")
                .appendTo(document.body)
                .hide();

            this._itemRefs = [];
            this._menuRefs = [];
            this._isMenuOpen = false;
            this._layoutRaf = null;
            this._resizeObserver = null;
            this._onWinResize = null;

            this._buildItems();
            this._bindOverflowMenu();
            this._bindResize();

            // první rozložení až po zavěšení do DOM (kvůli měření šířky)
            var self2 = this;
            setTimeout(function () { self2._doRelayout(); }, 0);
        },

        // -------------------------------------------------------------
        // Vytvoření položek
        // -------------------------------------------------------------
        _buildItems: function () {
            var self = this;
            this._itemRefs = [];
            (this.config.items || []).forEach(function (itemCfg, index) {
                self._itemRefs.push(self._createItemRef(itemCfg, index));
            });
            this._applyPositions();
        },

        _createItemRef: function (itemCfg, index) {
            var self = this;

            itemCfg = itemCfg || {};
            itemCfg.location = itemCfg.location || "before";
            itemCfg.locateInMenu = itemCfg.locateInMenu || "auto";

			var widgetName = itemCfg.widget || (itemCfg.template !== undefined ? "template" : "qpButton");
			if (!qpx.getWidgetClass(widgetName)) {
			    console.warn("qpToolBar: neznámý widget '" + widgetName + "'.");
			}
			var options = $.extend({}, itemCfg.options);
            if (itemCfg.template !== undefined && options.template === undefined) { options.template = itemCfg.template; }
            if (itemCfg.data !== undefined && options.data === undefined) { options.data = itemCfg.data; }
            options.view = widgetName;

            var $cell = $("<div class='qpx-toolbar-item'></div>");
            if (itemCfg.cssClass) { $cell.addClass(itemCfg.cssClass); }
            if (itemCfg.visible === false) { $cell.hide(); }

            var widget = qpx.ui(options, $cell);

            var ref = {
                config: itemCfg,
                order: index,
                location: itemCfg.location,
                $cell: $cell,
                widget: widget,
                inMenu: false
            };

            // agregace klikacích událostí jednotlivých typů widgetů do toolbar.onItemClick
            ["click", "itemClick"].forEach(function (evName) {
                if (widget.on) {
                    widget.on(evName, function (e) {
                        self.trigger("itemClick", $.extend({
                            itemData: itemCfg,
                            itemIndex: index,
                            itemElement: $cell[0],
                            component: self
                        }, e || {}));
                    });
                }
            });

            return ref;
        },

        // -------------------------------------------------------------
        // Responzivní rozložení: přesun přetékajících položek do menu
        // -------------------------------------------------------------
        _bindResize: function () {
            var self = this;

            this._onWinResize = function () { self._scheduleRelayout(); };

            if (window.ResizeObserver) {
                this._resizeObserver = new ResizeObserver(function () { self._scheduleRelayout(); });
                this._resizeObserver.observe(this.getNode());
            } else {
                $(window).on("resize.qpxToolbar" + this.id, this._onWinResize);
            }
        },

        _scheduleRelayout: function () {
            var self = this;
            if (this._layoutRaf) { return; }
            var raf = window.requestAnimationFrame || window.setTimeout;
            this._layoutRaf = raf(function () {
                self._layoutRaf = null;
                self._doRelayout();
            });
        },

        _doRelayout: function () {
            var self = this;
            if (!this.$content || !this.$content.length) { return; }

            // reset menu refs podle locateInMenu === "always"
            this._menuRefs = [];
            this._itemRefs.forEach(function (ref) {
                ref.inMenu = (ref.config.locateInMenu === "always" && ref.config.visible !== false);
                if (ref.inMenu) { self._menuRefs.push(ref); }
            });

            this._applyPositions();

            // kandidáti na přesun do menu (auto)
            var candidates = this._itemRefs.filter(function (r) {
                return r.config.visible !== false &&
                    r.config.locateInMenu !== "never" &&
                    r.config.locateInMenu !== "always";
            }).slice().reverse(); // od konce (napravo), jako v Chrome DevTools

            var guard = 0;
            while (candidates.length && this._isOverflowing() && guard < 500) {
                guard += 1;
                var ref = candidates.shift();
                ref.inMenu = true;
                this._menuRefs.push(ref);
                this._applyPositions();
            }

            this.trigger("layoutChanged", { overflowing: this._menuRefs.length > 0 });
        },

        _isOverflowing: function () {
            var el = this.$content[0];
            // malá tolerance kvůli zaokrouhlování
            return el.scrollWidth - 1 > el.clientWidth;
        },

        _applyPositions: function () {
            var self = this;

            // Nepoužívat empty(), protože maže DOM widgetů a ruší události.
            // detach() zachová DOM i události.
            this.$before.children().detach();
            this.$center.children().detach();
            this.$after.children().detach();
            this.$menu.children().detach();

            this._itemRefs.forEach(function (ref) {
                if (ref.config.visible === false) { return; }

                if (ref.inMenu) {
                    ref.$cell.addClass("qpx-in-menu").show();
                    self.$menu.append(ref.$cell);
                    return;
                }

                ref.$cell.removeClass("qpx-in-menu").show();
                var target = ref.location === "center" ? self.$center
                    : (ref.location === "after" ? self.$after : self.$before);
                target.append(ref.$cell);
            });

            this.$overflowBtn.toggle(this._menuRefs.length > 0);
        },

        // -------------------------------------------------------------
        // Popup s přetečenými položkami
        // -------------------------------------------------------------
        _bindOverflowMenu: function () {
            var self = this;

            this.$overflowBtn.on("click.qpxToolbar", function (e) {
                e.stopPropagation();
                self._isMenuOpen ? self._closeMenu() : self._openMenu();
            });

            this.$overflowBtn.on("keydown.qpxToolbar", function (e) {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    self._isMenuOpen ? self._closeMenu() : self._openMenu();
                }
            });

            $(document).on("mousedown.qpxToolbar" + this.id, function (e) {
                if (!self._isMenuOpen) { return; }
                if ($(e.target).closest(self.$menu).length || $(e.target).closest(self.$overflowBtn).length) { return; }
                self._closeMenu();
            });
        },

        _openMenu: function () {
            if (!this._menuRefs.length) { return; }

            var off = this.$overflowBtn.offset();
            this.$menu.css({
                top: off.top + this.$overflowBtn.outerHeight(),
                left: Math.max(0, off.left + this.$overflowBtn.outerWidth() - this.$menu.outerWidth())
            }).show();

            this._isMenuOpen = true;
        },

        _closeMenu: function () {
            this.$menu.hide();
            this._isMenuOpen = false;
        },

        // -------------------------------------------------------------
        // Veřejné API
        // -------------------------------------------------------------
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

            if (name === "items") {
                // zničit staré widgety
                this._itemRefs.forEach(function (ref) {
                    if (ref.widget && ref.widget.destroy) { ref.widget.destroy(); }
                    if (ref.$cell) { ref.$cell.remove(); }
                });
                this._itemRefs = [];
                this._menuRefs = [];
                this._buildItems();
                this._doRelayout();
            } else if (name === "disabled") {
                this.$container.toggleClass("qpx-state-disabled", !!value);
            } else if (name === "visible") {
                this.$container.toggleClass("qpx-hidden", !value);
            } else if (name === "theme") {
                // prev/value mohou být null (= "žádná vlastní třída, dědí se
                // z předka") - removeClass/addClass s prázdným argumentem
                // je no-op, takže se to dá zapsat bez podmínek
                if (prev) { this.$container.removeClass("qpx-theme-" + prev); }
                if (value) { this.$container.addClass("qpx-theme-" + value); }
            }

            this.trigger("optionChanged", { name: name, value: value, previousValue: prev });
            return this;
        },

        // vrátí instanci vnitřního widgetu podle indexu položky v poli items
        getItemWidget: function (index) {
            var ref = this._itemRefs[index];
            return ref ? ref.widget : undefined;
        },

        repaint: function () {
            this._doRelayout();
            return this;
        },

        destroy: function () {
            // odpojení resize observer / handlerů
            if (this._resizeObserver) {
                this._resizeObserver.disconnect();
                this._resizeObserver = null;
            }
            $(window).off(".qpxToolbar" + this.id);
            $(document).off(".qpxToolbar" + this.id);

            if (this._layoutRaf && window.cancelAnimationFrame) {
                window.cancelAnimationFrame(this._layoutRaf);
            }
            this._layoutRaf = null;

            // zničit vnitřní widgety
            this._itemRefs.forEach(function (ref) {
                if (ref.widget && ref.widget.destroy) { ref.widget.destroy(); }
                if (ref.$cell) { ref.$cell.remove(); }
            });
            this._itemRefs = [];
            this._menuRefs = [];

            if (this.$menu) { this.$menu.remove(); }

            this._super();
        }
    });

    qpx.registerWidget("qpToolBar", Toolbar);
    qpx.qpToolBar = Toolbar;

})(window.qpx, jQuery);
