/*!
 * qpx - qpFlexLayout
 * Rozkládací kontejner postavený přímo nad CSS flexboxem, inspirovaný
 * Webix FlexLayout. Na rozdíl od základního "layout" (rows/cols,
 * webix-klasický styl, každá buňka se defaultně rovnoměrně roztahuje)
 * qpFlexLayout vystavuje skutečné flexbox vlastnosti přímo:
 *  - "items": pole buněk. Každá buňka může být:
 *      - vnořený qpx widget: { view: "...", ...jeho vlastní config }
 *      - libovolný volný HTML obsah: { content: "<div>...</div>" }
 *      - prázdný objekt {} = pružná mezera (spacer), viz "layout"
 *    U každé buňky lze navíc nastavit grow/shrink/basis (nebo zkratkou
 *    width/height pro pevnou velikost), alignSelf, css třídu a hidden.
 *  - na kontejneru: direction, wrap, gap, justify, align, padding,
 *    width, height
 *  - vnořené qpx widgety se při překreslení (option("items", ...))
 *    korektně ničí (child.destroy()), aby nezůstávaly viset jejich
 *    event listenery/timery
 *
 * options:
 *   items, direction ("row"|"row-reverse"|"column"|"column-reverse"),
 *   wrap (true|false|"wrap-reverse"), gap, justify, align, padding,
 *   width, height, debug, disabled, visible
 *
 * events:
 *   onOptionChanged
 *
 * methods:
 *   option(name[, value]), items([items]), getChild(index), getChildren(),
 *   enable(), disable()
 */
