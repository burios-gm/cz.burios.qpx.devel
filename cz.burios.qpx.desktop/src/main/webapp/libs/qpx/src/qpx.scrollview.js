/*!
 * qpx - qpScrollView
 * Kontejner pro scrollovatelný obsah, inspirovaný Webix ScrollView:
 *  - "items": pole karet vykreslených vedle sebe (x) nebo pod sebou (y)
 *  - "content": libovolný (i volně větší) HTML obsah, po kterém lze
 *    posouvat/tahat myší (panning) - typicky velký obrázek, mapa, plátno
 *  - podpora tažení myší (mouseScroll), volitelné přichytávání na
 *    položky (snap, přes nativní CSS scroll-snap), šipky prev/next
 *    (showNav) a klávesová navigace šipkami
 *
 * options:
 *   items, content, direction ("x"|"y"|"xy"), itemWidth, itemHeight, gap,
 *   snap, mouseScroll, showScrollbar, showNav, disabled, visible
 *
 * events:
 *   onScroll (za jízdy), onScrollEnd (po doscrollování), onOptionChanged
 *
 * methods:
 *   option(name[, value]), items([items]), content([html]),
 *   scrollTo(x, y[, animate]), scrollBy(dx, dy[, animate]),
 *   scrollToItem(index[, animate]), next(), prev(), getScrollState(),
 *   enable(), disable(), focus()
 */
