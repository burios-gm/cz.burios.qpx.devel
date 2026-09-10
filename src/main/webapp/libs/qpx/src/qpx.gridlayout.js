/*!
 * qpx - qpGridLayout
 * Rozkládací kontejner postavený přímo nad CSS Gridem, inspirovaný Webix
 * GridLayout. Na rozdíl od qpFlexLayout (jednorozměrný řádek/sloupec)
 * qpGridLayout organizuje buňky do dvourozměrné mřížky s pevně danými
 * sloupci a řádky, a hlavně umožňuje buňky SLUČOVAT (colSpan/rowSpan) -
 * typická "tabulková" funkce, kterou flexbox neumí:
 *  - "items": pole buněk. Každá buňka může být:
 *      - vnořený qpx widget: { view: "...", ...jeho vlastní config }
 *      - libovolný volný HTML obsah: { content: "<div>...</div>" }
 *      - prázdný objekt {} = prázdné místo v mřížce (spacer)
 *    U každé buňky lze nastavit "col"/"row" (0-based výchozí pozice v
 *    mřížce - pokud se vynechá, buňka se umístí automaticky podle
 *    autoFlow) a "colSpan"/"rowSpan" (přes kolik sloupců/řádků se má
 *    buňka roztáhnout - sloučit), dále justifySelf/alignSelf, css,
 *    hidden.
 *  - na kontejneru: columns (šířky sloupců), rows (výšky řádků), gap
 *    (nebo zvlášť columnGap/rowGap), autoFlow, justifyItems, alignItems
 *  - vnořené qpx widgety se při překreslení (option("items", ...))
 *    korektně ničí (child.destroy()), aby nezůstávaly viset jejich
 *    event listenery/timery
 *
 * options:
 *   items, columns, rows, gap, columnGap, rowGap, autoFlow,
 *   justifyItems, alignItems, padding, width, height, debug,
 *   disabled, visible
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

    var ALIGN_MAP = {
        start: "start",
        end: "end",
        center: "center",
        stretch: "stretch",
        baseline: "baseline"
    };

    var GridLayout = qpx.Widget.extend({

        defaults: {
            items: [],            // [{ view, ... } | { content } | {} (spacer)]
                                    // + volitelně col/row/colSpan/rowSpan/justifySelf/alignSelf/css/hidden

            columns: null,          // pole šířek sloupců (číslo=px, nebo "1fr"/"minmax(100px,1fr)"/"auto"...)
                                     // nebo přímo řetězec grid-template-columns; null = responzivní
                                     // repeat(auto-fit, minmax(120px, 1fr))
            rows: null,              // stejná logika pro výšky řádků; null = automatická výška (auto)

            gap: 10,
            columnGap: undefined,     // přepíše gap jen pro sloupce (mezera mezi sloupci)
            rowGap: undefined,        // přepíše gap jen pro řádky (mezera mezi řádky)

            autoFlow: "row",          // "row" | "column" | "row dense" | "column dense" -
                                       // jak se umísťují buňky bez explicitního col/row

            justifyItems: "stretch",   // výchozí zarovnání obsahu buňky vodorovně
            alignItems: "stretch",     // výchozí zarovnání obsahu buňky svisle

            padding: null,
            width: null,
            height: null,

            debug: false,           // vykreslí tenký obrys kolem každé buňky (ladění mřížky)
            disabled: false,
            visible: true,

            onOptionChanged: null
        },

        // ---------------------------------------------------------------
        render: function () {
            var cfg = this.config;

            this.$container
                .addClass("qpx-gridlayout")
                .toggleClass("qpx-hidden", !cfg.visible)
                .toggleClass("qpx-state-disabled", !!cfg.disabled)
                .toggleClass("qpx-gridlayout-debug", !!cfg.debug);

            if (cfg.onOptionChanged) { this.off("optionChanged"); this.on("optionChanged", cfg.onOptionChanged); }

            this._applyContainerStyle();
            this._rebuildCells();
        },

        // ---------------------------------------------------------------
        _cssAlign: function (v) { return ALIGN_MAP[v] || v || "stretch"; },

        // pole čísel/řetězců -> řetězec pro grid-template-columns/rows;
        // číslo se bere jako px, řetězec ("1fr", "minmax(100px,1fr)", "auto"...)
        // se použije beze změny; celý config může být i rovnou hotový CSS řetězec
        _tracksToCss: function (tracks, fallback) {
            if (tracks == null) { return fallback; }
            if (qpx.isString(tracks)) { return tracks; }
            return tracks.map(function (t) {
                return typeof t === "number" ? qpx.toPx(t) : t;
            }).join(" ");
        },

        _applyContainerStyle: function () {
            var cfg = this.config;
            this.$container.css({
                "grid-template-columns": this._tracksToCss(cfg.columns, "repeat(auto-fit, minmax(120px, 1fr))"),
                "grid-template-rows": this._tracksToCss(cfg.rows, ""),
                "grid-auto-flow": cfg.autoFlow,
                "justify-items": this._cssAlign(cfg.justifyItems),
                "align-items": this._cssAlign(cfg.alignItems),
                "row-gap": qpx.toPx(cfg.rowGap !== undefined ? cfg.rowGap : cfg.gap),
                "column-gap": qpx.toPx(cfg.columnGap !== undefined ? cfg.columnGap : cfg.gap),
                "padding": cfg.padding != null ? qpx.toPx(cfg.padding) : "",
                "width": cfg.width != null ? qpx.toPx(cfg.width) : "",
                "height": cfg.height != null ? qpx.toPx(cfg.height) : ""
            });
        },

        // ---------------------------------------------------------------
        // DOM - zničí staré vnořené widgety a znovu sestaví buňky podle
        // aktuálního "items". Odděleno od _applyContainerStyle(), aby se
        // změna čistě kontejnerových voleb (gap, columns, rows, ...)
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

                var $cell = $("<div class='qpx-gridlayout-cell'></div>").attr("data-qpx-index", i);
                self._applyCellStyle($cell, itemCfg);

                if (itemCfg.css) { $cell.addClass(itemCfg.css); }
                if (itemCfg.hidden) { $cell.addClass("qpx-hidden"); }

                self.$container.append($cell);

                if (isSpacer) {
                    $cell.addClass("qpx-gridlayout-spacer");
                    return; // prázdná buňka = jen vyhrazené místo v mřížce
                }

                if (itemCfg.content !== undefined) {
                    $cell.html(itemCfg.content);
                } else if (itemCfg.view) {
                    var child = qpx.ui(itemCfg, $cell);
                    self.addChild(child);
                }
            });
        },

        _applyCellStyle: function ($cell, itemCfg) {
            var style = {};
            var colSpan = itemCfg.colSpan || 1;
            var rowSpan = itemCfg.rowSpan || 1;

            // CSS Grid čáry jsou 1-based -> "col: 0" znamená první sloupec (čára 1)
            if (itemCfg.col !== undefined) {
                style["grid-column"] = (itemCfg.col + 1) + " / span " + colSpan;
            } else if (colSpan > 1) {
                style["grid-column"] = "span " + colSpan;
            }

            if (itemCfg.row !== undefined) {
                style["grid-row"] = (itemCfg.row + 1) + " / span " + rowSpan;
            } else if (rowSpan > 1) {
                style["grid-row"] = "span " + rowSpan;
            }

            if (itemCfg.justifySelf) { style["justify-self"] = this._cssAlign(itemCfg.justifySelf); }
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

                case "columns":
                case "rows":
                case "gap":
                case "columnGap":
                case "rowGap":
                case "autoFlow":
                case "justifyItems":
                case "alignItems":
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
                    this.$container.toggleClass("qpx-gridlayout-debug", !!value);
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

    qpx.registerWidget("qpGridLayout", GridLayout);
    qpx.qpGridLayout = GridLayout;

})(window.qpx, jQuery);