(function (qpx, $) {
    "use strict";

    var JUSTIFY_MAP = {
        start: "flex-start",
        end: "flex-end",
        center: "center",
        "space-between": "space-between",
        "space-around": "space-around",
        "space-evenly": "space-evenly"
    };

    var ALIGN_MAP = {
        start: "flex-start",
        end: "flex-end",
        center: "center",
        stretch: "stretch",
        baseline: "baseline"
    };

    var FlexLayout = qpx.Widget.extend({

        defaults: {
            items: [],            // [{ view, ... } | { content } | {} (spacer)]

            direction: "row",      // "row" | "row-reverse" | "column" | "column-reverse"
            wrap: false,            // false -> nowrap, true -> wrap, nebo přímo "wrap-reverse"
            gap: 10,
            justify: "start",       // start|end|center|space-between|space-around|space-evenly
            align: "stretch",       // start|end|center|stretch|baseline

            padding: null,          // volitelný vnitřní padding (px)
            width: null,
            height: null,

            debug: false,           // vykreslí tenký obrys kolem každé buňky (ladění layoutu)
            disabled: false,
            visible: true,

            onOptionChanged: null
        },

        // ---------------------------------------------------------------
        render: function () {
            var cfg = this.config;

            this.$container
                .addClass("qpx-flexlayout")
                .toggleClass("qpx-hidden", !cfg.visible)
                .toggleClass("qpx-state-disabled", !!cfg.disabled)
                .toggleClass("qpx-flexlayout-debug", !!cfg.debug);

            if (cfg.onOptionChanged) { this.off("optionChanged"); this.on("optionChanged", cfg.onOptionChanged); }

            this._applyContainerStyle();
            this._rebuildCells();
        },

        // ---------------------------------------------------------------
        _cssJustify: function (v) { return JUSTIFY_MAP[v] || v || "flex-start"; },
        _cssAlign: function (v) { return ALIGN_MAP[v] || v || "stretch"; },

        _applyContainerStyle: function () {
            var cfg = this.config;
            this.$container.css({
                "flex-direction": cfg.direction,
                "flex-wrap": cfg.wrap === true ? "wrap" : (cfg.wrap === false ? "nowrap" : cfg.wrap),
                "justify-content": this._cssJustify(cfg.justify),
                "align-items": this._cssAlign(cfg.align),
                "gap": qpx.toPx(cfg.gap),
                "padding": cfg.padding != null ? qpx.toPx(cfg.padding) : "",
                "width": cfg.width != null ? qpx.toPx(cfg.width) : "",
                "height": cfg.height != null ? qpx.toPx(cfg.height) : ""
            });
        },

        // ---------------------------------------------------------------
        // DOM - zničí staré vnořené widgety a znovu sestaví buňky podle
        // aktuálního "items". Odděleno od _applyContainerStyle(), aby se
        // změna čistě kontejnerových voleb (gap, justify, align, ...)
        // nemusela platit destrukcí a novým vykreslením vnořených widgetů.
        // ---------------------------------------------------------------
        _rebuildCells: function () {
            (this._children || []).forEach(function (child) {
                if (child && child.destroy) { child.destroy(); }
            });
            this._children = [];

            this.$container.empty();
            this._buildCells();
        },

        _buildCells: function () {
            var self = this;
            var cfg = this.config;

            (cfg.items || []).forEach(function (itemCfg, i) {
                if (itemCfg === undefined || itemCfg === null) { return; }

                var isSpacer = qpx.isObject(itemCfg) && !itemCfg.view && itemCfg.content === undefined;

                var $cell = $("<div class='qpx-flexlayout-cell'></div>").attr("data-qpx-index", i);
                self._applyCellStyle($cell, itemCfg, isSpacer);

                if (itemCfg.css) { $cell.addClass(itemCfg.css); }
                if (itemCfg.hidden) { $cell.addClass("qpx-hidden"); }

                self.$container.append($cell);

                if (isSpacer) {
                    $cell.addClass("qpx-flexlayout-spacer");
                    return; // prázdná buňka = jen pružná mezera, nic se nevykresluje
                }

                if (itemCfg.content !== undefined) {
                    $cell.html(itemCfg.content);
                } else if (itemCfg.view) {
                    var child = qpx.ui(itemCfg, $cell);
                    self.addChild(child);
                }
            });
        },

        _applyCellStyle: function ($cell, itemCfg, isSpacer) {
            var style = {};

            if (isSpacer) {
                var sGrow = itemCfg.grow !== undefined ? itemCfg.grow : 1;
                var sShrink = itemCfg.shrink !== undefined ? itemCfg.shrink : 1;
                style.flex = sGrow + " " + sShrink + " 0%";
            } else if (itemCfg.width !== undefined || itemCfg.height !== undefined) {
                // zkratka pro pevnou velikost buňky (nesmršťuje/neroztahuje se)
                style.flex = "0 0 auto";
                if (itemCfg.width !== undefined) { style.width = qpx.toPx(itemCfg.width); }
                if (itemCfg.height !== undefined) { style.height = qpx.toPx(itemCfg.height); }
            } else {
                var grow = itemCfg.grow !== undefined ? itemCfg.grow : 0;
                var shrink = itemCfg.shrink !== undefined ? itemCfg.shrink : 1;
                var basis = itemCfg.basis !== undefined
                    ? (typeof itemCfg.basis === "number" ? qpx.toPx(itemCfg.basis) : itemCfg.basis)
                    : "auto";
                style.flex = grow + " " + shrink + " " + basis;
            }

            if (itemCfg.alignSelf) { style["align-self"] = this._cssAlign(itemCfg.alignSelf); }

            $cell.css(style);
        },

        // ---------------------------------------------------------------
        // Veřejné API
        // ---------------------------------------------------------------
        items: function (newItems) {
            if (arguments.length === 0) { return this.config.items; }
            return this.option("items", newItems);
        },

        getChild: function (index) {
            var children = this.getChildren();
            return children[index] !== undefined ? children[index] : null;
        },

        enable: function () { return this.option("disabled", false); },
        disable: function () { return this.option("disabled", true); },

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
                case "items":
                    this._rebuildCells();
                    break;

                case "direction":
                case "wrap":
                case "justify":
                case "align":
                case "gap":
                case "padding":
                case "width":
                case "height":
                    // čistě kontejnerová vlastnost - stačí přepočítat inline styl,
                    // vnořené widgety zůstávají netknuté (nezničí se ani znovu
                    // nevykreslí)
                    this._applyContainerStyle();
                    break;

                case "visible":
                    this.$container.toggleClass("qpx-hidden", !value);
                    break;

                case "disabled":
                    this.$container.toggleClass("qpx-state-disabled", !!value);
                    break;

                case "debug":
                    this.$container.toggleClass("qpx-flexlayout-debug", !!value);
                    break;

                default:
                    this._rebuildCells();
                    break;
            }

            this.trigger("optionChanged", { name: name, value: value, previousValue: prev, component: this });
            return this;
        }

        // destroy() se dědí z qpx.Widget - ten už sám projde this._children
        // (naplněné přes addChild() v _buildCells()) a zavolá jejich
        // destroy(), teprve pak vyprázdní $container
    });

    qpx.registerWidget("qpFlexLayout", FlexLayout);
    qpx.qpFlexLayout = FlexLayout;

})(window.qpx, jQuery);