(function (qpx, $) {
    "use strict";

    var ScrollView = qpx.Widget.extend({

        defaults: {
            items: null,            // pole { html } / string - vykreslí se jako karty vedle sebe/pod sebou
            content: null,           // volný HTML obsah (použije se, pokud nejsou items)
            direction: "x",          // "x" | "y" | "xy" - které osy jsou scrollovatelné
            itemWidth: null,         // šířka jedné karty (px), pokud null -> auto
            itemHeight: null,
            gap: 10,
            snap: false,             // přichytávání na položky (CSS scroll-snap)
            mouseScroll: true,       // tažení myší (grab-to-pan)
            showScrollbar: true,     // zobrazit (stylovaný) scrollbar
            showNav: false,          // šipky prev/next (má smysl hlavně s items)
            disabled: false,
            visible: true,

            onScroll: null,
            onScrollEnd: null,
            onOptionChanged: null
        },

        // ---------------------------------------------------------------
        render: function () {
            var cfg = this.config;

            this.$container
                .addClass("qpx-scrollview")
                .addClass("qpx-scrollview-dir-" + cfg.direction)
                .toggleClass("qpx-hidden", !cfg.visible)
                .toggleClass("qpx-state-disabled", !!cfg.disabled)
                .toggleClass("qpx-scrollview-hide-scrollbar", !cfg.showScrollbar)
                .attr("role", "region");

            if (cfg.onScroll) { this.off("scroll"); this.on("scroll", cfg.onScroll); }
            if (cfg.onScrollEnd) { this.off("scrollEnd"); this.on("scrollEnd", cfg.onScrollEnd); }
            if (cfg.onOptionChanged) { this.off("optionChanged"); this.on("optionChanged", cfg.onOptionChanged); }

            this._buildDom();
            this._renderBody();
            this._bindScroll();
            this._bindDrag();
            this._bindKeys();
        },

        // ---------------------------------------------------------------
        // DOM
        // ---------------------------------------------------------------
        _buildDom: function () {
            var self = this;
            var cfg = this.config;

            this.$container.empty();

            this.$viewport = $("<div class='qpx-scrollview-viewport'></div>")
                .attr("tabindex", cfg.disabled ? "-1" : "0");
            this.$body = $("<div class='qpx-scrollview-body'></div>");
            this.$viewport.append(this.$body);
            this.$container.append(this.$viewport);

            if (cfg.showNav) {
                this.$prevBtn = $("<button type='button' class='qpx-scrollview-nav qpx-scrollview-nav-prev' aria-label='Předchozí'></button>")
                    .append($("<i></i>").addClass("fa " + (cfg.direction === "y" ? "fa-chevron-up" : "fa-chevron-left")));
                this.$nextBtn = $("<button type='button' class='qpx-scrollview-nav qpx-scrollview-nav-next' aria-label='Další'></button>")
                    .append($("<i></i>").addClass("fa " + (cfg.direction === "y" ? "fa-chevron-down" : "fa-chevron-right")));

                this.$prevBtn.on("click.qpxScrollView", function () { self.prev(); });
                this.$nextBtn.on("click.qpxScrollView", function () { self.next(); });

                this.$container.append(this.$prevBtn, this.$nextBtn);
            } else {
                this.$prevBtn = null;
                this.$nextBtn = null;
            }
        },

        _renderBody: function () {
            var self = this;
            var cfg = this.config;

            this.$body.empty();

            if (cfg.items && cfg.items.length) {
                this.$body.addClass("qpx-scrollview-items").css("gap", qpx.toPx(cfg.gap));
                cfg.items.forEach(function (item, i) {
                    var html = qpx.isString(item) ? item : ((item && item.html) || "");
                    var $it = $("<div class='qpx-scrollview-item'></div>")
                        .attr("data-qpx-index", i)
                        .html(html);
                    if (cfg.itemWidth) { $it.css("width", qpx.toPx(cfg.itemWidth)); }
                    if (cfg.itemHeight) { $it.css("height", qpx.toPx(cfg.itemHeight)); }
                    self.$body.append($it);
                });
            } else {
                this.$body.removeClass("qpx-scrollview-items").css("gap", "").html(cfg.content || "");
            }

            this.$viewport
                .toggleClass("qpx-scrollview-scroll-x", cfg.direction === "x" || cfg.direction === "xy")
                .toggleClass("qpx-scrollview-scroll-y", cfg.direction === "y" || cfg.direction === "xy")
                .toggleClass("qpx-scrollview-snap", !!cfg.snap);

            this._updateNavState();
        },

        // ---------------------------------------------------------------
        // Scroll události
        // ---------------------------------------------------------------
        _bindScroll: function () {
            var self = this;
            var timer = null;

            this.$viewport.off(".qpxScrollView");
            this.$viewport.on("scroll.qpxScrollView", function () {
                self.trigger("scroll", self.getScrollState());
                self._updateNavState();
                clearTimeout(timer);
                timer = setTimeout(function () {
                    self.trigger("scrollEnd", self.getScrollState());
                }, 120);
            });
        },

        // ---------------------------------------------------------------
        // Tažení myší (grab-to-pan)
        // ---------------------------------------------------------------
        _bindDrag: function () {
            var self = this;
            var ns = ".qpxScrollViewDrag" + this.id;

            $(document).off(ns);
            this.$viewport.off(".qpxScrollViewDragLocal");

            if (!this.config.mouseScroll) { return; }

            var dragging = false, startX = 0, startY = 0, startLeft = 0, startTop = 0, moved = false;

            this.$viewport.on("mousedown.qpxScrollViewDragLocal", function (e) {
                if (self.config.disabled) { return; }
                if ($(e.target).is("input, textarea, select, [contenteditable]")) { return; }

                dragging = true;
                moved = false;
                startX = e.pageX;
                startY = e.pageY;
                startLeft = self.$viewport.scrollLeft();
                startTop = self.$viewport.scrollTop();
                self.$viewport.addClass("qpx-scrollview-dragging");
                e.preventDefault();
            });

            $(document).on("mousemove" + ns, function (e) {
                if (!dragging) { return; }
                var cfg = self.config;
                var dx = e.pageX - startX;
                var dy = e.pageY - startY;
                if (Math.abs(dx) > 3 || Math.abs(dy) > 3) { moved = true; }
                if (cfg.direction === "x" || cfg.direction === "xy") { self.$viewport.scrollLeft(startLeft - dx); }
                if (cfg.direction === "y" || cfg.direction === "xy") { self.$viewport.scrollTop(startTop - dy); }
            });

            $(document).on("mouseup" + ns, function () {
                if (!dragging) { return; }
                dragging = false;
                self.$viewport.removeClass("qpx-scrollview-dragging");
            });

            // po tažení nepropouštět "click" na odkazy/tlačítka uvnitř obsahu
            this.$viewport.on("click.qpxScrollViewDragLocal", "a, button", function (e) {
                if (moved) { e.stopPropagation(); e.preventDefault(); }
            });
        },

        // ---------------------------------------------------------------
        // Klávesová navigace (šipky)
        // ---------------------------------------------------------------
        _bindKeys: function () {
            var self = this;
            var step = 60;

            this.$viewport.off("keydown.qpxScrollView");
            this.$viewport.on("keydown.qpxScrollView", function (e) {
                if (self.config.disabled) { return; }
                var cfg = self.config;

                if (e.key === "ArrowRight" && cfg.direction !== "y") { self.scrollBy(step, 0); e.preventDefault(); }
                else if (e.key === "ArrowLeft" && cfg.direction !== "y") { self.scrollBy(-step, 0); e.preventDefault(); }
                else if (e.key === "ArrowDown" && cfg.direction !== "x") { self.scrollBy(0, step); e.preventDefault(); }
                else if (e.key === "ArrowUp" && cfg.direction !== "x") { self.scrollBy(0, -step); e.preventDefault(); }
            });
        },

        _updateNavState: function () {
            if (!this.config.showNav || !this.$prevBtn) { return; }
            var state = this.getScrollState();
            this.$prevBtn.toggleClass("qpx-state-disabled", state.x <= 0 && state.y <= 0);
            this.$nextBtn.toggleClass("qpx-state-disabled", state.x >= state.maxX - 1 && state.y >= state.maxY - 1);
        },

        // ---------------------------------------------------------------
        // Veřejné API
        // ---------------------------------------------------------------
        items: function (newItems) {
            if (arguments.length === 0) { return this.config.items; }
            return this.option("items", newItems);
        },

        content: function (newContent) {
            if (arguments.length === 0) { return this.config.content; }
            return this.option("content", newContent);
        },

        scrollTo: function (x, y, animate) {
            var $vp = this.$viewport;
            if (animate === undefined) { animate = true; }

            if (animate) {
                $vp.stop(true).animate({
                    scrollLeft: x != null ? x : $vp.scrollLeft(),
                    scrollTop: y != null ? y : $vp.scrollTop()
                }, 220);
            } else {
                if (x != null) { $vp.scrollLeft(x); }
                if (y != null) { $vp.scrollTop(y); }
            }
            return this;
        },

        scrollBy: function (dx, dy, animate) {
            var $vp = this.$viewport;
            return this.scrollTo((dx || 0) + $vp.scrollLeft(), (dy || 0) + $vp.scrollTop(), animate);
        },

        scrollToItem: function (index, animate) {
            var $item = this.$body.children().eq(index);
            if (!$item.length) { return this; }

            if (this.config.direction === "y") {
                return this.scrollTo(null, $item.position().top + this.$viewport.scrollTop(), animate);
            }
            return this.scrollTo($item.position().left + this.$viewport.scrollLeft(), null, animate);
        },

        next: function () { return this._stepItem(1); },
        prev: function () { return this._stepItem(-1); },

        _stepItem: function (dir) {
            var cfg = this.config;
            var items = this.$body.children();
            if (!items.length) { return this; }

            var vpRect = this.$viewport[0].getBoundingClientRect();
            var center = (cfg.direction === "y") ? (vpRect.top + vpRect.height / 2) : (vpRect.left + vpRect.width / 2);
            var currentIndex = 0;

            items.each(function (i) {
                var r = this.getBoundingClientRect();
                var c = (cfg.direction === "y") ? (r.top + r.height / 2) : (r.left + r.width / 2);
                if (c <= center) { currentIndex = i; }
            });

            var nextIndex = Math.max(0, Math.min(items.length - 1, currentIndex + dir));
            return this.scrollToItem(nextIndex);
        },

        getScrollState: function () {
            var $vp = this.$viewport;
            var node = $vp[0];
            return {
                x: $vp.scrollLeft(),
                y: $vp.scrollTop(),
                maxX: node.scrollWidth - node.clientWidth,
                maxY: node.scrollHeight - node.clientHeight
            };
        },

        enable: function () { return this.option("disabled", false); },
        disable: function () { return this.option("disabled", true); },
        focus: function () { this.$viewport.trigger("focus"); return this; },

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
                case "visible":
                    this.$container.toggleClass("qpx-hidden", !value);
                    break;

                case "disabled":
                    this.$container.toggleClass("qpx-state-disabled", !!value);
                    this.$viewport.attr("tabindex", value ? "-1" : "0");
                    break;

                case "showScrollbar":
                    this.$container.toggleClass("qpx-scrollview-hide-scrollbar", !value);
                    break;

                // items/content/direction/itemWidth/itemHeight/gap/snap/
                // mouseScroll/showNav mění strukturu DOM - nejjednodušší a
                // nejspolehlivější je kompletní překreslení (refresh)
                default:
                    this.refresh();
                    break;
            }

            this.trigger("optionChanged", { name: name, value: value, previousValue: prev, component: this });
            return this;
        },

        destroy: function () {
            $(document).off(".qpxScrollViewDrag" + this.id);
            if (this.$viewport) { this.$viewport.off(".qpxScrollView .qpxScrollViewDragLocal"); }
            if (this.$prevBtn) { this.$prevBtn.off(".qpxScrollView"); }
            if (this.$nextBtn) { this.$nextBtn.off(".qpxScrollView"); }
            this._super();
        }
    });

    qpx.registerWidget("qpScrollView", ScrollView);
    qpx.qpScrollView = ScrollView;

})(window.qpx, jQuery);
