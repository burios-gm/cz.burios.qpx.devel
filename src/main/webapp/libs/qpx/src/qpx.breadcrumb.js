/*!
 * qpx - qpBreadcrumb
 * Navigační "drobečková" stezka (breadcrumb), inspirovaná KendoUI Breadcrumb
 * a Fluent2 Breadcrumb:
 *
 *  - items: pole { id, text, icon, url, disabled }
 *  - value: id aktuální (aktivní/poslední) položky - typicky se mění
 *    programově při navigaci v aplikaci (option("value", id) / value(id))
 *  - poslední (resp. aktivní) položka je vykreslena jako nezvýrazněný
 *    text bez odkazu (aria-current="page"), ostatní jsou klikatelné
 *  - automatické "přetečení": pokud se celá stezka nevejde do šířky
 *    kontejneru, prostřední položky se sbalí do jednoho "..." tlačítka
 *    s popup nabídkou (obdoba chování KendoUI / Fluent2 Breadcrumb)
 *
 * options:
 *   items, value, separatorIcon, rootIcon, overflow, edgeVisibleItems,
 *   disabled, visible
 *
 * events:
 *   onItemClick, onValueChanged, onOptionChanged
 *
 * methods:
 *   option(name[, value]), value([id]), items([items]),
 *   enable(), disable(), focus()
 */
(function (qpx, $) {
    "use strict";

    var Breadcrumb = qpx.Widget.extend({

        defaults: {
            items: [],              // [{ id, text, icon, url, disabled }]
            value: null,             // id aktivní položky; null = poslední položka v poli
            separatorIcon: "fa-angle-right",
            rootIcon: null,          // ikona pro první položku bez textu (Fluent2 "domeček")
            overflow: true,          // sbalování prostředních položek do "..." při nedostatku místa
            edgeVisibleItems: 1,     // kolik posledních položek zůstává vždy viditelných
            disabled: false,
            visible: true,

            onItemClick: null,
            onValueChanged: null,
            onOptionChanged: null
        },

        init: function (config, container) {
            this._onResize = null;
            this._popupOpen = false;
            this._super(config, container);
        },

        // ---------------------------------------------------------------
        render: function () {
            var cfg = this.config;

            this.$container
                .addClass("qpx-breadcrumb")
                .toggleClass("qpx-hidden", !cfg.visible)
                .toggleClass("qpx-state-disabled", !!cfg.disabled)
                .attr("role", "navigation")
                .attr("aria-label", "breadcrumb");

            if (cfg.onItemClick) { this.on("itemClick", cfg.onItemClick); }
            if (cfg.onValueChanged) { this.on("valueChanged", cfg.onValueChanged); }
            if (cfg.onOptionChanged) { this.on("optionChanged", cfg.onOptionChanged); }

            this._normalizeItems();
            this._renderList();
            this._bindResize();
        },

        // ---------------------------------------------------------------
        // Normalizace / vykreslení položek
        // ---------------------------------------------------------------
        _normalizeItems: function () {
            var items = this.config.items || [];
            items.forEach(function (item, i) {
                if (item.id === undefined || item.id === null) { item.id = i; }
            });
            if (this.config.value === null || this.config.value === undefined) {
                var last = items[items.length - 1];
                this.config.value = last ? last.id : null;
            }
        },

        _renderList: function () {
            this.$container.empty();
            this.$list = $("<ol class='qpx-breadcrumb-list'></ol>");
            this.$container.append(this.$list);

            this._renderFullList();
            this._updateOverflow();
        },

        _renderFullList: function () {
            var self = this;
            var items = this.config.items || [];

            this.$list.empty();
            items.forEach(function (item, i) {
                self.$list.append(self._buildItemNode(item, i === items.length - 1));
                if (i < items.length - 1) { self.$list.append(self._buildSeparator()); }
            });
        },

        _buildSeparator: function () {
            return $("<li class='qpx-breadcrumb-separator' aria-hidden='true'></li>")
                .append($("<i></i>").addClass("fa " + this.config.separatorIcon));
        },

        _buildItemNode: function (item, isLast) {
            var self = this;
            var cfg = this.config;
            var isCurrent = item.id === cfg.value;
            var isDisabled = !!item.disabled || !!cfg.disabled;
            var isInteractive = !isCurrent && !isDisabled;
            var isRootIconOnly = !item.text && (item.icon || cfg.rootIcon) && !isCurrent;

            var $li = $("<li></li>")
                .addClass("qpx-breadcrumb-item")
                .toggleClass("qpx-breadcrumb-item-current", isCurrent)
                .toggleClass("qpx-breadcrumb-item-disabled", isDisabled)
                .toggleClass("qpx-breadcrumb-item-icon-only", !!isRootIconOnly)
                .attr("data-qpx-item-id", item.id);

            var tag = (isInteractive && item.url) ? "a" : "span";
            var $inner = $("<" + tag + "></" + tag + ">").addClass("qpx-breadcrumb-link");

            if (isInteractive) {
                if (item.url) {
                    $inner.attr("href", item.url);
                } else {
                    $inner.attr("role", "link");
                }
                $inner.attr("tabindex", "0");
            } else {
                $inner.attr("tabindex", "-1");
                if (isDisabled) { $inner.attr("aria-disabled", "true"); }
            }
            if (isCurrent) { $inner.attr("aria-current", "page"); }
            if (isLast && !isCurrent) { $li.attr("data-qpx-last", "true"); }

            var icon = item.icon || (isRootIconOnly ? cfg.rootIcon : null);
            if (icon) {
                $inner.append($("<i></i>").addClass("fa " + icon + " qpx-breadcrumb-icon"));
            }
            if (item.text) {
                $inner.append($("<span class='qpx-breadcrumb-text'></span>").text(item.text));
                $inner.attr("title", item.text);
            }

            $li.append($inner);

            if (isInteractive) {
                $inner.on("click.qpxBreadcrumb", function (e) {
                    if (!item.url) { e.preventDefault(); }
                    self._selectItem(item);
                });
                $inner.on("keydown.qpxBreadcrumb", function (e) {
                    if (e.key === "Enter" || e.key === " ") {
                        if (!item.url) { e.preventDefault(); }
                        self._selectItem(item);
                    }
                });
            }

            return $li;
        },

        _selectItem: function (item) {
            this.trigger("itemClick", { item: item, component: this, element: this.getNode() });
            if (item.id !== this.config.value) {
                this.option("value", item.id);
            }
        },

        // ---------------------------------------------------------------
        // Přetečení - sbalení prostředních položek do "..." s popup nabídkou,
        // pokud se celá stezka nevejde do šířky kontejneru (obdoba chování
        // KendoUI Breadcrumb / Fluent2 Breadcrumb).
        // ---------------------------------------------------------------
        _updateOverflow: function () {
            var self = this;
            if (!this.config.overflow) { return; }

            // měření šířky má smysl až po vložení do DOM
            setTimeout(function () {
                var node = self.getNode();
                if (!self.$list || !node || !node.isConnected) { return; }
                self._collapseToFit();
            }, 0);
        },

        _collapseToFit: function () {
            var cfg = this.config;
            var items = cfg.items || [];
            if (items.length <= cfg.edgeVisibleItems + 2) { return; } // nemá smysl sbalovat

            this._renderFullList();
            var containerWidth = this.$container.width();
            if (!containerWidth || this.$list[0].scrollWidth <= containerWidth) { return; } // vejde se celé

            var hiddenStart = 1; // první položka zůstává vždy viditelná
            var hiddenEnd = items.length - cfg.edgeVisibleItems; // poslední(ch) N zůstává vždy
            if (hiddenEnd <= hiddenStart) { return; }

            this._renderCollapsedList(hiddenStart, hiddenEnd);

            var guard = 0;
            while (this.$list[0].scrollWidth > containerWidth &&
                   hiddenEnd > hiddenStart + 1 && guard < items.length) {
                hiddenEnd -= 1;
                this._renderCollapsedList(hiddenStart, hiddenEnd);
                guard += 1;
            }
        },

        _renderCollapsedList: function (hiddenStart, hiddenEnd) {
            var self = this;
            var items = this.config.items || [];
            var hiddenItems = items.slice(hiddenStart, hiddenEnd);

            this.$list.empty();

            items.forEach(function (item, i) {
                if (i === hiddenStart) {
                    self.$list.append(self._buildEllipsis(hiddenItems));
                    self.$list.append(self._buildSeparator());
                }
                if (i >= hiddenStart && i < hiddenEnd) { return; }

                self.$list.append(self._buildItemNode(item, i === items.length - 1));
                if (i < items.length - 1 && i !== hiddenStart - 1) {
                    self.$list.append(self._buildSeparator());
                }
            });
        },

        _buildEllipsis: function (hiddenItems) {
            var self = this;
            var $li = $("<li class='qpx-breadcrumb-item qpx-breadcrumb-ellipsis'></li>");
            var $btn = $("<button type='button' class='qpx-breadcrumb-ellipsis-btn' aria-haspopup='true' aria-expanded='false'>&hellip;</button>");

            $btn.on("click.qpxBreadcrumb", function (e) {
                e.stopPropagation();
                self._toggleEllipsisPopup($li, $btn, hiddenItems);
            });

            $li.append($btn);
            return $li;
        },

        _toggleEllipsisPopup: function ($li, $btn, hiddenItems) {
            var self = this;

            if (this._popupOpen) {
                this._closeEllipsisPopup();
                return;
            }

            var $popup = $("<ul class='qpx-breadcrumb-popup'></ul>");
            hiddenItems.forEach(function (item) {
                var isDisabled = !!item.disabled || !!self.config.disabled;
                var $pItem = $("<li class='qpx-breadcrumb-popup-item'></li>")
                    .toggleClass("qpx-breadcrumb-item-disabled", isDisabled);

                var $link = $("<a href='javascript:void(0);'></a>");
                if (item.icon) {
                    $link.append($("<i></i>").addClass("fa " + item.icon + " qpx-breadcrumb-icon"));
                }
                $link.append($("<span></span>").text(item.text || ""));
                $pItem.append($link);

                if (!isDisabled) {
                    $link.on("click.qpxBreadcrumb", function (e) {
                        e.preventDefault();
                        self._closeEllipsisPopup();
                        self._selectItem(item);
                    });
                }
                $popup.append($pItem);
            });

            $li.append($popup);
            $btn.attr("aria-expanded", "true");
            this._popupOpen = true;

            setTimeout(function () {
                $(document).on("click.qpxBreadcrumbPopup" + self.id, function () {
                    self._closeEllipsisPopup();
                });
            }, 0);
        },

        _closeEllipsisPopup: function () {
            if (this.$list) {
                this.$list.find(".qpx-breadcrumb-popup").remove();
                this.$list.find(".qpx-breadcrumb-ellipsis-btn").attr("aria-expanded", "false");
            }
            $(document).off("click.qpxBreadcrumbPopup" + this.id);
            this._popupOpen = false;
        },

        // ---------------------------------------------------------------
        _bindResize: function () {
            var self = this;
            this._unbindResize();
            this._onResize = function () { self._collapseToFit(); };
            $(window).on("resize.qpxBreadcrumb" + this.id, this._onResize);
        },

        _unbindResize: function () {
            if (this._onResize) {
                $(window).off("resize.qpxBreadcrumb" + this.id);
                this._onResize = null;
            }
        },

        // ---------------------------------------------------------------
        // Veřejné API
        // ---------------------------------------------------------------
        value: function (val) {
            if (arguments.length === 0) { return this.config.value; }
            return this.option("value", val);
        },

        items: function (newItems) {
            if (arguments.length === 0) { return this.config.items; }
            return this.option("items", newItems);
        },

        enable: function () { return this.option("disabled", false); },
        disable: function () { return this.option("disabled", true); },

        focus: function () {
            this.$list.find(".qpx-breadcrumb-link[tabindex='0']").first().trigger("focus");
            return this;
        },

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
                    this._renderList();
                    this.trigger("valueChanged", {
                        value: value,
                        previousValue: prev,
                        component: this,
                        element: this.getNode()
                    });
                    break;

                case "items":
                    this._normalizeItems();
                    this._renderList();
                    break;

                case "visible":
                    this.$container.toggleClass("qpx-hidden", !value);
                    break;

                case "disabled":
                    this.$container.toggleClass("qpx-state-disabled", !!value);
                    this._renderList();
                    break;

                case "separatorIcon":
                case "rootIcon":
                case "overflow":
                case "edgeVisibleItems":
                    this._renderList();
                    break;
            }

            this.trigger("optionChanged", { name: name, value: value, previousValue: prev, component: this });
            return this;
        },

        destroy: function () {
            this._closeEllipsisPopup();
            this._unbindResize();
            this.$container.off(".qpxBreadcrumb");
            this._super();
        }
    });

    qpx.registerWidget("qpBreadcrumb", Breadcrumb);
    qpx.qpBreadcrumb = Breadcrumb;

})(window.qpx, jQuery);
