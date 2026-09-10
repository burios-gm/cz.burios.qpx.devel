/*!
 * qpx - core
 * Vlastní JS UI framework nad jQuery.
 * Modul obsahuje: jmenný prostor qpx, Java-like Class systém s dědičností,
 * pomocné utility a jednoduchý events mixin (pub/sub).
 */
(function (root, $) {
    "use strict";

    if (!$) {
        throw new Error("qpx vyžaduje jQuery načtené před sebou.");
    }

    var qpx = root.qpx = root.qpx || {};
    qpx.version = "0.1.0";
    qpx.$ = $;

    // =================================================================
    // Class systém — inspirováno "Simple JavaScript Inheritance" (J. Resig),
    // rozšířeno o dědičnost statických členů a mixiny, aby se chovalo
    // podobně jako třídy v Javě (extends, super volání, statické metody).
    //
    //   var Animal = qpx.Class.extend({
    //       init: function(name){ this.name = name; },
    //       speak: function(){ return this.name + " vydává zvuk"; }
    //   });
    //
    //   var Dog = Animal.extend({
    //       speak: function(){ return this._super() + " (štěká)"; }
    //   });
    //
    //   new Dog("Rex").speak();
    // =================================================================
    var initializing = false;
    var fnTest = /xyz/.test(function () { /* eslint-disable */ if (0) { xyz; } /* eslint-enable */ })
        ? /\b_super\b/
        : /.*/;

    function Class() {}

    Class.extend = function (protoProps, staticProps) {
        var _super = this.prototype;

        initializing = true;
        var prototype = new this();
        initializing = false;

        for (var name in protoProps) {
            prototype[name] = (typeof protoProps[name] === "function" &&
                typeof _super[name] === "function" &&
                fnTest.test(protoProps[name]))
                ? (function (name, fn) {
                    return function () {
                        var tmp = this._super;
                        this._super = _super[name];
                        var ret;
                        try {
                            ret = fn.apply(this, arguments);
                        } finally {
                            this._super = tmp;
                        }
                        return ret;
                    };
                })(name, protoProps[name])
                : protoProps[name];
        }

        function QpxClass() {
            if (!initializing && this.init) {
                this.init.apply(this, arguments);
            }
        }

        QpxClass.prototype = prototype;
        QpxClass.prototype.constructor = QpxClass;

        // dědičnost statických členů (podobně jako statické atributy/metody v Javě)
        for (var key in this) {
            if (Object.prototype.hasOwnProperty.call(this, key) && key !== "prototype") {
                QpxClass[key] = this[key];
            }
        }
        QpxClass.extend = Class.extend;
        QpxClass.mixin = Class.mixin;
        QpxClass.implement = Class.mixin;

        if (staticProps) {
            for (var sKey in staticProps) {
                QpxClass[sKey] = staticProps[sKey];
            }
        }

        return QpxClass;
    };

    // přimíchání dalších vlastností do prototypu (obdoba Java interface / traits)
    Class.mixin = function () {
        var mixins = Array.prototype.slice.call(arguments);
        for (var i = 0; i < mixins.length; i++) {
            var mixin = mixins[i];
            for (var name in mixin) {
                if (name !== "constructor") {
                    this.prototype[name] = mixin[name];
                }
            }
        }
        return this;
    };

    qpx.Class = Class;

    // =================================================================
    // Utility
    // =================================================================
    qpx.extend = function (target) {
        var args = Array.prototype.slice.call(arguments, 1);
        for (var i = 0; i < args.length; i++) {
            var src = args[i];
            if (!src) { continue; }
            for (var k in src) { target[k] = src[k]; }
        }
        return target;
    };

    qpx.isString = function (v) { return typeof v === "string"; };
    qpx.isFunction = function (v) { return typeof v === "function"; };
    qpx.isObject = function (v) { return v !== null && typeof v === "object" && !Array.isArray(v); };

    qpx.uid = (function () {
        var counter = 0;
        return function (prefix) {
            counter += 1;
            return (prefix || "qpx") + counter;
        };
    })();

    qpx.toPx = function (v) {
        return (typeof v === "number") ? v + "px" : v;
    };

    // čtení hodnoty z objektu podle cesty "a.b.c"
    qpx.resolve = function (obj, path) {
        if (obj == null || !path) { return undefined; }
        var parts = String(path).split(".");
        var cur = obj;
        for (var i = 0; i < parts.length; i++) {
            if (cur == null) { return undefined; }
            cur = cur[parts[i]];
        }
        return cur;
    };

    // =================================================================
    // Jednoduchý pub/sub mixin — lze přimíchat do libovolné qpx.Class
    // =================================================================
    qpx.EventsMixin = {
        on: function (event, handler) {
            this._handlers = this._handlers || {};
            (this._handlers[event] = this._handlers[event] || []).push(handler);
            return this;
        },
        off: function (event, handler) {
            if (!this._handlers || !this._handlers[event]) { return this; }
            if (!handler) {
                this._handlers[event] = [];
                return this;
            }
            this._handlers[event] = this._handlers[event].filter(function (h) {
                return h !== handler;
            });
            return this;
        },
        trigger: function (event) {
            var args = Array.prototype.slice.call(arguments, 1);
            if (this._handlers && this._handlers[event]) {
                this._handlers[event].slice().forEach(function (h) {
                    h.apply(this, args);
                }, this);
            }
            // zrcadlení jako jQuery event na kontejneru, aby šlo napojit i $(el).on(...)
            if (this.$container) {
                this.$container.trigger("qpx:" + event, args);
            }
            return this;
        }
    };

})(window, window.jQuery);

/*!
 * qpx - widget
 * Základní bázová třída pro všechny UI komponenty + registr a tovární
 * metoda qpx.ui(config, container), přes kterou se skládají komponenty
 * do JSON stromu (podobně jako ve webixu).
 *
 * Novinky v této verzi:
 *  - každý widget dostane na svůj container HTML atribut "id" (buď z
 *    options.id, nebo automaticky vygenerovaný) - POKUD ho container
 *    ještě nemá. Umožňuje pak najít instanci klasicky přes jQuery:
 *
 *       var sw = $("#mySwitch").data("qpSwitch");
 *
 *  - kdykoliv volané qpx.registerWidget(name, Class) navíc automaticky
 *    zaregistruje i jQuery plugin stejného jména (chování podobné Kendo UI):
 *
 *       var sw = $("#mySwitch").qpSwitch();               // getter - vrátí instanci
 *       $("#mySwitch").qpSwitch({ value: true });          // vytvoří (pokud neexistuje) / přenastaví options
 *       $("#mySwitch").qpSwitch("value", true);             // zavolá metodu instance: sw.value(true)
 *
 *  - báze qpx.Widget nově obsahuje obecnou metodu option(), kterou
 *    potomci dědí, pokud si ji sami nepřepíší vlastní implementací:
 *
 *       sw.option()                       // -> celý config (object)
 *       sw.option("height")               // -> hodnota jedné vlastnosti
 *       sw.option("height", 100)          // -> nastavení jedné vlastnosti
 *       sw.option({ height: 100, width: 100 }) // -> nastavení více vlastností najednou
 */
(function (qpx, $) {
    "use strict";

    var registry = {};

    var Widget = qpx.Class.extend({

        // výchozí konfigurace, potomci ji přes _super/extend rozšiřují
        defaults: {},

        // config  - konfigurační objekt komponenty
        // container - (volitelně) DOM element / jQuery výběr, do kterého se komponenta vykreslí.
        //             Pokud není zadán, vytvoří se plovoucí <div>, který je možné později připojit.
        init: function (config, container) {
            this.config = $.extend(true, {}, this.defaults, config || {});

            // interní id widgetu - buď převzaté z options.id, nebo vygenerované;
            // zpětně se promítne i do configu, ať option("id") vrací vždy platnou hodnotu
            this.id = this.config.id || qpx.uid("qpx");
            this.config.id = this.id;

            this._children = [];
            this._handlers = {};

            var node = container && (container.jquery ? container[0] : container);
            this.$container = node ? $(node) : $("<div></div>");

            this.$container
                .addClass("qpx-view")
                .attr("data-qpx-id", this.id)
                .data("qpx-widget", this);

            // HTML atribut "id" přiřadíme containeru JEN pokud ho ještě nemá -
            // pokud si element přinesl vlastní id (z HTML/JSP), respektujeme ho
            // a neprepisujeme.
            if (!this.$container.attr("id")) {
                this.$container.attr("id", this.id);
            }

            // uloží instanci i pod jménem "view", pod kterým byl widget
            // zaregistrován (qpx.registerWidget) - viz $(...).data("qpSwitch")
            if (this.constructor.viewName) {
                this.$container.data(this.constructor.viewName, this);
            }

            if (this.config.css) { this.$container.addClass(this.config.css); }
            if (this.config.width !== undefined) { this.$container.css("width", qpx.toPx(this.config.width)); }
            if (this.config.height !== undefined) { this.$container.css("height", qpx.toPx(this.config.height)); }
            if (this.config.hidden) { this.$container.hide(); }

            this.render();

            if (this.config.on) {
                for (var ev in this.config.on) {
                    this.on(ev, this.config.on[ev]);
                }
            }

            this.trigger("ready");
        },

        // potomci přepisují — zde probíhá samotné vykreslení do this.$container
        render: function () {},

        // znovu-vykreslení (výchozí implementace jen zavolá render, konkrétní
        // komponenty typicky přepíší efektivnější variantou)
        refresh: function () {
            this.$container.empty();
            this.render();
            return this;
        },

        show: function () { this.$container.show(); this.trigger("show"); return this; },
        hide: function () { this.$container.hide(); this.trigger("hide"); return this; },

        // ---------------------------------------------------------------
        // Obecná implementace option() - potomci ji dědí, pokud si ji sami
        // nepřepíší vlastní specializovanou verzí (v qpx Class systému
        // úplné přepsání metody v potomkovi nahrazuje tuto bázovou verzi
        // celou; volání this._super(name, value) z potomka je ale možné,
        // pokud chce zachovat i toto obecné chování).
        //
        //   option()                    -> vrátí celý config (object)
        //   option("jmeno")             -> vrátí hodnotu jedné vlastnosti
        //   option("jmeno", hodnota)    -> nastaví jednu vlastnost
        //   option({ a: 1, b: 2 })      -> nastaví víc vlastností najednou
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
            if (prev === value) { return this; }
            this.config[name] = value;

            // obecné, widgetům společné vlastnosti - konkrétní potomci
            // typicky doplňují vlastní specializovanou logiku
            switch (name) {
                case "width":
                    this.$container.css("width", qpx.toPx(value));
                    break;
                case "height":
                    this.$container.css("height", qpx.toPx(value));
                    break;
                case "visible":
                    this.$container.toggle(!!value);
                    break;
                case "hidden":
                    this.$container.toggle(!value);
                    break;
                case "css":
                    if (prev) { this.$container.removeClass(prev); }
                    if (value) { this.$container.addClass(value); }
                    break;
                case "disabled":
                    this.$container.toggleClass("qpx-state-disabled", !!value);
                    break;
            }

            this.trigger("optionChanged", { name: name, value: value, previousValue: prev, component: this });
            return this;
        },

        destroy: function () {
            this.trigger("destroy");
            this._children.forEach(function (child) {
                if (child && child.destroy) { child.destroy(); }
            });
            this._children = [];
            if (this.$container) {
                // POZOR: musí se smazat OBĚ jQuery .data() klíče, které si
                // instance na containeru uložila (viz init()) - jinak by
                // po destroy() ještě $(el).data("qpTagBox") vracelo starou,
                // už zničenou instanci, zatímco $(el).data("qpx-widget")
                // by už správně bylo undefined (nekonzistentní, nebezpečné).
                this.$container.removeData("qpx-widget");
                if (this.constructor.viewName) {
                    this.$container.removeData(this.constructor.viewName);
                }
                this.$container.empty();
            }
        },

        getContainer: function () { return this.$container; },
        getNode: function () { return this.$container[0]; },

        addChild: function (widget) {
            this._children.push(widget);
            return widget;
        },

        getChildren: function () { return this._children.slice(); }
    });

    Widget.mixin(qpx.EventsMixin);

    qpx.Widget = Widget;

    // =================================================================
    // Registr komponent + tovární metoda
    // =================================================================

    // registrace nové komponenty pod jménem použitým v "view"
    qpx.registerWidget = function (name, WidgetClass) {
        registry[name] = WidgetClass;

        // jméno view si uložíme i jako statický člen třídy - použije se
        // v qpx.Widget.init pro $container.data(viewName, instance)
        WidgetClass.viewName = name;

        // automatická registrace jQuery pluginu stejného jména, ve stylu
        // Kendo UI: $(...).qpSwitch() / $(...).qpSwitch({...}) / $(...).qpSwitch("metoda", ...)
        if ($ && $.fn && !$.fn[name]) {
            $.fn[name] = function () {
                var args = Array.prototype.slice.call(arguments);
                return qpx.jqueryPlugin(name, this, args);
            };
        }

        return qpx;
    };

    qpx.getWidgetClass = function (name) {
        return registry[name];
    };

    // -----------------------------------------------------------------
    // Společná implementace jQuery pluginů generovaných v registerWidget().
    //
    //   $(sel).qpXxx()                 -> getter: vrátí instanci NA PRVNÍM
    //                                     prvku výběru (undefined, pokud tam žádná není)
    //   $(sel).qpXxx("instance")        -> totéž jako getter, ale ve stylu
    //                                     DevExtreme ($(...).dxTagBox("instance"));
    //                                     "instance" je vyhrazené klíčové slovo,
    //                                     NIKDY se nepředává jako název metody
    //                                     dál instanci (i kdyby nějaký widget
    //                                     metodu "instance" náhodou definoval)
    //   $(sel).qpXxx("metoda", ...)     -> zavolá metodu "metoda" na existující
    //                                     instanci (např. .qpSwitch("value", true))
    //   $(sel).qpXxx({ ...options })    -> na KAŽDÉM prvku výběru: pokud
    //                                     instance ještě neexistuje, vytvoří ji
    //                                     (qpx.ui), pokud existuje, zavolá na ní
    //                                     option(options); vrací zpět jQuery výběr
    //                                     (standardní chaining)
    // -----------------------------------------------------------------
    qpx.jqueryPlugin = function (viewName, $elements, args) {
        args = args || [];
        var firstArg = args[0];

        // a) bez argumentů -> getter (vrátí instanci prvního prvku výběru)
        if (args.length === 0) {
            return $elements.data(viewName);
        }

        var existingFirst = $elements.data(viewName);

        // b) DevExtreme styl: $(...).qpTagBox("instance") -> vždy jen vrátí
        // instanci, "instance" se NIKDY nepokouší volat jako metodu
        if (firstArg === "instance") {
            return existingFirst;
        }

        // c) první argument je řetězec a instance už existuje -> volání metody
        if (qpx.isString(firstArg) && existingFirst) {
            var method = firstArg;
            var methodArgs = args.slice(1);
            if (qpx.isFunction(existingFirst[method])) {
                return existingFirst[method].apply(existingFirst, methodArgs);
            }
            return existingFirst;
        }

        // d) inicializace / hromadné přenastavení na všech prvcích výběru
        $elements.each(function () {
            var $el = $(this);
            var existing = $el.data(viewName);
            if (existing) {
                if (qpx.isObject(firstArg)) { existing.option(firstArg); }
            } else {
                qpx.ui($.extend({ view: viewName }, qpx.isObject(firstArg) ? firstArg : {}), $el);
            }
        });
        return $elements;
    };

    // -----------------------------------------------------------------
    // Univerzální získání instance BEZ znalosti konkrétního typu widgetu
    // (obdoba .data("qpx-widget"), jen jako pohodlnější/čitelnější volání) -
    // hodí se typicky v obecném/sdíleném kódu, který pracuje s libovolným
    // qpx widgetem (např. testovací nástroje, delegované event handlery):
    //
    //   var w = qpx.getInstance("#mySwitch");
    //   var w = qpx.getInstance(document.getElementById("mySwitch"));
    // -----------------------------------------------------------------
    qpx.getInstance = function (el) {
        return $(el).data("qpx-widget");
    };

    // hlavní tovární metoda — sestavování z JSON konfigurace:
    //   qpx.ui({ view: "template", template: "Ahoj #name#" }, "#mistoVDom");
    qpx.ui = function (config, container) {
        if (qpx.isString(config)) {
            config = { view: config };
        }
        var view = config.view || (config.rows || config.cols ? "layout" : null);
        if (!view) {
            throw new Error("qpx: konfigurace komponenty musí obsahovat 'view' (nebo 'rows'/'cols').");
        }
        var WidgetClass = registry[view];
        if (!WidgetClass) {
            throw new Error("qpx: neregistrovaný typ komponenty '" + view + "'.");
        }

        // instance si během init() sama zaregistruje .data("qpx-widget", ...)
        // i .data(viewName, ...) na svém containeru (viz qpx.Widget.init)
        return new WidgetClass(config, container);
    };

})(window.qpx, jQuery);

/*!
 * qpx - layout
 * Responzivní layout komponenta umožňující libovolně vnořovat "rows" a "cols",
 * podobně jako ve webixu. Interně staví na flexboxu.
 */
(function (qpx, $) {
    "use strict";

    var Layout = qpx.Widget.extend({

        defaults: {
            type: "clean",     // clean | space (mezery mezi buňkami) | line (oddělovací čáry)
            responsive: false, // na úzké obrazovce přepne "cols" na "rows"
            gap: null
        },

        render: function () {
            var cfg = this.config;
            this.$container.addClass("qpx-layout");

            if (cfg.type === "space") { this.$container.addClass("qpx-layout-space"); }
            if (cfg.type === "line") { this.$container.addClass("qpx-layout-line"); }
            if (cfg.gap !== null && cfg.gap !== undefined) { this.$container.css("gap", qpx.toPx(cfg.gap)); }

            if (cfg.rows) {
                this.$container.addClass("qpx-rows");
                this._renderStack(cfg.rows, "row");
            } else if (cfg.cols) {
                this.$container.addClass("qpx-cols");
                if (cfg.responsive) { this.$container.addClass("qpx-responsive"); }
                this._renderStack(cfg.cols, "col");
            }
            // layout bez rows/cols slouží jako prostý kontejner (leaf cell)
        },

        _renderStack: function (items, direction) {
            var self = this;
            items.forEach(function (itemCfg) {
                if (itemCfg === undefined || itemCfg === null) { return; }

                var isSpacer = qpx.isObject(itemCfg) &&
                    !itemCfg.view && !itemCfg.rows && !itemCfg.cols;

                var $cell = $("<div class='qpx-cell qpx-" + direction + "'></div>");
                self._applySizing($cell, itemCfg);
                self.$container.append($cell);

                if (isSpacer) {
                    $cell.addClass("qpx-spacer");
                    return; // prázdná buňka = flexibilní mezera
                }

                var child = qpx.ui(itemCfg, $cell);
                self.addChild(child);
            });
        },

        _applySizing: function ($cell, itemCfg) {
            if (!itemCfg || !qpx.isObject(itemCfg)) { return; }
            if (itemCfg.width !== undefined) {
                $cell.css({ "flex": "0 0 auto", "width": qpx.toPx(itemCfg.width) });
            }
            if (itemCfg.height !== undefined) {
                $cell.css({ "flex": "0 0 auto", "height": qpx.toPx(itemCfg.height) });
            }
            if (itemCfg.gravity !== undefined) {
                $cell.css("flex-grow", itemCfg.gravity);
            }
            if (itemCfg.hidden) { $cell.hide(); }
        }
    });

    qpx.registerWidget("layout", Layout);
    qpx.Layout = Layout;

})(window.qpx, jQuery);

/*!
 * qpx - template
 * První konkrétní UI komponenta frameworku. Chová se obdobně jako
 * "template" ve webixu: vykresluje HTML podle šablony (string, nebo
 * funkce) a dat, která lze kdykoliv změnit přes setValues()/parse().
 *
 * Podpora zápisu proměnných v šabloně: "#jmeno#" i "{jmeno}", včetně
 * vnořených cest "{user.name}".
 */
(function (qpx, $) {
    "use strict";

    var VAR_RE = /#([\w.]+)#|\{([\w.]+)\}/g;

    var Template = qpx.Widget.extend({

        defaults: {
            template: "",   // string šablona, nebo function(data, common){ return html; }
            data: null,     // počáteční data
            autoheight: false,
            borderless: false
        },

        render: function () {
            var cfg = this.config;
            this.$container.addClass("qpx-template");
            if (cfg.autoheight) { this.$container.addClass("qpx-template-autoheight"); }
            if (cfg.borderless) { this.$container.addClass("qpx-borderless"); }

            this._templateFn = this._compile(cfg.template);
            this.data = cfg.data || null;

            this._draw();
        },

        // umožňuje za běhu měnit šablonu i další nastavení, podobně jako
        // webix .define()
        define: function (prop, value) {
            if (qpx.isObject(prop)) {
                $.extend(this.config, prop);
                if (prop.template !== undefined) { this._templateFn = this._compile(prop.template); }
            } else {
                this.config[prop] = value;
                if (prop === "template") { this._templateFn = this._compile(value); }
            }
            this._draw();
            return this;
        },

        // nastaví novou šablonu (zkratka za define("template", tpl))
        setTemplate: function (tpl) {
            return this.define("template", tpl);
        },

        // naplní komponentu daty a překreslí ji — hlavní API pro práci s daty
        setValues: function (data, silent) {
            this.data = data;
            this._draw();
            if (!silent) { this.trigger("change", data); }
            return this;
        },

        getValues: function () {
            return this.data;
        },

        // alias, stejně jako webix .parse()
        parse: function (data) {
            return this.setValues(data);
        },

        // přímé vložení hotového HTML bez průchodu šablonou
        setHTML: function (html) {
            this.$container.html(html);
            this.trigger("afterrender");
            return this;
        },

        refresh: function () {
            this._draw();
            return this;
        },

        _draw: function () {
            var html = this._templateFn ? this._templateFn(this.data || {}, qpx) : "";
            this.$container.html(html);
            this.trigger("afterrender");
        },

        _compile: function (tpl) {
            if (qpx.isFunction(tpl)) { return tpl; }
            var str = (tpl === null || tpl === undefined) ? "" : String(tpl);
            return function (data) {
                data = data || {};
                return str.replace(VAR_RE, function (match, a, b) {
                    var path = a || b;
                    var val = qpx.resolve(data, path);
                    return (val === undefined || val === null) ? "" : val;
                });
            };
        }
    });

    qpx.registerWidget("template", Template);
    qpx.Template = Template;

})(window.qpx, jQuery);

/*!
 * qpx - qpButton
 * Tlačítko se stejnou koncepcí jako DevExtreme dxButton:
 *  - options: text, icon, type, stylingMode, disabled, visible, hint, template
 *  - metody: option(), enable(), disable(), focus()
 *  - události: onClick, onOptionChanged
 *
 * Pozn.: widget byl přejmenován z "button"/qpx.Button na "qpButton"/qpx.qpButton,
 * aby jméno odpovídalo sjednocené konvenci "qp" prefixu ostatních qpx widgetů
 * (qpCheckBox, qpTextBox, qpSwitch, ...). Kdekoliv ve vaší aplikaci nebo
 * v konfiguraci qpToolBar (options.widget) byl použit název "button",
 * je potřeba ho nahradit za "qpButton".
 */
(function (qpx, $) {
    "use strict";

    var Button = qpx.Widget.extend({

        defaults: {
            text: "",
            icon: "",              // krátký text/emoji glyph, nebo "css:trida-ikony"
            type: "normal",        // normal | default | success | danger | warning
            stylingMode: "contained", // contained | outlined | text
            disabled: false,
            visible: true,
            hint: "",
            template: null,        // function(data, $el) pro vlastní vykreslení obsahu
            onClick: null,
            onOptionChanged: null
        },

        render: function () {
            var cfg = this.config;
            this.$container
                .addClass("qpx-button")
                .attr("tabindex", cfg.disabled ? "-1" : "0")
                .attr("role", "button");

            if (cfg.onClick) { this.on("click", cfg.onClick); }
            if (cfg.onOptionChanged) { this.on("optionChanged", cfg.onOptionChanged); }

            this._renderContent();
            this._applyState();

            var self = this;
            this.$container.on("click.qpxButton", function (e) {
                if (self.config.disabled) { return; }
                self.trigger("click", { event: e, component: self, element: self.getNode() });
            });
            this.$container.on("keydown.qpxButton", function (e) {
                if (self.config.disabled) { return; }
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    self.$container.trigger("click");
                }
            });
        },

        _renderContent: function () {
            var cfg = this.config;
            this.$container.empty();

            if (qpx.isFunction(cfg.template)) {
                cfg.template(cfg, this.$container);
                return;
            }

            if (cfg.icon) {
                var $icon = $("<span class='qpx-icon'></span>");
                if (String(cfg.icon).indexOf("css:") === 0) {
                    $icon.addClass(String(cfg.icon).slice(4));
                } else {
                    $icon.text(cfg.icon);
                }
                this.$container.append($icon);
            }
            if (cfg.text) {
                this.$container.append($("<span class='qpx-button-text'></span>").text(cfg.text));
            }
            if (cfg.hint) { this.$container.attr("title", cfg.hint); }
        },

        _applyState: function () {
            var cfg = this.config;
            this.$container
                .removeClass("qpx-button-normal qpx-button-default qpx-button-success qpx-button-danger qpx-button-warning")
                .addClass("qpx-button-" + cfg.type)
                .removeClass("qpx-button-mode-contained qpx-button-mode-outlined qpx-button-mode-text")
                .addClass("qpx-button-mode-" + cfg.stylingMode)
                .toggleClass("qpx-state-disabled", !!cfg.disabled)
                .toggleClass("qpx-hidden", !cfg.visible)
                .attr("aria-disabled", !!cfg.disabled)
                .attr("tabindex", cfg.disabled ? "-1" : "0");
        },

        // option("text") -> čtení; option("text","Nový text") -> zápis; option({text:.., icon:..}) -> hromadně
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
            this._renderContent();
            this._applyState();
            this.trigger("optionChanged", { name: name, value: value, previousValue: prev, element: this.getNode() });
            return this;
        },

        enable: function () { return this.option("disabled", false); },
        disable: function () { return this.option("disabled", true); },
        focus: function () { this.$container.trigger("focus"); return this; },

        destroy: function () {
            this.$container.off(".qpxButton");
            this._super();
        }
    });

    qpx.registerWidget("qpButton", Button);
    qpx.qpButton = Button;

})(window.qpx, jQuery);

/*!
 * qpx - qpButtonGroup
 * Skupina vizuálně spojených tlačítek, koncepčně jako DevExtreme dxButtonGroup.
 *  - options: items, keyExpr, selectionMode, selectedItemKeys, stylingMode
 *  - události: onItemClick, onSelectionChanged, onOptionChanged
 *
 * Pozn.: widget byl přejmenován z "buttonGroup"/qpx.ButtonGroup na
 * "qpButtonGroup"/qpx.qpButtonGroup (sjednocení "qp" prefixu). Kdekoliv
 * byl použit název "buttonGroup" (např. v options.widget u qpToolBar
 * položek), nahraďte ho za "qpButtonGroup".
 */
(function (qpx, $) {
    "use strict";

    var ButtonGroup = qpx.Widget.extend({

        defaults: {
            items: [],               // [{ text, icon, disabled, key, hint }]
            keyExpr: "key",
            selectionMode: "single", // single | multiple | none
            selectedItemKeys: [],
            stylingMode: "outlined", // contained | outlined | text
            disabled: false,
            visible: true,
            onItemClick: null,
            onSelectionChanged: null,
            onOptionChanged: null
        },

        render: function () {
            var cfg = this.config;
            this.$container
                .addClass("qpx-buttongroup")
                .toggleClass("qpx-hidden", !cfg.visible);

            if (cfg.onItemClick) { this.on("itemClick", cfg.onItemClick); }
            if (cfg.onSelectionChanged) { this.on("selectionChanged", cfg.onSelectionChanged); }
            if (cfg.onOptionChanged) { this.on("optionChanged", cfg.onOptionChanged); }

            this.selectedItemKeys = (cfg.selectedItemKeys || []).slice();
            this._renderItems();
        },

        _keyOf: function (item, index) {
            return item[this.config.keyExpr] !== undefined ? item[this.config.keyExpr] : index;
        },

        _renderItems: function () {
            var self = this;
            var cfg = this.config;
            this.$container.empty();

            cfg.items.forEach(function (item, index) {
                var key = self._keyOf(item, index);
                var selected = self.selectedItemKeys.indexOf(key) !== -1;

                var $btn = $("<div class='qpx-buttongroup-item qpx-button qpx-button-mode-" + cfg.stylingMode + "'></div>")
                    .toggleClass("qpx-state-selected", selected)
                    .toggleClass("qpx-state-disabled", !!item.disabled || !!cfg.disabled)
                    .attr("tabindex", (item.disabled || cfg.disabled) ? "-1" : "0")
                    .attr("role", "button");

                if (item.icon) {
                    var $icon = $("<span class='qpx-icon'></span>");
                    (String(item.icon).indexOf("css:") === 0)
                        ? $icon.addClass(String(item.icon).slice(4))
                        : $icon.text(item.icon);
                    $btn.append($icon);
                }
                if (item.text) {
                    $btn.append($("<span class='qpx-button-text'></span>").text(item.text));
                }
                if (item.hint) { $btn.attr("title", item.hint); }

                $btn.on("click", function (e) {
                    if (item.disabled || self.config.disabled) { return; }
                    self._handleSelection(key);
                    self.trigger("itemClick", { event: e, itemData: item, itemIndex: index, itemElement: $btn[0], component: self });
                });

                self.$container.append($btn);
            });
        },

        _handleSelection: function (key) {
            var mode = this.config.selectionMode;
            if (mode === "none") { return; }

            var prev = this.selectedItemKeys.slice();
            if (mode === "single") {
                this.selectedItemKeys = [key];
            } else { // multiple
                var idx = this.selectedItemKeys.indexOf(key);
                if (idx === -1) { this.selectedItemKeys.push(key); }
                else { this.selectedItemKeys.splice(idx, 1); }
            }
            this.config.selectedItemKeys = this.selectedItemKeys;
            this._renderItems();
            this.trigger("selectionChanged", {
                addedItemKeys: this.selectedItemKeys.filter(function (k) { return prev.indexOf(k) === -1; }),
                removedItemKeys: prev.filter(function (k) { return this.selectedItemKeys.indexOf(k) === -1; }.bind(this)),
                component: this
            });
        },

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
            if (name === "selectedItemKeys") { this.selectedItemKeys = (value || []).slice(); }
            this._renderItems();
            this.trigger("optionChanged", { name: name, value: value, previousValue: prev });
            return this;
        },

        getSelectedItemKeys: function () { return this.selectedItemKeys.slice(); },
        enable: function () { return this.option("disabled", false); },
        disable: function () { return this.option("disabled", true); }
    });

    qpx.registerWidget("qpButtonGroup", ButtonGroup);
    qpx.qpButtonGroup = ButtonGroup;

})(window.qpx, jQuery);

/*!
 * qpx - qpDropDownButton
 * Tlačítko s rozbalovacím seznamem položek, koncepčně jako DevExtreme
 * dxDropDownButton (volitelně "split" tlačítko se samostatnou šipkou).
 *  - options: text, icon, items, keyExpr, displayExpr, splitButton, useSelectMode
 *  - události: onButtonClick, onItemClick, onSelectionChanged, onOptionChanged
 *
 * Pozn.: widget byl přejmenován z "dropDownButton"/qpx.DropDownButton na
 * "qpDropDownButton"/qpx.qpDropDownButton (sjednocení "qp" prefixu).
 * Kdekoliv byl použit název "dropDownButton" (např. view: "dropDownButton"
 * v qpPropertyGrid, nebo options.widget u qpToolBar položek), nahraďte
 * ho za "qpDropDownButton".
 */
(function (qpx, $) {
    "use strict";

    var openInstance = null; // aktuálně otevřená instance (jen jedna najednou)

    var DropDownButton = qpx.Widget.extend({

        defaults: {
            text: "",
            icon: "",
            items: [],              // [{ text, icon, key, disabled }]
            keyExpr: "key",
            displayExpr: "text",
            splitButton: false,     // true = samostatné tlačítko + šipka
            useSelectMode: false,   // true = vybraná položka nahradí text tlačítka
            selectedItemKey: null,
            disabled: false,
            visible: true,
            stylingMode: "contained",
            dropDownOptions: {},    // { width }
            onButtonClick: null,
            onItemClick: null,
            onSelectionChanged: null,
            onOptionChanged: null
        },

        render: function () {
            var cfg = this.config;
            this.$container
                .addClass("qpx-dropdownbutton qpx-button qpx-button-mode-" + cfg.stylingMode)
                .toggleClass("qpx-dropdownbutton-split", !!cfg.splitButton)
                .toggleClass("qpx-hidden", !cfg.visible);

            if (cfg.onButtonClick) { this.on("buttonClick", cfg.onButtonClick); }
            if (cfg.onItemClick) { this.on("itemClick", cfg.onItemClick); }
            if (cfg.onSelectionChanged) { this.on("selectionChanged", cfg.onSelectionChanged); }
            if (cfg.onOptionChanged) { this.on("optionChanged", cfg.onOptionChanged); }

            this._isOpen = false;
            this._buildDom();
            this._bindEvents();
        },

        _keyOf: function (item, index) {
            return item[this.config.keyExpr] !== undefined ? item[this.config.keyExpr] : index;
        },
        _labelOf: function (item) {
            return item[this.config.displayExpr];
        },

        _buildDom: function () {
            var cfg = this.config;
            this.$container.empty().attr("tabindex", cfg.disabled ? "-1" : "0");

            this.$mainPart = $("<span class='qpx-dropdownbutton-main'></span>");
            if (cfg.icon) {
                var $icon = $("<span class='qpx-icon'></span>");
                (String(cfg.icon).indexOf("css:") === 0) ? $icon.addClass(String(cfg.icon).slice(4)) : $icon.text(cfg.icon);
                this.$mainPart.append($icon);
            }
            this.$textEl = $("<span class='qpx-button-text'></span>").text(this._currentText());
            this.$mainPart.append(this.$textEl);

            this.$arrowPart = $("<span class='qpx-dropdownbutton-arrow'>▾</span>");

            this.$container.append(this.$mainPart, this.$arrowPart);

            this.$menu = $("<div class='qpx-popup-list qpx-dropdownbutton-menu'></div>").appendTo(document.body).hide();
            this._renderMenuItems();
        },

        _currentText: function () {
            var cfg = this.config;
            if (cfg.useSelectMode && cfg.selectedItemKey !== null) {
                var self = this;
                var found = cfg.items.filter(function (it, i) { return self._keyOf(it, i) === cfg.selectedItemKey; })[0];
                if (found) { return this._labelOf(found); }
            }
            return cfg.text;
        },

        _renderMenuItems: function () {
            var self = this;
            var cfg = this.config;
            this.$menu.empty();
            if (cfg.dropDownOptions && cfg.dropDownOptions.width) {
                this.$menu.css("width", qpx.toPx(cfg.dropDownOptions.width));
            }

            cfg.items.forEach(function (item, index) {
                var key = self._keyOf(item, index);
                var $row = $("<div class='qpx-popup-list-item'></div>")
                    .toggleClass("qpx-state-disabled", !!item.disabled)
                    .toggleClass("qpx-state-selected", cfg.useSelectMode && cfg.selectedItemKey === key);

                if (item.icon) {
                    var $icon = $("<span class='qpx-icon'></span>");
                    (String(item.icon).indexOf("css:") === 0) ? $icon.addClass(String(item.icon).slice(4)) : $icon.text(item.icon);
                    $row.append($icon);
                }
                $row.append($("<span></span>").text(self._labelOf(item)));

                $row.on("click", function (e) {
                    if (item.disabled) { return; }
                    self._close();
                    if (cfg.useSelectMode) {
                        var prevKey = cfg.selectedItemKey;
                        cfg.selectedItemKey = key;
                        self.$textEl.text(self._currentText());
                        self.trigger("selectionChanged", { item: item, key: key, previousKey: prevKey, component: self });
                    }
                    self.trigger("itemClick", { event: e, itemData: item, itemIndex: index, component: self });
                });

                self.$menu.append($row);
            });
        },

        _bindEvents: function () {
            var self = this;
            var cfg = this.config;

            if (cfg.splitButton) {
                this.$mainPart.on("click.qpxDdb", function (e) {
                    if (self.config.disabled) { return; }
                    self._close();
                    self.trigger("buttonClick", { event: e, component: self, element: self.getNode() });
                });
                this.$arrowPart.on("click.qpxDdb", function (e) {
                    if (self.config.disabled) { return; }
                    e.stopPropagation();
                    self._toggle();
                });
            } else {
                this.$container.on("click.qpxDdb", function (e) {
                    if (self.config.disabled) { return; }
                    self._toggle();
                    self.trigger("buttonClick", { event: e, component: self, element: self.getNode() });
                });
            }

            $(document).on("mousedown.qpxDdb" + this.id, function (e) {
                if (!self._isOpen) { return; }
                if ($(e.target).closest(self.$menu).length || $(e.target).closest(self.$container).length) { return; }
                self._close();
            });
        },

        _toggle: function () { this._isOpen ? this._close() : this._open(); },

        _open: function () {
            if (openInstance && openInstance !== this) { openInstance._close(); }
            var off = this.$container.offset();
            this.$menu.css({
                top: off.top + this.$container.outerHeight(),
                left: off.left,
                minWidth: this.$container.outerWidth()
            }).show();
            this._isOpen = true;
            openInstance = this;
            this.trigger("opened", { component: this });
        },

        _close: function () {
            if (!this._isOpen) { return; }
            this.$menu.hide();
            this._isOpen = false;
            if (openInstance === this) { openInstance = null; }
            this.trigger("closed", { component: this });
        },

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
            this._buildDom();
            this._bindEvents();
            this.trigger("optionChanged", { name: name, value: value, previousValue: prev });
            return this;
        },

        enable: function () { return this.option("disabled", false); },
        disable: function () { return this.option("disabled", true); },

        destroy: function () {
            this.$container.off(".qpxDdb");
            $(document).off(".qpxDdb" + this.id);
            if (this.$menu) { this.$menu.remove(); }
            if (openInstance === this) { openInstance = null; }
            this._super();
        }
    });

    qpx.registerWidget("qpDropDownButton", DropDownButton);
    qpx.qpDropDownButton = DropDownButton;

})(window.qpx, jQuery);

/*!
 * qpx - qpSwitch
 * Přepínač inspirovaný DevExtreme dxSwitch:
 *  - options: value, onText, offText, name, disabled, visible, hint, stylingMode
 *  - metody: option(), value(), toggle(), enable(), disable(), focus()
 *  - události: onValueChanged, onOptionChanged
 */
(function (qpx, $) {
    "use strict";

    var Switch = qpx.Widget.extend({

        defaults: {
            value: false,          // true/false
            onText: "On",
            offText: "Off",
            name: "",
            disabled: false,
            visible: true,
            hint: "",
            stylingMode: "default", // default | outlined | flat
            onValueChanged: null,
            onOptionChanged: null
        },

        render: function () {
            var cfg = this.config;

            this.$container
                .addClass("qpx-switch")
                .addClass("qpx-switch-mode-" + cfg.stylingMode)
                .toggleClass("qpx-hidden", !cfg.visible)
                .toggleClass("qpx-state-disabled", !!cfg.disabled)
                .attr("role", "switch")
                .attr("tabindex", cfg.disabled ? "-1" : "0")
                .attr("aria-checked", !!cfg.value);

            if (cfg.name) {
                this.$container.attr("data-qpx-name", cfg.name);
            }
            if (cfg.hint) {
                this.$container.attr("title", cfg.hint);
            }

            if (cfg.onValueChanged) { this.on("valueChanged", cfg.onValueChanged); }
            if (cfg.onOptionChanged) { this.on("optionChanged", cfg.onOptionChanged); }

            this._renderContent();
            this._bindEvents();
        },

        _renderContent: function () {
            var cfg = this.config;
            this.$container.empty();

            var $track = $("<div class='qpx-switch-track'></div>");
            var $thumb = $("<div class='qpx-switch-thumb'></div>");
            var $labelOn = $("<span class='qpx-switch-label qpx-switch-label-on'></span>").text(cfg.onText);
            var $labelOff = $("<span class='qpx-switch-label qpx-switch-label-off'></span>").text(cfg.offText);

            $track.append($labelOff, $labelOn);
            $track.append($thumb);

            this.$container.append($track);

            this.$container
                .toggleClass("qpx-switch-on", !!cfg.value)
                .toggleClass("qpx-switch-off", !cfg.value)
                .attr("aria-checked", !!cfg.value);
        },

        _bindEvents: function () {
            var self = this;

            this.$container.off(".qpxSwitch");

            this.$container.on("click.qpxSwitch", function (e) {
                if (self.config.disabled) { return; }
                self.toggle();
            });

            this.$container.on("keydown.qpxSwitch", function (e) {
                if (self.config.disabled) { return; }
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    self.toggle();
                }
            });
        },

        // veřejné API: value() getter/setter
        value: function (val) {
            if (arguments.length === 0) {
                return !!this.config.value;
            }
            return this.option("value", !!val);
        },

        toggle: function () {
            return this.option("value", !this.config.value);
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

            if (name === "value") {
                this.$container
                    .toggleClass("qpx-switch-on", !!this.config.value)
                    .toggleClass("qpx-switch-off", !this.config.value)
                    .attr("aria-checked", !!this.config.value);

                this.trigger("valueChanged", {
                    value: !!this.config.value,
                    previousValue: !!prev,
                    component: this,
                    element: this.getNode()
                });
            } else if (name === "visible") {
                this.$container.toggleClass("qpx-hidden", !value);
            } else if (name === "disabled") {
                this.$container
                    .toggleClass("qpx-state-disabled", !!value)
                    .attr("tabindex", value ? "-1" : "0");
            } else if (name === "stylingMode") {
                this.$container
                    .removeClass("qpx-switch-mode-default qpx-switch-mode-outlined qpx-switch-mode-flat")
                    .addClass("qpx-switch-mode-" + value);
            }

            this._renderContent();

            this.trigger("optionChanged", {
                name: name,
                value: value,
                previousValue: prev,
                element: this.getNode(),
                component: this
            });

            return this;
        },

        enable: function () { return this.option("disabled", false); },
        disable: function () { return this.option("disabled", true); },
        focus: function () { this.$container.trigger("focus"); return this; },

        destroy: function () {
            this.$container.off(".qpxSwitch");
            this._super();
        }
    });

    qpx.registerWidget("qpSwitch", Switch);
    qpx.qpSwitch = Switch;

})(window.qpx, jQuery);

/*!
 * qpx - qpCheckBox
 * Zaškrtávací pole (booleovská, případně "indeterminate" hodnota),
 * koncepčně i vzhledově co nejblíže DevExtreme dxCheckBox.
 *
 * options:
 *   value (true|false|null - null = neurčitý/indeterminate stav), text, name,
 *   iconSize, disabled, readOnly, visible, hoverStateEnabled, focusStateEnabled,
 *   tabIndex
 *
 * events:
 *   onInitialized, onContentReady, onValueChanged, onOptionChanged,
 *   onFocusIn, onFocusOut, onDisposing
 *
 * methods:
 *   option(name[, value]), value([val]), focus(), blur(), reset(),
 *   enable(), disable(), destroy()
 */
(function (qpx, $) {
    "use strict";

    var CheckBox = qpx.Widget.extend({

        defaults: {
            value: false,          // true | false | null (neurčitý stav)
            text: "",
            name: null,

            iconSize: 18,

            disabled: false,
            readOnly: false,
            visible: true,
            hoverStateEnabled: true,
            focusStateEnabled: true,
            tabIndex: 0,

            onValueChanged: null,
            onOptionChanged: null,
            onInitialized: null,
            onContentReady: null,
            onFocusIn: null,
            onFocusOut: null,
            onDisposing: null
        },

        // ---------------------------------------------------------------
        render: function () {
            var cfg = this.config;
            var self = this;

            this.$container
                .addClass("qpx-checkbox")
                .toggleClass("qpx-hidden", !cfg.visible)
                .toggleClass("qpx-state-disabled", !!cfg.disabled)
                .toggleClass("qpx-state-readonly", !!cfg.readOnly)
                .toggleClass("qpx-checkbox-hoverable", !!cfg.hoverStateEnabled && !cfg.disabled)
                .attr("role", "checkbox");

            if (cfg.onInitialized) { this.on("ready", cfg.onInitialized); }
            if (cfg.onContentReady) { this.on("contentReady", cfg.onContentReady); }
            if (cfg.onValueChanged) { this.on("valueChanged", cfg.onValueChanged); }
            if (cfg.onOptionChanged) { this.on("optionChanged", cfg.onOptionChanged); }
            if (cfg.onFocusIn) { this.on("focusIn", cfg.onFocusIn); }
            if (cfg.onFocusOut) { this.on("focusOut", cfg.onFocusOut); }
            if (cfg.onDisposing) { this.on("destroy", cfg.onDisposing); }

            this._buildDom();
            this._bindEvents();
            this._renderState();

            setTimeout(function () { self.trigger("contentReady", { component: self }); }, 0);
        },

        // ---------------------------------------------------------------
        // DOM
        // ---------------------------------------------------------------
        _buildDom: function () {
            var cfg = this.config;
            this.$container.empty();

            this.$icon = $("<span class='qpx-checkbox-icon'></span>").css({
                width: qpx.toPx(cfg.iconSize),
                height: qpx.toPx(cfg.iconSize)
            });
            this.$mark = $("<span class='qpx-checkbox-mark'></span>");
            this.$icon.append(this.$mark);

            this.$text = $("<span class='qpx-checkbox-text'></span>").text(cfg.text || "").toggle(!!cfg.text);

            this.$container.append(this.$icon, this.$text);

            if (cfg.name) { this.$container.attr("data-qpx-name", cfg.name); }
            this._applyTabIndex();
        },

        _bindEvents: function () {
            var self = this;
            var cfg = this.config;

            this.$container.on("click.qpxCheckBox", function (e) {
                e.preventDefault();
                if (cfg.disabled || cfg.readOnly) { return; }
                self._toggle();
            });

            this.$container.on("keydown.qpxCheckBox", function (e) {
                if (cfg.disabled || cfg.readOnly) { return; }
                if (e.key === " " || e.key === "Spacebar" || e.key === "Enter") {
                    e.preventDefault();
                    self._toggle();
                }
            });

            this.$container.on("focusin.qpxCheckBox", function () {
                if (cfg.disabled) { return; }
                self.$container.addClass("qpx-state-focused");
                self.trigger("focusIn", { component: self, element: self.getNode() });
            });

            this.$container.on("focusout.qpxCheckBox", function () {
                self.$container.removeClass("qpx-state-focused");
                self.trigger("focusOut", { component: self, element: self.getNode() });
            });
        },

        _toggle: function () {
            // sled kliknutím: false -> true -> false (indeterminate lze nastavit
            // jen programově přes option("value", null), stejně jako v DevExtreme)
            this.option("value", !this.config.value);
        },

        _applyTabIndex: function () {
            var cfg = this.config;
            this.$container.attr("tabindex", (cfg.disabled || !cfg.focusStateEnabled) ? -1 : (cfg.tabIndex || 0));
        },

        _renderState: function () {
            var cfg = this.config;
            var isIndeterminate = cfg.value === null || cfg.value === undefined;

            this.$container
                .toggleClass("qpx-state-checked", cfg.value === true)
                .toggleClass("qpx-state-indeterminate", isIndeterminate)
                .attr("aria-checked", isIndeterminate ? "mixed" : String(!!cfg.value));

            this.$text.text(cfg.text || "").toggle(!!cfg.text);
        },

        // ---------------------------------------------------------------
        // Veřejné API
        // ---------------------------------------------------------------
        value: function (val) {
            if (arguments.length === 0) { return this.config.value; }
            return this.option("value", val);
        },

        focus: function () { this.$container.trigger("focus"); return this; },
        blur: function () { this.$container.trigger("blur"); return this; },
        reset: function () { return this.option("value", false); },
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
                case "value":
                    this._renderState();
                    this.trigger("valueChanged", { value: value, previousValue: prev, component: this, element: this.getNode() });
                    break;

                case "text":
                    this._renderState();
                    break;

                case "disabled":
                    this.$container.toggleClass("qpx-state-disabled", !!value);
                    this._applyTabIndex();
                    break;

                case "readOnly":
                    this.$container.toggleClass("qpx-state-readonly", !!value);
                    break;

                case "visible":
                    this.$container.toggleClass("qpx-hidden", !value);
                    break;

                case "hoverStateEnabled":
                    this.$container.toggleClass("qpx-checkbox-hoverable", !!value && !this.config.disabled);
                    break;

                case "focusStateEnabled":
                case "tabIndex":
                    this._applyTabIndex();
                    break;

                case "iconSize":
                    this.$icon.css({ width: qpx.toPx(value), height: qpx.toPx(value) });
                    break;
            }

            this.trigger("optionChanged", { name: name, value: value, previousValue: prev, component: this });
            return this;
        },

        destroy: function () {
            this.$container.off(".qpxCheckBox");
            this._super();
        }
    });

    qpx.registerWidget("qpCheckBox", CheckBox);
    qpx.qpCheckBox = CheckBox;

})(window.qpx, jQuery);

/*!
 * qpx - qpNumberBox
 * Vstupní pole pro čísla se spin tlačítky, koncepčně i vzhledově co
 * nejblíže DevExtreme dxNumberBox. Hodnota (option "value") je vždy
 * typu number nebo null - zobrazený text se formátuje dle "format"
 * a při Enteru/ztrátě focusu se přepočítá a ořízne dle min/max.
 *
 * options:
 *   value (number|null), min, max, step, showSpinButtons, showClearButton,
 *   format (počet desetinných míst, nebo function(value) -> string),
 *   placeholder, stylingMode ("outlined"|"filled"|"underlined"),
 *   disabled, readOnly, visible
 *
 * events:
 *   onInitialized, onContentReady, onValueChanged, onOptionChanged,
 *   onFocusIn, onFocusOut, onEnterKey, onKeyDown, onKeyUp, onDisposing
 *
 * methods:
 *   option(name[, value]), value([val]), focus(), blur(), reset(),
 *   enable(), disable(), destroy()
 */
(function (qpx, $) {
    "use strict";

    var NumberBox = qpx.Widget.extend({

        defaults: {
            value: null,
            min: null,
            max: null,
            step: 1,

            format: null,  // number = počet desetinných míst, nebo function(value){ return "text"; }

            showSpinButtons: true,
            showClearButton: false,
            stylingMode: "outlined",  // outlined | filled | underlined
            placeholder: "",

            disabled: false,
            readOnly: false,
            visible: true,

            onValueChanged: null,
            onOptionChanged: null,
            onInitialized: null,
            onContentReady: null,
            onFocusIn: null,
            onFocusOut: null,
            onEnterKey: null,
            onKeyDown: null,
            onKeyUp: null,
            onDisposing: null
        },

        // ---------------------------------------------------------------
        render: function () {
            var cfg = this.config;
            var self = this;

            // vstupní hodnotu hned na začátku znormalizujeme (parse + ořez min/max)
            cfg.value = this._clamp(this._parse(cfg.value));

            this.$container
                .addClass("qpx-numberbox")
                .addClass("qpx-numberbox-mode-" + cfg.stylingMode)
                .toggleClass("qpx-hidden", !cfg.visible)
                .toggleClass("qpx-state-disabled", !!cfg.disabled)
                .toggleClass("qpx-state-readonly", !!cfg.readOnly)
                .toggleClass("qpx-numberbox-spins-visible", !!cfg.showSpinButtons);

            if (cfg.onInitialized) { this.on("ready", cfg.onInitialized); }
            if (cfg.onContentReady) { this.on("contentReady", cfg.onContentReady); }
            if (cfg.onValueChanged) { this.on("valueChanged", cfg.onValueChanged); }
            if (cfg.onOptionChanged) { this.on("optionChanged", cfg.onOptionChanged); }
            if (cfg.onFocusIn) { this.on("focusIn", cfg.onFocusIn); }
            if (cfg.onFocusOut) { this.on("focusOut", cfg.onFocusOut); }
            if (cfg.onEnterKey) { this.on("enterKey", cfg.onEnterKey); }
            if (cfg.onKeyDown) { this.on("keyDown", cfg.onKeyDown); }
            if (cfg.onKeyUp) { this.on("keyUp", cfg.onKeyUp); }
            if (cfg.onDisposing) { this.on("destroy", cfg.onDisposing); }

            this._buildDom();
            this._bindEvents();

            setTimeout(function () { self.trigger("contentReady", { component: self }); }, 0);
        },

        // ---------------------------------------------------------------
        // DOM
        // ---------------------------------------------------------------
        _buildDom: function () {
            var cfg = this.config;
            this.$container.empty();

            this.$input = $("<input class='qpx-numberbox-input' type='text' inputmode='decimal' autocomplete='off'>")
                .attr("placeholder", cfg.placeholder || "")
                .prop("disabled", !!cfg.disabled)
                .prop("readOnly", !!cfg.readOnly);

            this.$clearBtn = $("<span class='qpx-numberbox-clear' tabindex='-1' title='Vymazat'>✕</span>").hide();

            this.$spinUp = $("<span class='qpx-numberbox-spin qpx-numberbox-spin-up' tabindex='-1'>▲</span>");
            this.$spinDown = $("<span class='qpx-numberbox-spin qpx-numberbox-spin-down' tabindex='-1'>▼</span>");
            this.$spins = $("<span class='qpx-numberbox-spins'></span>").append(this.$spinUp, this.$spinDown);

            this.$container.append(this.$input, this.$clearBtn, this.$spins);

            this._renderField();
        },

        _bindEvents: function () {
            var self = this;
            var cfg = this.config;

            this.$input.on("keydown.qpxNumberBox", function (e) {
                self.trigger("keyDown", { event: e, component: self, element: self.getNode() });
                if (cfg.disabled || cfg.readOnly) { return; }

                if (e.key === "Enter") {
                    self._commit();
                    self.trigger("enterKey", { event: e, component: self, element: self.getNode() });
                } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    self._step(1);
                } else if (e.key === "ArrowDown") {
                    e.preventDefault();
                    self._step(-1);
                } else if (!self._isEditKeyAllowed(e)) {
                    e.preventDefault();
                }
            });

            this.$input.on("keyup.qpxNumberBox", function (e) {
                self.trigger("keyUp", { event: e, component: self, element: self.getNode() });
            });

            this.$input.on("input.qpxNumberBox", function () {
                self._renderClearButton();
            });

            this.$input.on("focus.qpxNumberBox", function () {
                self.$container.addClass("qpx-state-focused");
                self.trigger("focusIn", { component: self, element: self.getNode() });
            });

            this.$input.on("blur.qpxNumberBox", function () {
                self.$container.removeClass("qpx-state-focused");
                self._commit();
                self.trigger("focusOut", { component: self, element: self.getNode() });
            });

            this.$spinUp.on("mousedown.qpxNumberBox", function (e) { e.preventDefault(); });
            this.$spinUp.on("click.qpxNumberBox", function (e) {
                e.preventDefault();
                if (cfg.disabled || cfg.readOnly) { return; }
                self.$input.trigger("focus");
                self._step(1);
            });

            this.$spinDown.on("mousedown.qpxNumberBox", function (e) { e.preventDefault(); });
            this.$spinDown.on("click.qpxNumberBox", function (e) {
                e.preventDefault();
                if (cfg.disabled || cfg.readOnly) { return; }
                self.$input.trigger("focus");
                self._step(-1);
            });

            this.$clearBtn.on("mousedown.qpxNumberBox", function (e) { e.preventDefault(); });
            this.$clearBtn.on("click.qpxNumberBox", function (e) {
                e.stopPropagation();
                if (cfg.disabled || cfg.readOnly) { return; }
                self.option("value", null);
                self.$input.trigger("focus");
            });
        },

        _isEditKeyAllowed: function (e) {
            // povolené: číslice, minus, oddělovač desetin, navigace/mazání, Tab,
            // kombinace s Ctrl/Cmd/Alt (copy/paste, zkratky OS...)
            if (e.ctrlKey || e.metaKey || e.altKey) { return true; }
            var navKeys = ["Tab", "Backspace", "Delete", "ArrowLeft", "ArrowRight", "Home", "End"];
            if (navKeys.indexOf(e.key) !== -1) { return true; }
            return /^[0-9\-,.]$/.test(e.key);
        },

        // ---------------------------------------------------------------
        // Práce s hodnotou
        // ---------------------------------------------------------------
        _parse: function (text) {
            if (text === null || text === undefined || String(text).trim() === "") { return null; }
            var normalized = String(text).replace(",", ".").replace(/\s/g, "");
            var num = parseFloat(normalized);
            return isNaN(num) ? null : num;
        },

        _clamp: function (num) {
            if (num === null || num === undefined) { return null; }
            var cfg = this.config;
            if (cfg.min !== null && cfg.min !== undefined && num < cfg.min) { num = cfg.min; }
            if (cfg.max !== null && cfg.max !== undefined && num > cfg.max) { num = cfg.max; }
            return num;
        },

        _format: function (num) {
            var cfg = this.config;
            if (num === null || num === undefined) { return ""; }
            if (qpx.isFunction(cfg.format)) { return cfg.format(num); }
            if (typeof cfg.format === "number") { return num.toFixed(cfg.format); }
            return String(num);
        },

        _commit: function () {
            var clamped = this._clamp(this._parse(this.$input.val()));
            this.option("value", clamped);
        },

        _step: function (dir) {
            var cfg = this.config;
            var current = this._parse(this.$input.val());
            if (current === null) { current = (cfg.value !== null && cfg.value !== undefined) ? cfg.value : 0; }
            var next = this._clamp(current + dir * (cfg.step || 1));
            this.option("value", next);
        },

        _renderField: function () {
            var cfg = this.config;
            this.$input.val(this._format(cfg.value)).attr("placeholder", cfg.placeholder || "");
            this._renderClearButton();
        },

        _renderClearButton: function () {
            var cfg = this.config;
            var val = this.$input.val();
            this.$clearBtn.toggle(!!cfg.showClearButton && val !== "" && val !== undefined && !cfg.disabled && !cfg.readOnly);
        },

        // ---------------------------------------------------------------
        // Veřejné API
        // ---------------------------------------------------------------
        value: function (val) {
            if (arguments.length === 0) { return this.config.value; }
            return this.option("value", val);
        },

        focus: function () { this.$input.trigger("focus"); return this; },
        blur: function () { this.$input.trigger("blur"); return this; },
        reset: function () { return this.option("value", null); },
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

            if (name === "value") { value = this._clamp(this._parse(value)); }

            var prev = this.config[name];
            if (prev === value) { return this; }
            this.config[name] = value;

            switch (name) {
                case "value":
                    this._renderField();
                    this.trigger("valueChanged", { value: value, previousValue: prev, component: this, element: this.getNode() });
                    break;

                case "min":
                case "max":
                    this.config.value = this._clamp(this.config.value);
                    this._renderField();
                    break;

                case "format":
                    this._renderField();
                    break;

                case "disabled":
                    this.$container.toggleClass("qpx-state-disabled", !!value);
                    this.$input.prop("disabled", !!value);
                    this._renderClearButton();
                    break;

                case "readOnly":
                    this.$container.toggleClass("qpx-state-readonly", !!value);
                    this.$input.prop("readOnly", !!value);
                    this._renderClearButton();
                    break;

                case "visible":
                    this.$container.toggleClass("qpx-hidden", !value);
                    break;

                case "stylingMode":
                    this.$container.removeClass("qpx-numberbox-mode-" + prev).addClass("qpx-numberbox-mode-" + value);
                    break;

                case "showSpinButtons":
                    this.$container.toggleClass("qpx-numberbox-spins-visible", !!value);
                    break;

                case "showClearButton":
                    this._renderClearButton();
                    break;

                case "placeholder":
                    this.$input.attr("placeholder", value || "");
                    break;
            }

            this.trigger("optionChanged", { name: name, value: value, previousValue: prev, component: this });
            return this;
        },

        destroy: function () {
            this.$container.off(".qpxNumberBox");
            if (this.$input) { this.$input.off(".qpxNumberBox"); }
            this._super();
        }
    });

    qpx.registerWidget("qpNumberBox", NumberBox);
    qpx.qpNumberBox = NumberBox;

})(window.qpx, jQuery);

/*!
 * qpx - qpTextBox
 * Jednořádkové textové pole, koncepčně i vzhledově co nejblíže
 * DevExtreme dxTextBox.
 *
 * options:
 *   value, placeholder, mode ("text"|"password"|"search"|"tel"|"url"|"email"),
 *   maxLength, showClearButton, stylingMode ("outlined"|"filled"|"underlined"),
 *   spellcheck, valueChangeEvent ("change"|"keyup"|"input"),
 *   disabled, readOnly, visible
 *
 * events:
 *   onInitialized, onContentReady, onValueChanged, onOptionChanged,
 *   onFocusIn, onFocusOut, onEnterKey, onKeyDown, onKeyUp, onDisposing
 *
 * methods:
 *   option(name[, value]), value([val]), focus(), blur(), select(),
 *   reset(), enable(), disable(), destroy()
 */
(function (qpx, $) {
    "use strict";

    var TextBox = qpx.Widget.extend({

        defaults: {
            value: "",
            placeholder: "",
            mode: "text",          // text | password | search | tel | url | email

            maxLength: null,
            showClearButton: false,
            stylingMode: "outlined",  // outlined | filled | underlined
            spellcheck: false,
            valueChangeEvent: "change", // change | keyup | input

            disabled: false,
            readOnly: false,
            visible: true,

            onValueChanged: null,
            onOptionChanged: null,
            onInitialized: null,
            onContentReady: null,
            onFocusIn: null,
            onFocusOut: null,
            onEnterKey: null,
            onKeyDown: null,
            onKeyUp: null,
            onDisposing: null
        },

        // ---------------------------------------------------------------
        render: function () {
            var cfg = this.config;
            var self = this;

            this.$container
                .addClass("qpx-textbox")
                .addClass("qpx-textbox-mode-" + cfg.stylingMode)
                .toggleClass("qpx-hidden", !cfg.visible)
                .toggleClass("qpx-state-disabled", !!cfg.disabled)
                .toggleClass("qpx-state-readonly", !!cfg.readOnly);

            if (cfg.onInitialized) { this.on("ready", cfg.onInitialized); }
            if (cfg.onContentReady) { this.on("contentReady", cfg.onContentReady); }
            if (cfg.onValueChanged) { this.on("valueChanged", cfg.onValueChanged); }
            if (cfg.onOptionChanged) { this.on("optionChanged", cfg.onOptionChanged); }
            if (cfg.onFocusIn) { this.on("focusIn", cfg.onFocusIn); }
            if (cfg.onFocusOut) { this.on("focusOut", cfg.onFocusOut); }
            if (cfg.onEnterKey) { this.on("enterKey", cfg.onEnterKey); }
            if (cfg.onKeyDown) { this.on("keyDown", cfg.onKeyDown); }
            if (cfg.onKeyUp) { this.on("keyUp", cfg.onKeyUp); }
            if (cfg.onDisposing) { this.on("destroy", cfg.onDisposing); }

            this._buildDom();
            this._bindEvents();

            setTimeout(function () { self.trigger("contentReady", { component: self }); }, 0);
        },

        // ---------------------------------------------------------------
        // DOM
        // ---------------------------------------------------------------
        _buildDom: function () {
            var cfg = this.config;
            this.$container.empty();

            this.$input = $("<input class='qpx-textbox-input' autocomplete='off'>")
                .attr("type", this._htmlType())
                .attr("placeholder", cfg.placeholder || "")
                .attr("spellcheck", !!cfg.spellcheck)
                .prop("disabled", !!cfg.disabled)
                .prop("readOnly", !!cfg.readOnly)
                .val(cfg.value == null ? "" : cfg.value);

            if (cfg.maxLength) { this.$input.attr("maxlength", cfg.maxLength); }

            this.$clearBtn = $("<span class='qpx-textbox-clear' tabindex='-1' title='Vymazat'>✕</span>").hide();

            this.$container.append(this.$input, this.$clearBtn);
            this._renderClearButton();
        },

        _htmlType: function () {
            var map = { text: "text", password: "password", search: "search", tel: "tel", url: "url", email: "email" };
            return map[this.config.mode] || "text";
        },

        _bindEvents: function () {
            var self = this;
            var cfg = this.config;

            var commit = function () {
                var val = self.$input.val();
                if (val !== self.config.value) { self.option("value", val); }
            };

            this.$input.on("input.qpxTextBox", function () {
                self._renderClearButton();
                if (cfg.valueChangeEvent === "input") { commit(); }
            });

            this.$input.on("keyup.qpxTextBox", function (e) {
                if (cfg.valueChangeEvent === "keyup") { commit(); }
                self.trigger("keyUp", { event: e, component: self, element: self.getNode() });
            });

            this.$input.on("keydown.qpxTextBox", function (e) {
                self.trigger("keyDown", { event: e, component: self, element: self.getNode() });
                if (e.key === "Enter") {
                    commit();
                    self.trigger("enterKey", { event: e, component: self, element: self.getNode() });
                }
            });

            this.$input.on("change.qpxTextBox", function () {
                if (cfg.valueChangeEvent === "change") { commit(); }
            });

            this.$input.on("focus.qpxTextBox", function () {
                self.$container.addClass("qpx-state-focused");
                self.trigger("focusIn", { component: self, element: self.getNode() });
            });

            this.$input.on("blur.qpxTextBox", function () {
                self.$container.removeClass("qpx-state-focused");
                if (cfg.valueChangeEvent !== "input" && cfg.valueChangeEvent !== "keyup") { commit(); }
                self.trigger("focusOut", { component: self, element: self.getNode() });
            });

            this.$clearBtn.on("mousedown.qpxTextBox", function (e) { e.preventDefault(); });
            this.$clearBtn.on("click.qpxTextBox", function (e) {
                e.stopPropagation();
                if (cfg.disabled || cfg.readOnly) { return; }
                self.option("value", "");
                self.$input.trigger("focus");
            });
        },

        _renderClearButton: function () {
            var cfg = this.config;
            var val = this.$input ? this.$input.val() : cfg.value;
            this.$clearBtn.toggle(!!cfg.showClearButton && !!val && !cfg.disabled && !cfg.readOnly);
        },

        // ---------------------------------------------------------------
        // Veřejné API
        // ---------------------------------------------------------------
        value: function (val) {
            if (arguments.length === 0) { return this.config.value; }
            return this.option("value", val);
        },

        focus: function () { this.$input.trigger("focus"); return this; },
        blur: function () { this.$input.trigger("blur"); return this; },
        select: function () { this.$input.trigger("select"); return this; },
        reset: function () { return this.option("value", ""); },
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
                case "value": {
                    var strVal = value == null ? "" : String(value);
                    if (this.$input.val() !== strVal) { this.$input.val(strVal); }
                    this._renderClearButton();
                    this.trigger("valueChanged", { value: value, previousValue: prev, component: this, element: this.getNode() });
                    break;
                }

                case "disabled":
                    this.$container.toggleClass("qpx-state-disabled", !!value);
                    this.$input.prop("disabled", !!value);
                    this._renderClearButton();
                    break;

                case "readOnly":
                    this.$container.toggleClass("qpx-state-readonly", !!value);
                    this.$input.prop("readOnly", !!value);
                    this._renderClearButton();
                    break;

                case "visible":
                    this.$container.toggleClass("qpx-hidden", !value);
                    break;

                case "stylingMode":
                    this.$container.removeClass("qpx-textbox-mode-" + prev).addClass("qpx-textbox-mode-" + value);
                    break;

                case "placeholder":
                    this.$input.attr("placeholder", value || "");
                    break;

                case "maxLength":
                    if (value) { this.$input.attr("maxlength", value); } else { this.$input.removeAttr("maxlength"); }
                    break;

                case "mode":
                    this.$input.attr("type", this._htmlType());
                    break;

                case "spellcheck":
                    this.$input.attr("spellcheck", !!value);
                    break;

                case "showClearButton":
                    this._renderClearButton();
                    break;
            }

            this.trigger("optionChanged", { name: name, value: value, previousValue: prev, component: this });
            return this;
        },

        destroy: function () {
            this.$container.off(".qpxTextBox");
            if (this.$input) { this.$input.off(".qpxTextBox"); }
            this._super();
        }
    });

    qpx.registerWidget("qpTextBox", TextBox);
    qpx.qpTextBox = TextBox;

})(window.qpx, jQuery);

/*!
 * qpx - qpColorPicker
 * Výběr barvy, koncepčně i vzhledově co nejblíže DevExtreme dxColorBox
 * (pole se vzorkem barvy + textem, popup s HSV gradientem, hue/alpha
 * posuvníky, instantní i "useButtons" potvrzování), rozšířený o styl
 * Kendo UI ColorPicker / Google Sheets — místo gradientu (nebo spolu
 * s ním) lze zobrazit mřížku předdefinovaných barev ("paletu") s
 * odkazem "Vlastní barva…" pro přepnutí na plný gradient editor.
 *
 * options:
 *   value (string: "#rrggbb" / "#rrggbbaa" / "rgb(...)" / "rgba(...)"),
 *   mode ("palette"|"gradient"|"both"), editAlpha,
 *   palette (pole hex barev nebo pole řádků polí), paletteColumns,
 *   allowCustomColor, showPaletteTooltips,
 *   applyValueMode ("instantly"|"useButtons"), cancelText, applyText,
 *   placeholder, showClearButton, clearButtonText,
 *   stylingMode ("outlined"|"filled"|"underlined"),
 *   disabled, readOnly, visible, dropDownOptions
 *
 * events:
 *   onInitialized, onContentReady, onValueChanged,
 *   onOpened, onClosed, onOptionChanged, onDisposing
 *
 * methods:
 *   option(name[, value]), value([val]), open(), close(),
 *   reset(), focus(), enable(), disable(), destroy()
 */
(function (qpx, $) {
    "use strict";

    var openInstance = null; // aktuálně otevřená instance (jen jedna najednou)

    // =====================================================================
    // Barevné utility (bez závislosti na externí knihovně)
    // =====================================================================
    function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

    function toHex2(n) {
        var h = clamp(Math.round(n), 0, 255).toString(16);
        return h.length === 1 ? "0" + h : h;
    }

    function rgbToHex(r, g, b) {
        return "#" + toHex2(r) + toHex2(g) + toHex2(b);
    }

    // vrací {r,g,b,a} (a v rozsahu 0..1), nebo null pokud řetězec nejde rozpoznat
    function parseColor(str) {
        if (!str || typeof str !== "string") { return null; }
        var s = str.trim();
        var m;

        if ((m = /^#([0-9a-f]{3})$/i.exec(s))) {
            var h3 = m[1];
            return { r: parseInt(h3[0] + h3[0], 16), g: parseInt(h3[1] + h3[1], 16), b: parseInt(h3[2] + h3[2], 16), a: 1 };
        }
        if ((m = /^#([0-9a-f]{4})$/i.exec(s))) {
            var h4 = m[1];
            return { r: parseInt(h4[0] + h4[0], 16), g: parseInt(h4[1] + h4[1], 16), b: parseInt(h4[2] + h4[2], 16), a: parseInt(h4[3] + h4[3], 16) / 255 };
        }
        if ((m = /^#([0-9a-f]{6})$/i.exec(s))) {
            var h6 = m[1];
            return { r: parseInt(h6.substr(0, 2), 16), g: parseInt(h6.substr(2, 2), 16), b: parseInt(h6.substr(4, 2), 16), a: 1 };
        }
        if ((m = /^#([0-9a-f]{8})$/i.exec(s))) {
            var h8 = m[1];
            return { r: parseInt(h8.substr(0, 2), 16), g: parseInt(h8.substr(2, 2), 16), b: parseInt(h8.substr(4, 2), 16), a: parseInt(h8.substr(6, 2), 16) / 255 };
        }
        if ((m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(s))) {
            return { r: +m[1], g: +m[2], b: +m[3], a: (m[4] !== undefined ? +m[4] : 1) };
        }
        return null;
    }

    function rgbToHsv(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        var max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
        var h = 0;
        if (d !== 0) {
            if (max === r) { h = 60 * (((g - b) / d) % 6); }
            else if (max === g) { h = 60 * ((b - r) / d + 2); }
            else { h = 60 * ((r - g) / d + 4); }
        }
        if (h < 0) { h += 360; }
        var s = max === 0 ? 0 : d / max;
        return { h: h, s: s * 100, v: max * 100 };
    }

    function hsvToRgb(h, s, v) {
        s /= 100; v /= 100;
        var c = v * s;
        var x = c * (1 - Math.abs((h / 60) % 2 - 1));
        var m = v - c;
        var r, g, b;
        if (h < 60) { r = c; g = x; b = 0; }
        else if (h < 120) { r = x; g = c; b = 0; }
        else if (h < 180) { r = 0; g = c; b = x; }
        else if (h < 240) { r = 0; g = x; b = c; }
        else if (h < 300) { r = x; g = 0; b = c; }
        else { r = c; g = 0; b = x; }
        return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
    }

    // Výchozí paleta — inspirováno Google Sheets / Kendo "basic" paletou:
    // řádek stupňů šedi + řádek plných barev + dva řádky odstínů.
    var DEFAULT_PALETTE = [
        "#000000", "#434343", "#666666", "#999999", "#b7b7b7", "#cccccc", "#d9d9d9", "#efefef", "#f3f3f3", "#ffffff",
        "#980000", "#ff0000", "#ff9900", "#ffff00", "#00ff00", "#00ffff", "#4a86e8", "#0000ff", "#9900ff", "#ff00ff",
        "#e6b8af", "#f4cccc", "#fce5cd", "#fff2cc", "#d9ead3", "#d0e0e3", "#c9daf8", "#cfe2f3", "#d9d2e9", "#ead1dc",
        "#a61c00", "#cc0000", "#e69138", "#f1c232", "#6aa84f", "#45818e", "#3c78d8", "#3d85c6", "#674ea7", "#a64d79"
    ];

    // =====================================================================
    var ColorPicker = qpx.Widget.extend({

        defaults: {
            value: "#337ab7",

            mode: "both",          // "palette" | "gradient" | "both"
            editAlpha: false,

            palette: null,          // null = DEFAULT_PALETTE; nebo vlastní pole hex barev
            paletteColumns: 10,
            allowCustomColor: true, // v režimu "both" nabídne odkaz "Vlastní barva…" pro přepnutí na gradient
            showPaletteTooltips: true,

            applyValueMode: "instantly", // instantly | useButtons
            cancelText: "Zrušit",
            applyText: "Použít",

            placeholder: "Vyberte barvu...",
            showClearButton: false,
            clearButtonText: "Bez barvy",

            stylingMode: "outlined", // outlined | filled | underlined

            disabled: false,
            readOnly: false,
            visible: true,

            dropDownOptions: {}, // { width }

            onValueChanged: null,
            onOpened: null,
            onClosed: null,
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
                .addClass("qpx-colorpicker")
                .addClass("qpx-colorpicker-mode-" + cfg.stylingMode)
                .toggleClass("qpx-hidden", !cfg.visible)
                .toggleClass("qpx-state-disabled", !!cfg.disabled)
                .toggleClass("qpx-state-readonly", !!cfg.readOnly)
                .attr("role", "button")
                .attr("aria-expanded", "false");

            if (cfg.onInitialized) { this.on("ready", cfg.onInitialized); }
            if (cfg.onContentReady) { this.on("contentReady", cfg.onContentReady); }
            if (cfg.onValueChanged) { this.on("valueChanged", cfg.onValueChanged); }
            if (cfg.onOpened) { this.on("opened", cfg.onOpened); }
            if (cfg.onClosed) { this.on("closed", cfg.onClosed); }
            if (cfg.onOptionChanged) { this.on("optionChanged", cfg.onOptionChanged); }
            if (cfg.onDisposing) { this.on("destroy", cfg.onDisposing); }

            this._isOpen = false;
            // aktuální zobrazení uvnitř popupu; v režimu "both" se dá přepínat
            this._view = (cfg.mode === "gradient") ? "gradient" : "palette";
            this._hsv = { h: 0, s: 0, v: 100 };
            this._alpha = 1;
            this._isDragging = false;

            this._buildDom();
            this._bindEvents();

            setTimeout(function () { self.trigger("contentReady", { component: self }); }, 0);
        },

        // ---------------------------------------------------------------
        // DOM — pole v řádku stránky
        // ---------------------------------------------------------------
        _buildDom: function () {
            var cfg = this.config;
            this.$container.empty();

            this.$swatch = $("<span class='qpx-colorpicker-swatch'></span>");
            this.$input = $("<input type='text' class='qpx-colorpicker-input' autocomplete='off'>")
                .prop("disabled", !!cfg.disabled)
                .prop("readOnly", !!cfg.readOnly);

            this.$clearBtn = $("<span class='qpx-colorpicker-clear' tabindex='-1' title='" + cfg.clearButtonText + "'>✕</span>").hide();
            this.$arrow = $("<span class='qpx-colorpicker-arrow'>▾</span>");

            this.$container.append(this.$swatch, this.$input, this.$clearBtn, this.$arrow);

            this.$dropdown = $("<div class='qpx-popup-surface qpx-colorpicker-popup'></div>").appendTo(document.body).hide();
            if (cfg.dropDownOptions && cfg.dropDownOptions.width) { this.$dropdown.css("width", qpx.toPx(cfg.dropDownOptions.width)); }

            this._renderField();
        },

        _bindEvents: function () {
            var self = this;
            var cfg = this.config;

            this.$container.on("click.qpxColorPicker", function (e) {
                if (cfg.disabled || cfg.readOnly) { return; }
                if ($(e.target).closest(".qpx-colorpicker-clear").length) { return; }
                if (self._isOpen) { self.close(); } else { self.open(); }
            });

            this.$input.on("keydown.qpxColorPicker", function (e) {
                if (cfg.disabled || cfg.readOnly) { return; }
                if (e.key === "Enter") {
                    self._commitTypedValue();
                } else if (e.key === "Escape") {
                    self.close();
                }
            });

            this.$input.on("blur.qpxColorPicker", function () { self._commitTypedValue(); });

            this.$clearBtn.on("click.qpxColorPicker", function (e) {
                e.stopPropagation();
                if (cfg.disabled || cfg.readOnly) { return; }
                self.option("value", null);
            });

            $(document).on("mousedown.qpxColorPicker" + this.id, function (e) {
                if (!self._isOpen || self._isDragging) { return; }
                if ($(e.target).closest(self.$dropdown).length || $(e.target).closest(self.$container).length) { return; }
                self.close();
            });

            $(document).on("keydown.qpxColorPicker" + this.id, function (e) {
                if (self._isOpen && e.key === "Escape") { self.close(); }
            });
        },

        _commitTypedValue: function () {
            var text = this.$input.val();
            if (!text) {
                if (this.config.value !== null) { this.option("value", null); }
                return;
            }
            var rgba = parseColor(text);
            if (rgba) {
                this.option("value", this._formatColor(rgba));
            } else {
                this._renderField(); // neplatný vstup -> vrátit poslední platnou hodnotu
            }
        },

        // ---------------------------------------------------------------
        _renderField: function () {
            var cfg = this.config;
            var rgba = parseColor(cfg.value);

            this.$input.val(cfg.value || "").attr("placeholder", cfg.placeholder);
            this.$clearBtn.toggle(!!cfg.showClearButton && !!cfg.value && !cfg.disabled && !cfg.readOnly);

            this.$swatch.toggleClass("qpx-colorpicker-swatch-empty", !rgba);
            if (rgba) {
                this.$swatch.css("background-color", "rgba(" + Math.round(rgba.r) + "," + Math.round(rgba.g) + "," + Math.round(rgba.b) + "," + rgba.a + ")");
            } else {
                this.$swatch.css("background-color", "");
            }
        },

        _formatColor: function (rgba) {
            var cfg = this.config;
            if (cfg.editAlpha && rgba.a < 1) {
                return "rgba(" + Math.round(rgba.r) + ", " + Math.round(rgba.g) + ", " + Math.round(rgba.b) + ", " + (Math.round(rgba.a * 100) / 100) + ")";
            }
            return rgbToHex(rgba.r, rgba.g, rgba.b);
        },

        // ---------------------------------------------------------------
        // Popup — vykreslení podle aktuálního view (palette / gradient)
        // ---------------------------------------------------------------
        _renderPopup: function () {
            this.$dropdown.empty();
            if (this._view === "gradient") {
                this._renderGradientView();
            } else {
                this._renderPaletteView();
            }

            if (this.config.applyValueMode === "useButtons") {
                this._renderFooter();
            }
        },

        // -- paleta (Kendo ColorPicker / Google Sheets styl) -------------
        _renderPaletteView: function () {
            var self = this;
            var cfg = this.config;
            var palette = (cfg.palette && cfg.palette.length) ? cfg.palette : DEFAULT_PALETTE;
            var currentRgba = parseColor(cfg.value);
            var currentHex = currentRgba ? rgbToHex(currentRgba.r, currentRgba.g, currentRgba.b).toLowerCase() : null;

            var $view = $("<div class='qpx-colorpicker-palette-view'></div>");
            var $grid = $("<div class='qpx-colorpicker-palette-grid'></div>")
                .css("grid-template-columns", "repeat(" + (cfg.paletteColumns || 10) + ", 1fr)");

            if (cfg.showClearButton) {
                var $noneCell = $("<div class='qpx-colorpicker-swatch-cell qpx-colorpicker-swatch-none' title='" + cfg.clearButtonText + "'></div>");
                $noneCell.on("click.qpxColorPicker", function () { self._chooseColor(null); });
                $grid.append($noneCell);
            }

            palette.forEach(function (color) {
                var isSelected = currentHex && color.toLowerCase() === currentHex;
                var $cell = $("<div class='qpx-colorpicker-swatch-cell'></div>")
                    .css("background-color", color)
                    .toggleClass("qpx-state-selected", !!isSelected);

                if (cfg.showPaletteTooltips) { $cell.attr("title", color); }

                $cell.on("click.qpxColorPicker", function () { self._chooseColor(color); });
                $grid.append($cell);
            });

            $view.append($grid);

            if (cfg.mode === "both" && cfg.allowCustomColor) {
                var $customLink = $("<a href='#' class='qpx-colorpicker-custom-link'></a>").text("Vlastní barva…");
                $customLink.on("click.qpxColorPicker", function (e) {
                    e.preventDefault();
                    self._view = "gradient";
                    self._syncHsvFromValue();
                    self._renderPopup();
                    self._positionPopup();
                });
                $view.append($customLink);
            }

            this.$dropdown.append($view);
        },

        // -- gradient (HSV) editor — styl DevExtreme dxColorBox ----------
        _renderGradientView: function () {
            var self = this;
            var cfg = this.config;
            var $view = $("<div class='qpx-colorpicker-gradient-view'></div>");

            if (cfg.mode === "both") {
                var $backLink = $("<a href='#' class='qpx-colorpicker-back-link'></a>").text("← Paleta barev");
                $backLink.on("click.qpxColorPicker", function (e) {
                    e.preventDefault();
                    self._view = "palette";
                    self._renderPopup();
                    self._positionPopup();
                });
                $view.append($backLink);
            }

            this.$svArea = $("<div class='qpx-colorpicker-sv-area'></div>");
            this.$svThumb = $("<span class='qpx-colorpicker-sv-thumb'></span>");
            this.$svArea.append(this.$svThumb);

            this.$hueSlider = $("<div class='qpx-colorpicker-hue-slider'></div>");
            this.$hueThumb = $("<span class='qpx-colorpicker-hue-thumb'></span>");
            this.$hueSlider.append(this.$hueThumb);

            $view.append(this.$svArea, this.$hueSlider);

            if (cfg.editAlpha) {
                this.$alphaSlider = $("<div class='qpx-colorpicker-alpha-slider'></div>");
                this.$alphaGradient = $("<div class='qpx-colorpicker-alpha-gradient'></div>");
                this.$alphaThumb = $("<span class='qpx-colorpicker-alpha-thumb'></span>");
                this.$alphaSlider.append(this.$alphaGradient, this.$alphaThumb);
                $view.append(this.$alphaSlider);
            }

            var $previewRow = $("<div class='qpx-colorpicker-preview-row'></div>");
            this.$preview = $("<span class='qpx-colorpicker-preview-swatch'></span>");
            this.$hexInput = $("<input type='text' class='qpx-colorpicker-hex-input' autocomplete='off'>");
            $previewRow.append(this.$preview, this.$hexInput);
            $view.append($previewRow);

            this.$dropdown.append($view);

            this._bindGradientDrag();
            this._updateGradientUi(true);

            this.$hexInput.on("keydown.qpxColorPicker", function (e) {
                if (e.key === "Enter") { self._applyHexInput(); }
            });
            this.$hexInput.on("blur.qpxColorPicker", function () { self._applyHexInput(); });
        },

        _applyHexInput: function () {
            var rgba = parseColor(this.$hexInput.val());
            if (!rgba) { this._updateGradientUi(true); return; }
            var hsv = rgbToHsv(rgba.r, rgba.g, rgba.b);
            this._hsv = hsv;
            this._alpha = (this.config.editAlpha) ? rgba.a : 1;
            this._updateGradientUi(false);
            this._handleColorEdited();
        },

        _renderFooter: function () {
            var self = this;
            var cfg = this.config;
            var $footer = $("<div class='qpx-colorpicker-footer'></div>");
            var $cancel = $("<button type='button' class='qpx-colorpicker-btn qpx-colorpicker-btn-cancel'></button>").text(cfg.cancelText);
            var $apply = $("<button type='button' class='qpx-colorpicker-btn qpx-colorpicker-btn-apply'></button>").text(cfg.applyText);

            $cancel.on("click.qpxColorPicker", function () { self.close(); });
            $apply.on("click.qpxColorPicker", function () {
                if (self._pendingColor !== undefined) {
                    self.option("value", self._pendingColor);
                } else if (self._view === "gradient") {
                    self._commitGradientValue();
                }
                self.close();
            });

            $footer.append($cancel, $apply);
            this.$dropdown.append($footer);
        },

        // ---------------------------------------------------------------
        // Interakce — paleta
        // ---------------------------------------------------------------
        _chooseColor: function (color) {
            if (this.config.applyValueMode === "useButtons") {
                this._pendingColor = color;
                this.$dropdown.find(".qpx-colorpicker-swatch-cell").removeClass("qpx-state-selected");
                this.$dropdown.find(".qpx-colorpicker-swatch-cell").filter(function () {
                    return $(this).css("background-color") && color && $(this).attr("title") === color;
                }).addClass("qpx-state-selected");
            } else {
                this.option("value", color);
                this.close();
            }
        },

        // ---------------------------------------------------------------
        // Interakce — gradient / hue / alpha (drag)
        // ---------------------------------------------------------------
        _syncHsvFromValue: function () {
            var rgba = parseColor(this.config.value);
            if (rgba) {
                this._hsv = rgbToHsv(rgba.r, rgba.g, rgba.b);
                this._alpha = this.config.editAlpha ? rgba.a : 1;
            } else {
                this._hsv = { h: 0, s: 0, v: 100 };
                this._alpha = 1;
            }
        },

        _bindGradientDrag: function () {
            var self = this;

            function bindDrag($el, handler) {
                $el.on("mousedown.qpxColorPicker touchstart.qpxColorPicker", function (e) {
                    e.preventDefault();
                    self._isDragging = true;
                    handler(e);

                    var move = function (ev) { handler(ev); };
                    var up = function () {
                        self._isDragging = false;
                        $(document).off("mousemove.qpxColorPickerDrag touchmove.qpxColorPickerDrag", move);
                        $(document).off("mouseup.qpxColorPickerDrag touchend.qpxColorPickerDrag", up);
                        self._handleColorEdited();
                    };
                    $(document).on("mousemove.qpxColorPickerDrag touchmove.qpxColorPickerDrag", move);
                    $(document).on("mouseup.qpxColorPickerDrag touchend.qpxColorPickerDrag", up);
                });
            }

            bindDrag(this.$svArea, function (e) {
                var off = self.$svArea.offset();
                var w = self.$svArea.outerWidth(), h = self.$svArea.outerHeight();
                var pageX = e.pageX !== undefined ? e.pageX : (e.originalEvent.touches && e.originalEvent.touches[0].pageX);
                var pageY = e.pageY !== undefined ? e.pageY : (e.originalEvent.touches && e.originalEvent.touches[0].pageY);
                var x = clamp(pageX - off.left, 0, w);
                var y = clamp(pageY - off.top, 0, h);
                self._hsv.s = (x / w) * 100;
                self._hsv.v = 100 - (y / h) * 100;
                self._updateGradientUi(false);
                self._liveUpdate();
            });

            bindDrag(this.$hueSlider, function (e) {
                var off = self.$hueSlider.offset();
                var w = self.$hueSlider.outerWidth();
                var pageX = e.pageX !== undefined ? e.pageX : (e.originalEvent.touches && e.originalEvent.touches[0].pageX);
                var x = clamp(pageX - off.left, 0, w);
                self._hsv.h = (x / w) * 360;
                self._updateGradientUi(false);
                self._liveUpdate();
            });

            if (this.$alphaSlider) {
                bindDrag(this.$alphaSlider, function (e) {
                    var off = self.$alphaSlider.offset();
                    var w = self.$alphaSlider.outerWidth();
                    var pageX = e.pageX !== undefined ? e.pageX : (e.originalEvent.touches && e.originalEvent.touches[0].pageX);
                    var x = clamp(pageX - off.left, 0, w);
                    self._alpha = x / w;
                    self._updateGradientUi(false);
                    self._liveUpdate();
                });
            }
        },

        // živý náhled během tažení; commit do value probíhá dle applyValueMode
        _liveUpdate: function () {
            if (this.config.applyValueMode === "instantly") {
                this._commitGradientValue();
            }
        },

        _handleColorEdited: function () {
            if (this.config.applyValueMode === "instantly") {
                this._commitGradientValue();
            }
        },

        _commitGradientValue: function () {
            var rgb = hsvToRgb(this._hsv.h, this._hsv.s, this._hsv.v);
            var color = this._formatColor({ r: rgb.r, g: rgb.g, b: rgb.b, a: this._alpha });
            this._pendingColor = color;
            this.option("value", color);
        },

        _updateGradientUi: function (fromValue) {
            if (fromValue) { this._syncHsvFromValue(); }

            var rgb = hsvToRgb(this._hsv.h, this._hsv.s, 100);
            var hueColor = "rgb(" + Math.round(rgb.r) + "," + Math.round(rgb.g) + "," + Math.round(rgb.b) + ")";

            this.$svArea.css({
                "background-color": hueColor,
                "background-image":
                    "linear-gradient(to top, #000, rgba(0,0,0,0)), " +
                    "linear-gradient(to right, #fff, rgba(255,255,255,0))"
            });
            this.$svThumb.css({ left: this._hsv.s + "%", top: (100 - this._hsv.v) + "%" });
            this.$hueThumb.css("left", (this._hsv.h / 360 * 100) + "%");

            var current = hsvToRgb(this._hsv.h, this._hsv.s, this._hsv.v);
            var solidHex = rgbToHex(current.r, current.g, current.b);

            if (this.$alphaSlider) {
                this.$alphaGradient.css("background-image", "linear-gradient(to right, rgba(" + Math.round(current.r) + "," + Math.round(current.g) + "," + Math.round(current.b) + ",0), " + solidHex + ")");
                this.$alphaThumb.css("left", (this._alpha * 100) + "%");
            }

            this.$preview.css("background-color", "rgba(" + Math.round(current.r) + "," + Math.round(current.g) + "," + Math.round(current.b) + "," + this._alpha + ")");

            if (this.$hexInput && !this.$hexInput.is(":focus")) {
                this.$hexInput.val(this._formatColor({ r: current.r, g: current.g, b: current.b, a: this._alpha }));
            }
        },

        // ---------------------------------------------------------------
        // Popup otevřít/zavřít
        // ---------------------------------------------------------------
        _positionPopup: function () {
            var off = this.$container.offset();
            this.$dropdown.css({
                top: off.top + this.$container.outerHeight(),
                left: off.left
            });
        },

        open: function () {
            if (this.config.disabled || this.config.readOnly || this._isOpen) { return this; }
            if (openInstance && openInstance !== this) { openInstance.close(); }

            this._pendingColor = undefined;
            this._view = (this.config.mode === "gradient") ? "gradient" : ((this.config.mode === "palette") ? "palette" : this._view);
            this._renderPopup();

            this._positionPopup();
            this.$dropdown.show();

            this._isOpen = true;
            this.$container.attr("aria-expanded", "true");
            openInstance = this;
            this.trigger("opened", { component: this });
            return this;
        },

        close: function () {
            if (!this._isOpen) { return this; }
            this.$dropdown.hide().empty();
            this._isOpen = false;
            this.$container.attr("aria-expanded", "false");
            if (openInstance === this) { openInstance = null; }
            this._renderField();
            this.trigger("closed", { component: this });
            return this;
        },

        // ---------------------------------------------------------------
        // Veřejné API
        // ---------------------------------------------------------------
        value: function (val) {
            if (arguments.length === 0) { return this.config.value; }
            return this.option("value", val);
        },

        reset: function () { return this.option("value", null); },
        focus: function () { this.$input.trigger("focus"); return this; },
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
                case "value":
                    this._renderField();
                    this.trigger("valueChanged", { value: value, previousValue: prev, component: this, element: this.getNode() });
                    break;

                case "disabled":
                    this.$container.toggleClass("qpx-state-disabled", !!value);
                    this.$input.prop("disabled", !!value);
                    if (value) { this.close(); }
                    this._renderField();
                    break;

                case "readOnly":
                    this.$container.toggleClass("qpx-state-readonly", !!value);
                    this.$input.prop("readOnly", !!value);
                    if (value) { this.close(); }
                    break;

                case "visible":
                    this.$container.toggleClass("qpx-hidden", !value);
                    break;

                case "stylingMode":
                    this.$container.removeClass("qpx-colorpicker-mode-" + prev).addClass("qpx-colorpicker-mode-" + value);
                    break;

                case "placeholder":
                case "showClearButton":
                    this._renderField();
                    break;

                case "mode":
                    this._view = (value === "gradient") ? "gradient" : "palette";
                    if (this._isOpen) { this._renderPopup(); this._positionPopup(); }
                    break;

                case "palette":
                case "paletteColumns":
                case "allowCustomColor":
                case "showPaletteTooltips":
                case "editAlpha":
                case "applyValueMode":
                case "cancelText":
                case "applyText":
                    if (this._isOpen) { this._renderPopup(); this._positionPopup(); }
                    break;
            }

            this.trigger("optionChanged", { name: name, value: value, previousValue: prev, component: this });
            return this;
        },

        destroy: function () {
            this.$container.off(".qpxColorPicker");
            if (this.$input) { this.$input.off(".qpxColorPicker"); }
            $(document).off(".qpxColorPicker" + this.id);
            $(document).off(".qpxColorPickerDrag");
            if (this.$dropdown) { this.$dropdown.remove(); }
            if (openInstance === this) { openInstance = null; }
            this._super();
        }
    });

    qpx.registerWidget("qpColorPicker", ColorPicker);
    qpx.qpColorPicker = ColorPicker;

})(window.qpx, jQuery);

/*!
 * qpx - qpDatePicker
 * Funkčností, options/events/methods co nejblíže jQWidgets jqxDateTimeInput:
 *   - pole je SEGMENTOVANÉ (maska rozpadlá na den/měsíc/rok/hodinu/minutu/
 *     sekundu podle formatString), segmenty se ovládají klikem, šipkami
 *     ←/→ (přepnutí segmentu), ↑/↓ (inkrement/dekrement jednotky) a přímým
 *     psaním číslic — přesně jak to dělá jqxDateTimeInput,
 *   - volitelné "spin" šipky vedle pole (showSpinButtons, jqx: spinButtons),
 *   - min/max, showCalendarButton, firstDayOfWeek — vše po vzoru jqx.
 * Vzhledem (pole i rozbalovací kalendář) se co nejvíc přibližuje
 * DevExtreme dxDateBox v tématech light / dark (stejné
 * CSS proměnné --qpx-* a mixiny jako ostatní qpx widgety).
 *
 * options:
 *   value (Date|null), formatString ("dd.MM.yyyy", "dd.MM.yyyy HH:mm", "HH:mm:ss"...),
 *   min, max, placeholder, showCalendarButton, showSpinButtons, spinButtonsStep,
 *   showClearButton, firstDayOfWeek, weekDayNames, monthNames,
 *   applyValueMode ("instantly"|"useButtons"), todayText, clearText, cancelText, applyText,
 *   stylingMode ("outlined"|"filled"|"underlined"), disabled, readOnly, visible,
 *   dropDownOptions
 *
 * events:
 *   onInitialized, onContentReady, onValueChanged,
 *   onOpened, onClosed, onOptionChanged, onDisposing
 *
 * methods:
 *   option(name[, value]), value([val]), val([val]) — alias dle jqx .val(),
 *   getDate() / setDate(date) — pohodlné aliasy,
 *   open(), close(), reset(), clear() — alias reset(),
 *   focus(), enable(), disable(), destroy()
 */
(function (qpx, $) {
    "use strict";

    var openInstance = null; // aktuálně otevřená instance (jen jedna najednou)

    // =====================================================================
    // Pomocné funkce pro práci s daty a formátovacími tokeny
    // =====================================================================
    function pad(n, len) {
        var s = String(Math.abs(n));
        while (s.length < len) { s = "0" + s; }
        return (n < 0 ? "-" : "") + s;
    }

    function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }

    // rozloží formatString na pole { type:"literal", value } / { type:"token", token, unit, digits }
    function tokenizeFormat(fmt) {
        var tokens = [];
        var i = 0;
        var special = "yMdHhms";
        while (i < fmt.length) {
            var ch = fmt[i];
            if (special.indexOf(ch) !== -1) {
                var j = i;
                while (j < fmt.length && fmt[j] === ch) { j++; }
                var raw = fmt.substring(i, j);
                tokens.push({
                    type: "token",
                    token: raw,
                    unit: unitOf(ch),
                    digits: (ch === "y") ? (raw.length >= 4 ? 4 : 2) : 2
                });
                i = j;
            } else {
                var k = i;
                while (k < fmt.length && special.indexOf(fmt[k]) === -1) { k++; }
                tokens.push({ type: "literal", value: fmt.substring(i, k) });
                i = k;
            }
        }
        return tokens;
    }

    function unitOf(ch) {
        switch (ch) {
            case "y": return "year";
            case "M": return "month";
            case "d": return "day";
            case "H": case "h": return "hour";
            case "m": return "minute";
            case "s": return "second";
        }
        return null;
    }

    function getUnit(date, unit) {
        switch (unit) {
            case "year": return date.getFullYear();
            case "month": return date.getMonth() + 1;
            case "day": return date.getDate();
            case "hour": return date.getHours();
            case "minute": return date.getMinutes();
            case "second": return date.getSeconds();
        }
        return 0;
    }

    function setUnit(date, unit, val) {
        switch (unit) {
            case "year": date.setFullYear(val); break;
            case "month": date.setMonth(val - 1); break;
            case "day": date.setDate(val); break;
            case "hour": date.setHours(val); break;
            case "minute": date.setMinutes(val); break;
            case "second": date.setSeconds(val); break;
        }
    }

    function unitRange(unit, date) {
        switch (unit) {
            case "year": return [1, 9999];
            case "month": return [1, 12];
            case "day": return [1, daysInMonth(date.getFullYear(), date.getMonth())];
            case "hour": return [0, 23];
            case "minute": return [0, 59];
            case "second": return [0, 59];
        }
        return [0, 0];
    }

    function sameDay(a, b) {
        return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    }

    function clampDate(date, min, max) {
        if (min && date < min) { return new Date(min); }
        if (max && date > max) { return new Date(max); }
        return date;
    }

    // =====================================================================
    var DatePicker = qpx.Widget.extend({

        defaults: {
            value: null,                 // Date | null
            formatString: "dd.MM.yyyy",  // přítomnost H/h/m/s tokenů zapne editor času

            min: null,                   // Date | null
            max: null,                   // Date | null

            placeholder: "",             // jqx: placeHolder (jen pro aria-label, segmenty mají vlastní "ghost" text)
            showCalendarButton: true,
            showSpinButtons: false,      // jqx: spinButtons
            spinButtonsStep: 1,
            showClearButton: true,

            firstDayOfWeek: 1,           // 0 = neděle, 1 = pondělí ... (jqx: firstDayOfWeek)
            weekDayNames: ["Ne", "Po", "Út", "St", "Čt", "Pá", "So"],
            monthNames: ["Leden", "Únor", "Březen", "Duben", "Květen", "Červen", "Červenec", "Srpen", "Září", "Říjen", "Listopad", "Prosinec"],

            applyValueMode: "instantly", // instantly | useButtons
            todayText: "Dnes",
            clearText: "Vymazat",
            cancelText: "Zrušit",
            applyText: "Použít",

            stylingMode: "outlined",     // outlined | filled | underlined

            disabled: false,
            readOnly: false,
            visible: true,

            dropDownOptions: {}, // { width }

            onValueChanged: null,
            onOpened: null,
            onClosed: null,
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
                .addClass("qpx-datepicker")
                .addClass("qpx-datepicker-mode-" + cfg.stylingMode)
                .toggleClass("qpx-hidden", !cfg.visible)
                .toggleClass("qpx-state-disabled", !!cfg.disabled)
                .toggleClass("qpx-state-readonly", !!cfg.readOnly)
                .attr("role", "combobox")
                .attr("aria-expanded", "false");

            if (cfg.placeholder) { this.$container.attr("aria-label", cfg.placeholder); }

            if (cfg.onInitialized) { this.on("ready", cfg.onInitialized); }
            if (cfg.onContentReady) { this.on("contentReady", cfg.onContentReady); }
            if (cfg.onValueChanged) { this.on("valueChanged", cfg.onValueChanged); }
            if (cfg.onOpened) { this.on("opened", cfg.onOpened); }
            if (cfg.onClosed) { this.on("closed", cfg.onClosed); }
            if (cfg.onOptionChanged) { this.on("optionChanged", cfg.onOptionChanged); }
            if (cfg.onDisposing) { this.on("destroy", cfg.onDisposing); }

            this._isOpen = false;
            this._tokens = tokenizeFormat(cfg.formatString);
            this._hasTime = this._tokens.some(function (t) { return t.type === "token" && (t.unit === "hour" || t.unit === "minute" || t.unit === "second"); });
            this._hasDate = this._tokens.some(function (t) { return t.type === "token" && (t.unit === "year" || t.unit === "month" || t.unit === "day"); });

            this._activeSegment = -1; // index do this._segments (jen "token" segmenty)
            this._typeBuffer = "";

            this._buildDom();
            this._bindEvents();

            setTimeout(function () { self.trigger("contentReady", { component: self }); }, 0);
        },

        // ---------------------------------------------------------------
        // DOM — pole (segmentovaná maska + tlačítka)
        // ---------------------------------------------------------------
        _buildDom: function () {
            var cfg = this.config;
            this.$container.empty();

            this.$segmentsWrap = $("<div class='qpx-datepicker-segments' tabindex='0'></div>");
            this._segments = []; // { $el, token }

            this._tokens.forEach(function (t) {
                if (t.type === "literal") {
                    this.$segmentsWrap.append($("<span class='qpx-datepicker-literal'></span>").text(t.value));
                } else {
                    var $seg = $("<span class='qpx-datepicker-segment' data-unit='" + t.unit + "'></span>");
                    this.$segmentsWrap.append($seg);
                    this._segments.push({ $el: $seg, token: t });
                }
            }, this);

            this._segments.forEach(function (seg, idx) { seg.$el.attr("data-index", idx); });

            this.$clearBtn = $("<span class='qpx-datepicker-clear' tabindex='-1' title='" + cfg.clearText + "'>✕</span>").hide();

            this.$spinWrap = $();
            if (cfg.showSpinButtons) {
                this.$spinUp = $("<span class='qpx-datepicker-spin-up' tabindex='-1'>▲</span>");
                this.$spinDown = $("<span class='qpx-datepicker-spin-down' tabindex='-1'>▼</span>");
                this.$spinWrap = $("<span class='qpx-datepicker-spin'></span>").append(this.$spinUp, this.$spinDown);
            }

            this.$calendarBtn = $();
            if (cfg.showCalendarButton) {
                this.$calendarBtn = $("<span class='qpx-datepicker-calendar-btn' tabindex='-1' title='Otevřít kalendář'>📅</span>");
            }

            this.$container.append(this.$segmentsWrap, this.$clearBtn, this.$spinWrap, this.$calendarBtn);

            this.$dropdown = $("<div class='qpx-popup-surface qpx-datepicker-popup'></div>").appendTo(document.body).hide();
            if (cfg.dropDownOptions && cfg.dropDownOptions.width) { this.$dropdown.css("width", qpx.toPx(cfg.dropDownOptions.width)); }

            this._renderField();
        },

        _bindEvents: function () {
            var self = this;
            var cfg = this.config;

            this.$segmentsWrap.on("click.qpxDatePicker", ".qpx-datepicker-segment", function () {
                if (cfg.disabled || cfg.readOnly) { return; }
                self._setActiveSegment(+$(this).attr("data-index"));
            });

            this.$segmentsWrap.on("keydown.qpxDatePicker", function (e) {
                if (cfg.disabled || cfg.readOnly) { return; }
                self._handleFieldKeydown(e);
            });

            this.$segmentsWrap.on("focus.qpxDatePicker", function () {
                if (self._activeSegment === -1 && self._segments.length) { self._setActiveSegment(0); }
            });

            // -- clear / spin / calendar tlačítka ------------------------
            this.$clearBtn.on("click.qpxDatePicker", function (e) {
                e.stopPropagation();
                if (cfg.disabled || cfg.readOnly) { return; }
                self.option("value", null);
            });

            if (cfg.showSpinButtons) {
                this.$spinUp.on("mousedown.qpxDatePicker", function (e) { e.preventDefault(); if (!cfg.disabled && !cfg.readOnly) { self._stepActiveSegment(1); } });
                this.$spinDown.on("mousedown.qpxDatePicker", function (e) { e.preventDefault(); if (!cfg.disabled && !cfg.readOnly) { self._stepActiveSegment(-1); } });
            }

            if (cfg.showCalendarButton) {
                this.$calendarBtn.on("click.qpxDatePicker", function (e) {
                    e.stopPropagation();
                    if (cfg.disabled || cfg.readOnly) { return; }
                    if (self._isOpen) { self.close(); } else { self.open(); }
                });
            }

            $(document).on("mousedown.qpxDatePicker" + this.id, function (e) {
                if (!self._isOpen) { return; }
                if ($(e.target).closest(self.$dropdown).length || $(e.target).closest(self.$container).length) { return; }
                self._discardPendingAndClose();
            });

            $(document).on("keydown.qpxDatePicker" + this.id, function (e) {
                if (self._isOpen && e.key === "Escape") { self._discardPendingAndClose(); }
            });
        },

        // ---------------------------------------------------------------
        // Vykreslení pole podle aktuální hodnoty
        // ---------------------------------------------------------------
        _renderField: function () {
            var cfg = this.config;
            var date = cfg.value;

            this._segments.forEach(function (seg) {
                if (date) {
                    var val = getUnit(date, seg.token.unit);
                    seg.$el.text(pad(val, seg.token.digits)).removeClass("qpx-state-placeholder");
                } else {
                    seg.$el.text(seg.token.token.toLowerCase()).addClass("qpx-state-placeholder");
                }
            });

            this.$clearBtn.toggle(!!cfg.showClearButton && !!date && !cfg.disabled && !cfg.readOnly);
        },

        // ---------------------------------------------------------------
        // Segmentová editace v poli (klávesnice)
        // ---------------------------------------------------------------
        _setActiveSegment: function (idx) {
            if (idx < 0 || idx >= this._segments.length) { return; }
            this._segments.forEach(function (s) { s.$el.removeClass("qpx-state-active"); });
            this._activeSegment = idx;
            this._typeBuffer = "";
            this._segments[idx].$el.addClass("qpx-state-active");
            this.$segmentsWrap.trigger("focus");
        },

        _handleFieldKeydown: function (e) {
            if (this._activeSegment === -1 && this._segments.length) { this._setActiveSegment(0); }
            if (this._activeSegment === -1) { return; }

            switch (e.key) {
                case "ArrowLeft":
                    e.preventDefault();
                    this._setActiveSegment(Math.max(0, this._activeSegment - 1));
                    break;
                case "ArrowRight":
                    e.preventDefault();
                    this._setActiveSegment(Math.min(this._segments.length - 1, this._activeSegment + 1));
                    break;
                case "ArrowUp":
                    e.preventDefault();
                    this._stepActiveSegment(1);
                    break;
                case "ArrowDown":
                    e.preventDefault();
                    this._stepActiveSegment(-1);
                    break;
                case "Backspace":
                case "Delete":
                    e.preventDefault();
                    this.option("value", null);
                    this._typeBuffer = "";
                    break;
                default:
                    if (/^[0-9]$/.test(e.key)) {
                        e.preventDefault();
                        this._typeDigit(e.key);
                    }
            }
        },

        _stepActiveSegment: function (dir) {
            var cfg = this.config;
            var seg = this._segments[this._activeSegment];
            if (!seg) { return; }

            var base = cfg.value ? new Date(cfg.value) : this._defaultBaseDate();
            var range = unitRange(seg.token.unit, base);
            var cur = cfg.value ? getUnit(base, seg.token.unit) : range[0];
            var next = cur + dir * cfg.spinButtonsStep;

            if (next < range[0]) { next = range[1]; }
            if (next > range[1]) { next = range[0]; }

            setUnit(base, seg.token.unit, next);
            this.option("value", clampDate(base, cfg.min, cfg.max));
        },

        _typeDigit: function (digit) {
            var seg = this._segments[this._activeSegment];
            if (!seg) { return; }

            this._typeBuffer += digit;
            var maxDigits = seg.token.digits;
            var base = this.config.value ? new Date(this.config.value) : this._defaultBaseDate();
            var range = unitRange(seg.token.unit, base);
            var numVal = parseInt(this._typeBuffer, 10);

            var willOverflow = (this._typeBuffer.length === 1) && (numVal * 10 > range[1]) && maxDigits === 2;

            if (this._typeBuffer.length >= maxDigits || willOverflow) {
                var finalVal = Math.min(range[1], Math.max(range[0], numVal || range[0]));
                setUnit(base, seg.token.unit, finalVal);
                this.option("value", clampDate(base, this.config.min, this.config.max));
                this._typeBuffer = "";
                this._setActiveSegment(Math.min(this._segments.length - 1, this._activeSegment + 1));
            } else {
                // zobrazit rozpracovaný vstup bez commitu do config.value
                seg.$el.text(pad(numVal, maxDigits)).removeClass("qpx-state-placeholder");
            }
        },

        _defaultBaseDate: function () {
            var now = new Date();
            now.setHours(0, 0, 0, 0);
            return now;
        },

        // ---------------------------------------------------------------
        // Popup — kalendář (+ volitelně editor času)
        // ---------------------------------------------------------------
        _renderPopup: function () {
            var cfg = this.config;
            this.$dropdown.empty();

            var base = this._pendingDate || cfg.value || this._defaultBaseDate();
            this._viewYear = base.getFullYear();
            this._viewMonth = base.getMonth();

            if (this._hasDate) {
                this.$dropdown.append(this._buildCalendarHeader());
                this.$dropdown.append(this._buildWeekdaysRow());
                this.$calendarDays = $("<div class='qpx-datepicker-days'></div>");
                this.$dropdown.append(this.$calendarDays);
                this._renderDays();
            }

            if (this._hasTime) {
                this.$dropdown.append(this._buildTimeEditor());
            }

            this.$dropdown.append(this._buildFooter());
        },

        _buildCalendarHeader: function () {
            var self = this;
            var cfg = this.config;
            var $header = $("<div class='qpx-datepicker-cal-header'></div>");
            var $prev = $("<span class='qpx-datepicker-nav qpx-datepicker-nav-prev'>‹</span>");
            var $label = $("<span class='qpx-datepicker-cal-label'></span>").text(cfg.monthNames[this._viewMonth] + " " + this._viewYear);
            var $next = $("<span class='qpx-datepicker-nav qpx-datepicker-nav-next'>›</span>");

            $prev.on("click.qpxDatePicker", function () {
                self._viewMonth--;
                if (self._viewMonth < 0) { self._viewMonth = 11; self._viewYear--; }
                self._renderDaysAndHeader();
            });
            $next.on("click.qpxDatePicker", function () {
                self._viewMonth++;
                if (self._viewMonth > 11) { self._viewMonth = 0; self._viewYear++; }
                self._renderDaysAndHeader();
            });

            $header.append($prev, $label, $next);
            this.$calHeaderLabel = $label;
            return $header;
        },

        _renderDaysAndHeader: function () {
            this.$calHeaderLabel.text(this.config.monthNames[this._viewMonth] + " " + this._viewYear);
            this._renderDays();
        },

        _buildWeekdaysRow: function () {
            var cfg = this.config;
            var $row = $("<div class='qpx-datepicker-weekdays'></div>");
            for (var i = 0; i < 7; i++) {
                var idx = (cfg.firstDayOfWeek + i) % 7;
                $row.append($("<span></span>").text(cfg.weekDayNames[idx]));
            }
            return $row;
        },

        _renderDays: function () {
            var self = this;
            var cfg = this.config;
            this.$calendarDays.empty();

            var firstOfMonth = new Date(this._viewYear, this._viewMonth, 1);
            var startOffset = (firstOfMonth.getDay() - cfg.firstDayOfWeek + 7) % 7;
            var gridStart = new Date(this._viewYear, this._viewMonth, 1 - startOffset);

            var today = new Date();
            var pending = this._pendingDate;

            for (var i = 0; i < 42; i++) {
                var cellDate = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
                var isOtherMonth = cellDate.getMonth() !== this._viewMonth;
                var isDisabled = (cfg.min && cellDate < stripTime(cfg.min)) || (cfg.max && cellDate > stripTime(cfg.max));

                var $cell = $("<span class='qpx-datepicker-day'></span>")
                    .text(cellDate.getDate())
                    .toggleClass("qpx-state-dim", isOtherMonth)
                    .toggleClass("qpx-state-today", sameDay(cellDate, today))
                    .toggleClass("qpx-state-selected", !!pending && sameDay(cellDate, pending))
                    .toggleClass("qpx-state-disabled", !!isDisabled);

                if (!isDisabled) {
                    $cell.on("click.qpxDatePicker", (function (d) {
                        return function () { self._chooseDay(d); };
                    })(new Date(cellDate)));
                }

                this.$calendarDays.append($cell);
            }

            function stripTime(d) { var c = new Date(d); c.setHours(0, 0, 0, 0); return c; }
        },

        _chooseDay: function (day) {
            var base = this._pendingDate ? new Date(this._pendingDate) : this._defaultBaseDate();
            base.setFullYear(day.getFullYear(), day.getMonth(), day.getDate());
            this._pendingDate = clampDate(base, this.config.min, this.config.max);

            this._applyPendingIfInstant();
            this._renderDays();

            // bez editoru času lze rovnou zavřít (stejné chování jako dxDateBox pro type:"date")
            if (this.config.applyValueMode === "instantly" && !this._hasTime) { this.close(); }
        },

        // -- editor času (znovupoužívá segmentový koncept z pole) -------
        _buildTimeEditor: function () {
            var self = this;
            var timeTokens = this._tokens.filter(function (t) { return t.type === "token" && (t.unit === "hour" || t.unit === "minute" || t.unit === "second"); });

            var $row = $("<div class='qpx-datepicker-time-row'></div>");
            this._timeSegments = [];

            timeTokens.forEach(function (t, i) {
                if (i > 0) { $row.append($("<span class='qpx-datepicker-literal'></span>").text(":")); }
                var $seg = $("<span class='qpx-datepicker-segment qpx-datepicker-time-segment' data-unit='" + t.unit + "'></span>");
                this._timeSegments.push({ $el: $seg, token: t });
                $row.append($seg);
            }, this);

            var $spin = $("<span class='qpx-datepicker-spin qpx-datepicker-time-spin'></span>");
            var $up = $("<span class='qpx-datepicker-spin-up' tabindex='-1'>▲</span>");
            var $down = $("<span class='qpx-datepicker-spin-down' tabindex='-1'>▼</span>");
            $spin.append($up, $down);
            $row.append($spin);

            this._activeTimeSegment = 0;
            this._renderTimeSegments();

            this._timeSegments.forEach(function (seg, idx) {
                seg.$el.attr("tabindex", "0");
                seg.$el.on("click.qpxDatePicker", function () { self._activeTimeSegment = idx; self._highlightTimeSegment(); });
                seg.$el.on("keydown.qpxDatePicker", function (e) {
                    if (e.key === "ArrowUp") { e.preventDefault(); self._stepTimeSegment(1); }
                    else if (e.key === "ArrowDown") { e.preventDefault(); self._stepTimeSegment(-1); }
                    else if (e.key === "ArrowLeft") { e.preventDefault(); self._activeTimeSegment = Math.max(0, idx - 1); self._highlightTimeSegment(); }
                    else if (e.key === "ArrowRight") { e.preventDefault(); self._activeTimeSegment = Math.min(self._timeSegments.length - 1, idx + 1); self._highlightTimeSegment(); }
                });
            });

            $up.on("mousedown.qpxDatePicker", function (e) { e.preventDefault(); self._stepTimeSegment(1); });
            $down.on("mousedown.qpxDatePicker", function (e) { e.preventDefault(); self._stepTimeSegment(-1); });

            this._highlightTimeSegment();
            return $row;
        },

        _highlightTimeSegment: function () {
            this._timeSegments.forEach(function (s, i) { s.$el.toggleClass("qpx-state-active", i === this._activeTimeSegment); }, this);
        },

        _renderTimeSegments: function () {
            var base = this._pendingDate || this._defaultBaseDate();
            this._timeSegments.forEach(function (seg) {
                seg.$el.text(pad(getUnit(base, seg.token.unit), seg.token.digits));
            });
        },

        _stepTimeSegment: function (dir) {
            var seg = this._timeSegments[this._activeTimeSegment];
            if (!seg) { return; }

            var base = this._pendingDate ? new Date(this._pendingDate) : this._defaultBaseDate();
            var range = unitRange(seg.token.unit, base);
            var next = getUnit(base, seg.token.unit) + dir;
            if (next < range[0]) { next = range[1]; }
            if (next > range[1]) { next = range[0]; }
            setUnit(base, seg.token.unit, next);

            this._pendingDate = clampDate(base, this.config.min, this.config.max);
            this._renderTimeSegments();
            this._highlightTimeSegment();
            this._applyPendingIfInstant();
        },

        _applyPendingIfInstant: function () {
            if (this.config.applyValueMode === "instantly" && this._pendingDate) {
                this.option("value", new Date(this._pendingDate));
            }
        },

        // -- patička popupu -----------------------------------------------
        _buildFooter: function () {
            var self = this;
            var cfg = this.config;
            var $footer = $("<div class='qpx-datepicker-footer'></div>");
            var $left = $("<div class='qpx-datepicker-footer-left'></div>");
            var $right = $("<div class='qpx-datepicker-footer-right'></div>");

            var $today = $("<a href='#' class='qpx-datepicker-link'></a>").text(cfg.todayText);
            $today.on("click.qpxDatePicker", function (e) {
                e.preventDefault();
                var now = new Date();
                if (!self._hasTime) { now.setHours(0, 0, 0, 0); }
                self._pendingDate = clampDate(now, cfg.min, cfg.max);
                self._applyPendingIfInstant();
                self._renderPopup();
                self._positionPopup();
                if (cfg.applyValueMode === "instantly" && !self._hasTime) { self.close(); }
            });

            var $clear = $("<a href='#' class='qpx-datepicker-link'></a>").text(cfg.clearText);
            $clear.on("click.qpxDatePicker", function (e) {
                e.preventDefault();
                self.option("value", null);
                self.close();
            });

            $left.append($today, $clear);

            if (cfg.applyValueMode === "useButtons") {
                var $cancel = $("<button type='button' class='qpx-datepicker-btn qpx-datepicker-btn-cancel'></button>").text(cfg.cancelText);
                var $apply = $("<button type='button' class='qpx-datepicker-btn qpx-datepicker-btn-apply'></button>").text(cfg.applyText);

                $cancel.on("click.qpxDatePicker", function () { self.close(); });
                $apply.on("click.qpxDatePicker", function () {
                    self.option("value", self._pendingDate ? new Date(self._pendingDate) : null);
                    self.close();
                });

                $right.append($cancel, $apply);
            }

            $footer.append($left, $right);
            return $footer;
        },

        // ---------------------------------------------------------------
        // Popup otevřít/zavřít
        // ---------------------------------------------------------------
        _positionPopup: function () {
            var off = this.$container.offset();
            this.$dropdown.css({
                top: off.top + this.$container.outerHeight(),
                left: off.left
            });
        },

        open: function () {
            if (this.config.disabled || this.config.readOnly || this._isOpen) { return this; }
            if (openInstance && openInstance !== this) { openInstance.close(); }

            this._pendingDate = this.config.value ? new Date(this.config.value) : null;
            this._renderPopup();
            this._positionPopup();
            this.$dropdown.show();

            this._isOpen = true;
            this.$container.attr("aria-expanded", "true");
            openInstance = this;
            this.trigger("opened", { component: this });
            return this;
        },

        _discardPendingAndClose: function () {
            this._pendingDate = null;
            this.close();
        },

        close: function () {
            if (!this._isOpen) { return this; }
            this.$dropdown.hide().empty();
            this._isOpen = false;
            this.$container.attr("aria-expanded", "false");
            if (openInstance === this) { openInstance = null; }
            this.trigger("closed", { component: this });
            return this;
        },

        // ---------------------------------------------------------------
        // Veřejné API
        // ---------------------------------------------------------------
        value: function (val) {
            if (arguments.length === 0) { return this.config.value; }
            return this.option("value", val);
        },

        // jqx: .jqxDateTimeInput('val') — getter/setter alias
        val: function (val) { return this.value.apply(this, arguments); },

        getDate: function () { return this.config.value; },
        setDate: function (date) { return this.option("value", date); },

        reset: function () { return this.option("value", null); },
        clear: function () { return this.reset(); }, // jqx-friendly alias

        focus: function () { this.$segmentsWrap.trigger("focus"); return this; },
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
                case "value":
                    value = value ? clampDate(new Date(value), this.config.min, this.config.max) : null;
                    this.config.value = value;
                    this._renderField();
                    this.trigger("valueChanged", { value: value, previousValue: prev, component: this, element: this.getNode() });
                    break;

                case "formatString":
                    this._tokens = tokenizeFormat(value);
                    this._hasTime = this._tokens.some(function (t) { return t.type === "token" && (t.unit === "hour" || t.unit === "minute" || t.unit === "second"); });
                    this._hasDate = this._tokens.some(function (t) { return t.type === "token" && (t.unit === "year" || t.unit === "month" || t.unit === "day"); });
                    this._buildDom();
                    this._bindEvents();
                    break;

                case "disabled":
                    this.$container.toggleClass("qpx-state-disabled", !!value);
                    if (value) { this.close(); }
                    this._renderField();
                    break;

                case "readOnly":
                    this.$container.toggleClass("qpx-state-readonly", !!value);
                    if (value) { this.close(); }
                    break;

                case "visible":
                    this.$container.toggleClass("qpx-hidden", !value);
                    break;

                case "stylingMode":
                    this.$container.removeClass("qpx-datepicker-mode-" + prev).addClass("qpx-datepicker-mode-" + value);
                    break;

                case "showClearButton":
                    this._renderField();
                    break;

                case "min":
                case "max":
                case "firstDayOfWeek":
                case "weekDayNames":
                case "monthNames":
                case "applyValueMode":
                    if (this._isOpen) { this._renderPopup(); this._positionPopup(); }
                    break;
            }

            this.trigger("optionChanged", { name: name, value: value, previousValue: prev, component: this });
            return this;
        },

        destroy: function () {
            this.$container.off(".qpxDatePicker");
            if (this.$segmentsWrap) { this.$segmentsWrap.off(".qpxDatePicker"); }
            $(document).off(".qpxDatePicker" + this.id);
            if (this.$dropdown) { this.$dropdown.remove(); }
            if (openInstance === this) { openInstance = null; }
            this._super();
        }
    });

    qpx.registerWidget("qpDatePicker", DatePicker);
    qpx.qpDatePicker = DatePicker;

})(window.qpx, jQuery);

/*!
 * qpx - qpTagBox
 * Vícenásobný výběr položek zobrazený jako "tagy" v poli, koncepčně
 * i vzhledově co nejblíže DevExtreme dxTagBox (kombinace textového
 * pole s vyhledáváním + rozbalovacího seznamu položek s možností
 * vícenásobného výběru).
 *
 * options:
 *   items / dataSource, valueExpr, displayExpr, value (pole hodnot),
 *   placeholder, searchEnabled, searchTimeout, minSearchLength, noDataText,
 *   multiline, maxDisplayedTags, showMultiTagOnly,
 *   showSelectionControls, hideSelectedItems, acceptCustomValue,
 *   showClearButton, stylingMode ("outlined"|"filled"|"underlined"),
 *   disabled, readOnly, visible, tagTemplate, itemTemplate, dropDownOptions
 *
 * events:
 *   onInitialized, onContentReady, onValueChanged, onSelectionChanged,
 *   onOpened, onClosed, onCustomItemCreating, onOptionChanged, onDisposing
 *
 * methods:
 *   option(name[, value]), value([val]), open(), close(),
 *   getSelectedItems(), getDataSource(), reset(), focus(),
 *   enable(), disable(), destroy()
 */
(function (qpx, $) {
    "use strict";

    var openInstance = null; // aktuálně otevřená instance (jen jedna najednou)

    var TagBox = qpx.Widget.extend({

        defaults: {
            dataSource: null,
            items: [],
            valueExpr: null,      // null = "this" (celá položka je hodnota)
            displayExpr: null,    // null = item.text, nebo JSON.stringify

            value: [],

            placeholder: "Vyberte...",
            searchEnabled: true,
            searchTimeout: 200,
            minSearchLength: 0,
            noDataText: "Žádné položky",

            multiline: true,           // false = jeden řádek se scrollem místo zalamování tagů
            maxDisplayedTags: undefined,
            showMultiTagOnly: false,   // true = místo jednotlivých tagů jen "N vybráno"

            showSelectionControls: false, // "Vybrat vše" / "Zrušit výběr" v popupu
            hideSelectedItems: false,
            acceptCustomValue: false,

            showClearButton: false,
            stylingMode: "outlined",  // outlined | filled | underlined

            disabled: false,
            readOnly: false,
            visible: true,

            tagTemplate: null,   // function(tagData:{value,item}, tagIndex, tagElement)
            itemTemplate: null,  // function(itemData, itemIndex, itemElement)
            dropDownOptions: {}, // { width, maxHeight }

            onValueChanged: null,
            onSelectionChanged: null,
            onOpened: null,
            onClosed: null,
            onCustomItemCreating: null,
            onOptionChanged: null,
            onInitialized: null,
            onContentReady: null,
            onDisposing: null
        },

        // ---------------------------------------------------------------
        render: function () {
            var cfg = this.config;
            var self = this;

            cfg.items = (cfg.items && cfg.items.length) ? cfg.items : (cfg.dataSource || []);
            cfg.value = cfg.value || [];

            this.$container
                .addClass("qpx-tagbox")
                .addClass("qpx-tagbox-mode-" + cfg.stylingMode)
                .toggleClass("qpx-hidden", !cfg.visible)
                .toggleClass("qpx-state-disabled", !!cfg.disabled)
                .toggleClass("qpx-state-readonly", !!cfg.readOnly)
                .attr("role", "combobox")
                .attr("aria-expanded", "false")
                .attr("aria-multiselectable", "true");

            if (cfg.onInitialized) { this.on("ready", cfg.onInitialized); }
            if (cfg.onContentReady) { this.on("contentReady", cfg.onContentReady); }
            if (cfg.onValueChanged) { this.on("valueChanged", cfg.onValueChanged); }
            if (cfg.onSelectionChanged) { this.on("selectionChanged", cfg.onSelectionChanged); }
            if (cfg.onOpened) { this.on("opened", cfg.onOpened); }
            if (cfg.onClosed) { this.on("closed", cfg.onClosed); }
            if (cfg.onOptionChanged) { this.on("optionChanged", cfg.onOptionChanged); }
            if (cfg.onDisposing) { this.on("destroy", cfg.onDisposing); }

            this._isOpen = false;
            this._searchText = "";
            this._highlightIndex = -1;

            this._buildDom();
            this._bindEvents();

            setTimeout(function () { self.trigger("contentReady", { component: self }); }, 0);
        },

        // ---------------------------------------------------------------
        // DOM
        // ---------------------------------------------------------------
        _buildDom: function () {
            var cfg = this.config;
            this.$container.empty();

            this.$field = $("<div class='qpx-tagbox-field'></div>");
            this.$searchInput = $("<input type='text' class='qpx-tagbox-search' autocomplete='off'>")
                .prop("disabled", !!cfg.disabled)
                .prop("readOnly", !!cfg.readOnly || !cfg.searchEnabled);

            this.$clearBtn = $("<span class='qpx-tagbox-clear' tabindex='-1' title='Vymazat výběr'>✕</span>").hide();
            this.$arrow = $("<span class='qpx-tagbox-arrow'>▾</span>");

            this.$container.append(this.$field, this.$clearBtn, this.$arrow);

            this.$dropdown = $("<div class='qpx-popup-list qpx-tagbox-dropdown'></div>").appendTo(document.body).hide();
            this.$list = $("<div class='qpx-tagbox-list'></div>");
            this.$dropdown.append(this.$list);

            if (cfg.dropDownOptions && cfg.dropDownOptions.width) { this.$dropdown.css("width", qpx.toPx(cfg.dropDownOptions.width)); }
            if (cfg.dropDownOptions && cfg.dropDownOptions.maxHeight) { this.$list.css("max-height", qpx.toPx(cfg.dropDownOptions.maxHeight)); }

            this._renderField();
            this._renderDropdownItems();
        },

        _bindEvents: function () {
            var self = this;
            var cfg = this.config;

            this.$container.on("click.qpxTagBox", function (e) {
                if (cfg.disabled) { return; }
                if ($(e.target).closest(".qpx-tagbox-tag-remove, .qpx-tagbox-clear").length) { return; }
                self.$searchInput.trigger("focus");
                if (!cfg.readOnly) { self.open(); }
            });

            this.$searchInput.on("focus.qpxTagBox", function () {
                if (!cfg.disabled && !cfg.readOnly) { self.open(); }
            });

            var searchTimer = null;
            this.$searchInput.on("input.qpxTagBox", function () {
                var val = this.value;
                clearTimeout(searchTimer);
                searchTimer = setTimeout(function () {
                    self._searchText = (val.length >= (cfg.minSearchLength || 0)) ? val : "";
                    self._highlightIndex = -1;
                    self._renderDropdownItems();
                    if (!self._isOpen) { self.open(); }
                }, cfg.searchTimeout);
            });

            this.$searchInput.on("keydown.qpxTagBox", function (e) {
                if (cfg.disabled || cfg.readOnly) { return; }
                var items = self._filteredItems();

                switch (e.key) {
                    case "ArrowDown":
                        e.preventDefault();
                        if (!self._isOpen) { self.open(); }
                        self._highlightIndex = Math.min(items.length - 1, self._highlightIndex + 1);
                        self._renderDropdownItems();
                        break;

                    case "ArrowUp":
                        e.preventDefault();
                        self._highlightIndex = Math.max(0, self._highlightIndex - 1);
                        self._renderDropdownItems();
                        break;

                    case "Enter":
                        e.preventDefault();
                        if (self._highlightIndex > -1 && items[self._highlightIndex]) {
                            self._toggleItem(items[self._highlightIndex]);
                        } else if (cfg.acceptCustomValue && this.value.trim()) {
                            self._handleCustomItemCreating(this.value.trim());
                        }
                        break;

                    case "Escape":
                        e.preventDefault();
                        self.close();
                        break;

                    case "Backspace":
                        if (!this.value && cfg.value.length) {
                            e.preventDefault();
                            self._removeValue(cfg.value[cfg.value.length - 1]);
                        }
                        break;
                }
            });

            this.$arrow.on("click.qpxTagBox", function (e) {
                e.stopPropagation();
                if (cfg.disabled || cfg.readOnly) { return; }
                if (self._isOpen) { self.close(); } else { self.$searchInput.trigger("focus"); self.open(); }
            });

            this.$clearBtn.on("click.qpxTagBox", function (e) {
                e.stopPropagation();
                if (cfg.disabled || cfg.readOnly) { return; }
                self.option("value", []);
            });

            $(document).on("mousedown.qpxTagBox" + this.id, function (e) {
                if (!self._isOpen) { return; }
                if ($(e.target).closest(self.$dropdown).length || $(e.target).closest(self.$container).length) { return; }
                self.close();
            });
        },

        // ---------------------------------------------------------------
        // Vykreslení pole s tagy
        // ---------------------------------------------------------------
        _renderField: function () {
            var self = this;
            var cfg = this.config;
            this.$field.empty();

            var values = cfg.value || [];
            var useMultiTagOnly = cfg.showMultiTagOnly && values.length > 0;
            var limit = (cfg.maxDisplayedTags !== undefined && cfg.maxDisplayedTags !== null) ? cfg.maxDisplayedTags : values.length;

            if (useMultiTagOnly) {
                this._appendSummaryTag(values.length + " vybráno");
            } else {
                values.slice(0, limit).forEach(function (val) { self._appendTag(val); });
                if (values.length > limit) { this._appendSummaryTag("+" + (values.length - limit)); }
            }

            this.$field.toggleClass("qpx-tagbox-field-multiline", !!cfg.multiline);
            this.$searchInput.attr("placeholder", values.length ? "" : cfg.placeholder);
            this.$field.append(this.$searchInput);

            this.$clearBtn.toggle(!!cfg.showClearButton && values.length > 0 && !cfg.disabled && !cfg.readOnly);
        },

        _appendTag: function (val) {
            var self = this;
            var cfg = this.config;
            var item = this._itemForValue(val);
            var $tag = $("<span class='qpx-tagbox-tag'></span>");

            if (qpx.isFunction(cfg.tagTemplate)) {
                var result = cfg.tagTemplate.call(this, { value: val, item: item }, 0, $tag[0]);
                if (result !== undefined && result !== null) { $tag.append(result); }
            } else {
                $tag.append($("<span class='qpx-tagbox-tag-text'></span>").text(item !== undefined ? this._displayOf(item) : String(val)));
                if (!cfg.disabled && !cfg.readOnly) {
                    var $remove = $("<span class='qpx-tagbox-tag-remove' tabindex='-1'>✕</span>");
                    $remove.on("click.qpxTagBox", function (e) { e.stopPropagation(); self._removeValue(val); });
                    $tag.append($remove);
                }
            }

            this.$field.append($tag);
        },

        _appendSummaryTag: function (text) {
            this.$field.append($("<span class='qpx-tagbox-tag qpx-tagbox-tag-summary'></span>").text(text));
        },

        // ---------------------------------------------------------------
        // Rozbalovací seznam položek
        // ---------------------------------------------------------------
        _renderDropdownItems: function () {
            var self = this;
            var cfg = this.config;
            this.$list.empty();

            if (cfg.showSelectionControls) {
                var $ctrl = $("<div class='qpx-tagbox-selection-controls'></div>");
                $ctrl.append(
                    $("<span class='qpx-tagbox-select-all'></span>").text("Vybrat vše")
                        .on("click.qpxTagBox", function (e) { e.stopPropagation(); self._selectAllFiltered(); }),
                    $("<span class='qpx-tagbox-clear-all'></span>").text("Zrušit výběr")
                        .on("click.qpxTagBox", function (e) { e.stopPropagation(); self.option("value", []); })
                );
                this.$list.append($ctrl);
            }

            var items = this._filteredItems();

            if (!items.length) {
                this.$list.append($("<div class='qpx-tagbox-nodata'></div>").text(cfg.noDataText));
                return;
            }

            items.forEach(function (item, idx) {
                var val = self._valueOf(item);
                var selected = self._indexOfValue(val) !== -1;

                var $row = $("<div class='qpx-popup-list-item qpx-tagbox-item'></div>")
                    .toggleClass("qpx-state-selected", selected)
                    .toggleClass("qpx-state-highlighted", idx === self._highlightIndex);

                $row.append($("<span class='qpx-tagbox-item-check'></span>"));

                if (qpx.isFunction(cfg.itemTemplate)) {
                    var res = cfg.itemTemplate.call(self, item, idx, $row[0]);
                    if (res !== undefined && res !== null) { $row.append(res); }
                } else {
                    $row.append($("<span class='qpx-tagbox-item-text'></span>").text(self._displayOf(item)));
                }

                $row.on("click.qpxTagBox", function (e) {
                    e.stopPropagation();
                    self._toggleItem(item);
                    self.$searchInput.trigger("focus");
                });

                self.$list.append($row);
            });
        },

        _filteredItems: function () {
            var self = this;
            var cfg = this.config;
            var text = (this._searchText || "").toLowerCase();

            return (cfg.items || []).filter(function (item) {
                if (cfg.hideSelectedItems && self._indexOfValue(self._valueOf(item)) !== -1) { return false; }
                if (!text) { return true; }
                return self._displayOf(item).toLowerCase().indexOf(text) !== -1;
            });
        },

        // ---------------------------------------------------------------
        // Popup otevřít/zavřít
        // ---------------------------------------------------------------
        open: function () {
            if (this.config.disabled || this._isOpen) { return this; }
            if (openInstance && openInstance !== this) { openInstance.close(); }

            this._renderDropdownItems();

            var off = this.$container.offset();
            this.$dropdown.css({
                top: off.top + this.$container.outerHeight(),
                left: off.left,
                minWidth: this.$container.outerWidth()
            }).show();

            this._isOpen = true;
            this.$container.attr("aria-expanded", "true");
            openInstance = this;
            this.trigger("opened", { component: this });
            return this;
        },

        close: function () {
            if (!this._isOpen) { return this; }
            this.$dropdown.hide();
            this._isOpen = false;
            this._highlightIndex = -1;
            this.$container.attr("aria-expanded", "false");
            if (openInstance === this) { openInstance = null; }
            this.trigger("closed", { component: this });
            return this;
        },

        // ---------------------------------------------------------------
        // Práce s hodnotami / výběrem
        // ---------------------------------------------------------------
        _valueOf: function (item) {
            if (this.config.valueExpr && this.config.valueExpr !== "this") {
                return qpx.resolve(item, this.config.valueExpr);
            }
            return item;
        },

        _displayOf: function (item) {
            if (this.config.displayExpr) {
                var v = qpx.resolve(item, this.config.displayExpr);
                return (v === undefined || v === null) ? "" : String(v);
            }
            if (qpx.isObject(item)) { return item.text !== undefined ? String(item.text) : JSON.stringify(item); }
            return String(item);
        },

        _itemForValue: function (val) {
            var self = this;
            return (this.config.items || []).filter(function (it) { return self._valueOf(it) === val; })[0];
        },

        _itemsForValues: function (values) {
            var self = this;
            return values.map(function (v) {
                var found = self._itemForValue(v);
                return found !== undefined ? found : v;
            });
        },

        _indexOfValue: function (val) {
            var arr = this.config.value || [];
            for (var i = 0; i < arr.length; i++) { if (arr[i] === val) { return i; } }
            return -1;
        },

        _toggleItem: function (item) {
            var val = this._valueOf(item);
            var arr = (this.config.value || []).slice();
            var idx = arr.indexOf(val);
            if (idx === -1) { arr.push(val); } else { arr.splice(idx, 1); }
            this.option("value", arr);
        },

        _removeValue: function (val) {
            var arr = (this.config.value || []).slice();
            var idx = arr.indexOf(val);
            if (idx === -1) { return; }
            arr.splice(idx, 1);
            this.option("value", arr);
        },

        _selectAllFiltered: function () {
            var self = this;
            var arr = (this.config.value || []).slice();
            this._filteredItems().forEach(function (item) {
                var val = self._valueOf(item);
                if (arr.indexOf(val) === -1) { arr.push(val); }
            });
            this.option("value", arr);
        },

        _handleCustomItemCreating: function (text) {
            var cfg = this.config;
            if (!text) { return; }

            var createdItem;
            if (qpx.isFunction(cfg.onCustomItemCreating)) {
                var args = { text: text, component: this, customItem: undefined };
                var ret = cfg.onCustomItemCreating(args);
                createdItem = (args.customItem !== undefined) ? args.customItem : ret;
            }
            if (createdItem === undefined || createdItem === null) {
                if (!cfg.acceptCustomValue) { return; }
                createdItem = text;
            }

            if (cfg.items.indexOf(createdItem) === -1) { cfg.items.push(createdItem); }
            this._toggleItem(createdItem);

            this.$searchInput.val("");
            this._searchText = "";
            this._renderDropdownItems();
        },

        // ---------------------------------------------------------------
        // Veřejné API
        // ---------------------------------------------------------------
        // value() -> čtení pole vybraných hodnot; value(pole) -> zápis (zkratka za option("value", ...))
        value: function (val) {
            if (arguments.length === 0) { return (this.config.value || []).slice(); }
            return this.option("value", val);
        },

        getSelectedItems: function () { return this._itemsForValues((this.config.value || []).slice()); },
        getDataSource: function () { return this.config.items; },
        reset: function () { return this.option("value", []); },
        focus: function () { this.$searchInput.trigger("focus"); return this; },
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
                case "value": {
                    var prevArr = (prev || []).slice();
                    var newArr = value || [];
                    this.config.value = newArr;
                    this._renderField();
                    this._renderDropdownItems();

                    this.trigger("valueChanged", { value: newArr.slice(), previousValue: prevArr, component: this, element: this.getNode() });

                    var added = newArr.filter(function (v) { return prevArr.indexOf(v) === -1; });
                    var removed = prevArr.filter(function (v) { return newArr.indexOf(v) === -1; });
                    if (added.length || removed.length) {
                        this.trigger("selectionChanged", { addedItems: this._itemsForValues(added), removedItems: this._itemsForValues(removed), component: this });
                    }
                    break;
                }

                case "items":
                case "dataSource":
                    this.config.items = value || [];
                    this._renderField();
                    this._renderDropdownItems();
                    break;

                case "disabled":
                    this.$container.toggleClass("qpx-state-disabled", !!value);
                    this.$searchInput.prop("disabled", !!value);
                    if (value) { this.close(); }
                    this._renderField();
                    break;

                case "readOnly":
                    this.$container.toggleClass("qpx-state-readonly", !!value);
                    this.$searchInput.prop("readOnly", !!value || !this.config.searchEnabled);
                    this._renderField();
                    break;

                case "visible":
                    this.$container.toggleClass("qpx-hidden", !value);
                    break;

                case "stylingMode":
                    this.$container.removeClass("qpx-tagbox-mode-" + prev).addClass("qpx-tagbox-mode-" + value);
                    break;

                case "searchEnabled":
                    this.$searchInput.prop("readOnly", !value || !!this.config.readOnly);
                    break;

                case "placeholder":
                case "maxDisplayedTags":
                case "showMultiTagOnly":
                case "showClearButton":
                case "multiline":
                    this._renderField();
                    break;

                case "hideSelectedItems":
                case "showSelectionControls":
                case "noDataText":
                    this._renderDropdownItems();
                    break;
            }

            this.trigger("optionChanged", { name: name, value: value, previousValue: prev, component: this });
            return this;
        },

        destroy: function () {
            this.$container.off(".qpxTagBox");
            if (this.$searchInput) { this.$searchInput.off(".qpxTagBox"); }
            $(document).off(".qpxTagBox" + this.id);
            if (this.$dropdown) { this.$dropdown.remove(); }
            if (openInstance === this) { openInstance = null; }
            this._super();
        }
    });

    qpx.registerWidget("qpTagBox", TagBox);
    qpx.qpTagBox = TagBox;

})(window.qpx, jQuery);

/*!
 * qpx - qpAutocomplete
 * Textové pole s automatickým našeptáváním položek podle psaného textu,
 * koncepčně i vzhledově co nejblíže DevExtreme dxAutocomplete. Na rozdíl
 * od qpSelectBox/qpLookup NENÍ výběr z nabídky vynucen — hodnotou je
 * vždy zadaný text, položka z nabídky jen text doplní.
 *
 * options:
 *   items / dataSource, displayExpr, value (text),
 *   placeholder, minSearchLength, searchTimeout, maxItemCount, noDataText,
 *   showClearButton, stylingMode ("outlined"|"filled"|"underlined"),
 *   disabled, readOnly, visible, itemTemplate, dropDownOptions
 *
 * events:
 *   onInitialized, onContentReady, onValueChanged, onSelectionChanged,
 *   onOpened, onClosed, onEnterKey, onOptionChanged, onDisposing
 *
 * methods:
 *   option(name[, value]), value([val]), open(), close(),
 *   getDataSource(), reset(), focus(), enable(), disable(), destroy()
 */
(function (qpx, $) {
    "use strict";

    var openInstance = null; // aktuálně otevřená instance (jen jedna najednou)

    var Autocomplete = qpx.Widget.extend({

        defaults: {
            dataSource: null,
            items: [],
            displayExpr: null,   // null = item.text, nebo přímo řetězec

            value: "",

            placeholder: "Zadejte text...",
            minSearchLength: 1,
            searchTimeout: 200,
            maxItemCount: undefined,
            noDataText: "Žádné položky",

            showClearButton: false,
            stylingMode: "outlined",  // outlined | filled | underlined

            disabled: false,
            readOnly: false,
            visible: true,

            itemTemplate: null,  // function(itemData, itemIndex, itemElement)
            dropDownOptions: {}, // { width, maxHeight }

            onValueChanged: null,
            onSelectionChanged: null,
            onOpened: null,
            onClosed: null,
            onEnterKey: null,
            onOptionChanged: null,
            onInitialized: null,
            onContentReady: null,
            onDisposing: null
        },

        // ---------------------------------------------------------------
        render: function () {
            var cfg = this.config;
            var self = this;

            cfg.items = (cfg.items && cfg.items.length) ? cfg.items : (cfg.dataSource || []);
            cfg.value = cfg.value || "";

            this.$container
                .addClass("qpx-autocomplete")
                .addClass("qpx-autocomplete-mode-" + cfg.stylingMode)
                .toggleClass("qpx-hidden", !cfg.visible)
                .toggleClass("qpx-state-disabled", !!cfg.disabled)
                .toggleClass("qpx-state-readonly", !!cfg.readOnly)
                .attr("role", "combobox")
                .attr("aria-expanded", "false")
                .attr("aria-autocomplete", "list");

            if (cfg.onInitialized) { this.on("ready", cfg.onInitialized); }
            if (cfg.onContentReady) { this.on("contentReady", cfg.onContentReady); }
            if (cfg.onValueChanged) { this.on("valueChanged", cfg.onValueChanged); }
            if (cfg.onSelectionChanged) { this.on("selectionChanged", cfg.onSelectionChanged); }
            if (cfg.onOpened) { this.on("opened", cfg.onOpened); }
            if (cfg.onClosed) { this.on("closed", cfg.onClosed); }
            if (cfg.onEnterKey) { this.on("enterKey", cfg.onEnterKey); }
            if (cfg.onOptionChanged) { this.on("optionChanged", cfg.onOptionChanged); }
            if (cfg.onDisposing) { this.on("destroy", cfg.onDisposing); }

            this._isOpen = false;
            this._searchText = cfg.value;
            this._highlightIndex = -1;

            this._buildDom();
            this._bindEvents();

            setTimeout(function () { self.trigger("contentReady", { component: self }); }, 0);
        },

        // ---------------------------------------------------------------
        // DOM
        // ---------------------------------------------------------------
        _buildDom: function () {
            var cfg = this.config;
            this.$container.empty();

            this.$input = $("<input type='text' class='qpx-autocomplete-input' autocomplete='off'>")
                .val(cfg.value)
                .attr("placeholder", cfg.placeholder)
                .prop("disabled", !!cfg.disabled)
                .prop("readOnly", !!cfg.readOnly);

            this.$clearBtn = $("<span class='qpx-autocomplete-clear' tabindex='-1' title='Vymazat'>✕</span>").hide();

            this.$container.append(this.$input, this.$clearBtn);

            this.$dropdown = $("<div class='qpx-popup-list qpx-autocomplete-dropdown'></div>").appendTo(document.body).hide();
            this.$list = $("<div class='qpx-autocomplete-list'></div>");
            this.$dropdown.append(this.$list);

            if (cfg.dropDownOptions && cfg.dropDownOptions.width) { this.$dropdown.css("width", qpx.toPx(cfg.dropDownOptions.width)); }
            if (cfg.dropDownOptions && cfg.dropDownOptions.maxHeight) { this.$list.css("max-height", qpx.toPx(cfg.dropDownOptions.maxHeight)); }

            this._renderField();
        },

        _bindEvents: function () {
            var self = this;
            var cfg = this.config;
            var searchTimer = null;

            this.$input.on("focus.qpxAutocomplete", function () {
                if (cfg.disabled || cfg.readOnly) { return; }
                self._searchText = self.$input.val();
                self._renderDropdownItems();
                self.open();
            });

            this.$input.on("input.qpxAutocomplete", function () {
                var val = this.value;
                clearTimeout(searchTimer);
                searchTimer = setTimeout(function () {
                    self._searchText = val;
                    self._highlightIndex = -1;
                    self._renderDropdownItems();
                    if (!self._isOpen) { self.open(); }
                    self.$clearBtn.toggle(!!cfg.showClearButton && val.length > 0);
                }, cfg.searchTimeout);
            });

            this.$input.on("keydown.qpxAutocomplete", function (e) {
                if (cfg.disabled || cfg.readOnly) { return; }
                var items = self._filteredItems();

                switch (e.key) {
                    case "ArrowDown":
                        e.preventDefault();
                        if (!self._isOpen) { self.open(); }
                        self._highlightIndex = Math.min(items.length - 1, self._highlightIndex + 1);
                        self._renderDropdownItems();
                        break;

                    case "ArrowUp":
                        e.preventDefault();
                        self._highlightIndex = Math.max(0, self._highlightIndex - 1);
                        self._renderDropdownItems();
                        break;

                    case "Enter":
                        if (self._highlightIndex > -1 && items[self._highlightIndex]) {
                            self._selectItem(items[self._highlightIndex]);
                        } else {
                            self._commitTypedValue();
                        }
                        self.trigger("enterKey", { component: self, event: e });
                        break;

                    case "Escape":
                        e.preventDefault();
                        self.close();
                        break;
                }
            });

            this.$input.on("blur.qpxAutocomplete", function () {
                // commit se řeší v mousedown handleru dokumentu (aby fungoval i klik na položku)
            });

            this.$clearBtn.on("click.qpxAutocomplete", function (e) {
                e.stopPropagation();
                if (cfg.disabled || cfg.readOnly) { return; }
                self.option("value", "");
                self.$input.trigger("focus");
            });

            $(document).on("mousedown.qpxAutocomplete" + this.id, function (e) {
                if (!self._isOpen) { return; }
                if ($(e.target).closest(self.$dropdown).length || $(e.target).closest(self.$container).length) { return; }
                self._commitTypedValue();
                self.close();
            });
        },

        _renderField: function () {
            var cfg = this.config;
            this.$input.val(cfg.value || "");
            this.$clearBtn.toggle(!!cfg.showClearButton && !!cfg.value);
        },

        // ---------------------------------------------------------------
        // Rozbalovací seznam návrhů
        // ---------------------------------------------------------------
        _renderDropdownItems: function () {
            var self = this;
            var cfg = this.config;
            this.$list.empty();

            var items = this._filteredItems();

            if (!items.length) {
                this.$list.append($("<div class='qpx-autocomplete-nodata'></div>").text(cfg.noDataText));
                return;
            }

            items.forEach(function (item, idx) {
                var $row = $("<div class='qpx-popup-list-item qpx-autocomplete-item'></div>")
                    .toggleClass("qpx-state-highlighted", idx === self._highlightIndex);

                if (qpx.isFunction(cfg.itemTemplate)) {
                    var res = cfg.itemTemplate.call(self, item, idx, $row[0]);
                    if (res !== undefined && res !== null) { $row.append(res); }
                } else {
                    $row.append($("<span class='qpx-autocomplete-item-text'></span>").text(self._displayOf(item)));
                }

                $row.on("mousedown.qpxAutocomplete", function (e) {
                    // mousedown místo click, aby předešlo blur/mousedown handleru dokumentu
                    e.preventDefault();
                    e.stopPropagation();
                    self._selectItem(item);
                });

                self.$list.append($row);
            });
        },

        _filteredItems: function () {
            var self = this;
            var cfg = this.config;
            var text = (this._searchText || "");

            if (text.length < (cfg.minSearchLength || 0)) { return []; }

            var lower = text.toLowerCase();
            var result = (cfg.items || []).filter(function (item) {
                if (!lower) { return true; }
                return self._displayOf(item).toLowerCase().indexOf(lower) !== -1;
            });

            if (cfg.maxItemCount) { result = result.slice(0, cfg.maxItemCount); }
            return result;
        },

        _displayOf: function (item) {
            if (this.config.displayExpr) {
                var v = qpx.resolve(item, this.config.displayExpr);
                return (v === undefined || v === null) ? "" : String(v);
            }
            if (qpx.isObject(item)) { return item.text !== undefined ? String(item.text) : JSON.stringify(item); }
            return String(item);
        },

        _selectItem: function (item) {
            var text = this._displayOf(item);
            this.option("value", text);
            this.trigger("selectionChanged", { item: item, component: this });
            this.close();
            this.$input.trigger("focus");
        },

        _commitTypedValue: function () {
            var text = this.$input.val();
            if (text !== this.config.value) { this.option("value", text); }
        },

        // ---------------------------------------------------------------
        // Popup otevřít/zavřít
        // ---------------------------------------------------------------
        open: function () {
            if (this.config.disabled || this.config.readOnly || this._isOpen) { return this; }
            if (openInstance && openInstance !== this) { openInstance.close(); }

            this._renderDropdownItems();

            var off = this.$container.offset();
            this.$dropdown.css({
                top: off.top + this.$container.outerHeight(),
                left: off.left,
                minWidth: this.$container.outerWidth()
            }).show();

            this._isOpen = true;
            this.$container.attr("aria-expanded", "true");
            openInstance = this;
            this.trigger("opened", { component: this });
            return this;
        },

        close: function () {
            if (!this._isOpen) { return this; }
            this.$dropdown.hide();
            this._isOpen = false;
            this._highlightIndex = -1;
            this.$container.attr("aria-expanded", "false");
            if (openInstance === this) { openInstance = null; }
            this.trigger("closed", { component: this });
            return this;
        },

        // ---------------------------------------------------------------
        // Veřejné API
        // ---------------------------------------------------------------
        value: function (val) {
            if (arguments.length === 0) { return this.config.value; }
            return this.option("value", val);
        },

        getDataSource: function () { return this.config.items; },
        reset: function () { return this.option("value", ""); },
        focus: function () { this.$input.trigger("focus"); return this; },
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
                case "value":
                    this._searchText = value || "";
                    this._renderField();
                    this.trigger("valueChanged", { value: value, previousValue: prev, component: this, element: this.getNode() });
                    break;

                case "items":
                case "dataSource":
                    this.config.items = value || [];
                    if (this._isOpen) { this._renderDropdownItems(); }
                    break;

                case "disabled":
                    this.$container.toggleClass("qpx-state-disabled", !!value);
                    this.$input.prop("disabled", !!value);
                    if (value) { this.close(); }
                    break;

                case "readOnly":
                    this.$container.toggleClass("qpx-state-readonly", !!value);
                    this.$input.prop("readOnly", !!value);
                    if (value) { this.close(); }
                    break;

                case "visible":
                    this.$container.toggleClass("qpx-hidden", !value);
                    break;

                case "stylingMode":
                    this.$container.removeClass("qpx-autocomplete-mode-" + prev).addClass("qpx-autocomplete-mode-" + value);
                    break;

                case "placeholder":
                    this.$input.attr("placeholder", value);
                    break;

                case "showClearButton":
                    this._renderField();
                    break;

                case "minSearchLength":
                case "maxItemCount":
                case "noDataText":
                    if (this._isOpen) { this._renderDropdownItems(); }
                    break;
            }

            this.trigger("optionChanged", { name: name, value: value, previousValue: prev, component: this });
            return this;
        },

        destroy: function () {
            this.$container.off(".qpxAutocomplete");
            if (this.$input) { this.$input.off(".qpxAutocomplete"); }
            $(document).off(".qpxAutocomplete" + this.id);
            if (this.$dropdown) { this.$dropdown.remove(); }
            if (openInstance === this) { openInstance = null; }
            this._super();
        }
    });

    qpx.registerWidget("qpAutocomplete", Autocomplete);
    qpx.qpAutocomplete = Autocomplete;

})(window.qpx, jQuery);

/*!
 * qpx - qpSelectBox
 * Výběr jedné položky z rozbalovacího seznamu, koncepčně i vzhledově
 * co nejblíže DevExtreme dxSelectBox. Na rozdíl od qpAutocomplete je
 * hodnotou vždy položka ze seznamu (resp. valueExpr z ní) — volný text
 * je povolen jen při acceptCustomValue: true.
 *
 * options:
 *   items / dataSource, valueExpr, displayExpr, value,
 *   placeholder, searchEnabled, searchTimeout, minSearchLength, noDataText,
 *   acceptCustomValue, showClearButton, stylingMode ("outlined"|"filled"|"underlined"),
 *   disabled, readOnly, visible, itemTemplate, dropDownOptions
 *
 * events:
 *   onInitialized, onContentReady, onValueChanged, onSelectionChanged,
 *   onOpened, onClosed, onCustomItemCreating, onOptionChanged, onDisposing
 *
 * methods:
 *   option(name[, value]), value([val]), open(), close(),
 *   getSelectedItem(), getDataSource(), reset(), focus(),
 *   enable(), disable(), destroy()
 */
(function (qpx, $) {
    "use strict";

    var openInstance = null; // aktuálně otevřená instance (jen jedna najednou)

    var SelectBox = qpx.Widget.extend({

        defaults: {
            dataSource: null,
            items: [],
            valueExpr: null,      // null = "this" (celá položka je hodnota)
            displayExpr: null,    // null = item.text, nebo JSON.stringify

            value: null,

            placeholder: "Vyberte...",
            searchEnabled: false,
            searchTimeout: 200,
            minSearchLength: 0,
            noDataText: "Žádné položky",

            acceptCustomValue: false,
            showClearButton: false,
            stylingMode: "outlined",  // outlined | filled | underlined

            disabled: false,
            readOnly: false,
            visible: true,

            itemTemplate: null,  // function(itemData, itemIndex, itemElement)
            dropDownOptions: {}, // { width, maxHeight }

            onValueChanged: null,
            onSelectionChanged: null,
            onOpened: null,
            onClosed: null,
            onCustomItemCreating: null,
            onOptionChanged: null,
            onInitialized: null,
            onContentReady: null,
            onDisposing: null
        },

        // ---------------------------------------------------------------
        render: function () {
            var cfg = this.config;
            var self = this;

            cfg.items = (cfg.items && cfg.items.length) ? cfg.items : (cfg.dataSource || []);

            this.$container
                .addClass("qpx-selectbox")
                .addClass("qpx-selectbox-mode-" + cfg.stylingMode)
                .toggleClass("qpx-hidden", !cfg.visible)
                .toggleClass("qpx-state-disabled", !!cfg.disabled)
                .toggleClass("qpx-state-readonly", !!cfg.readOnly)
                .attr("role", "combobox")
                .attr("aria-expanded", "false");

            if (cfg.onInitialized) { this.on("ready", cfg.onInitialized); }
            if (cfg.onContentReady) { this.on("contentReady", cfg.onContentReady); }
            if (cfg.onValueChanged) { this.on("valueChanged", cfg.onValueChanged); }
            if (cfg.onSelectionChanged) { this.on("selectionChanged", cfg.onSelectionChanged); }
            if (cfg.onOpened) { this.on("opened", cfg.onOpened); }
            if (cfg.onClosed) { this.on("closed", cfg.onClosed); }
            if (cfg.onOptionChanged) { this.on("optionChanged", cfg.onOptionChanged); }
            if (cfg.onDisposing) { this.on("destroy", cfg.onDisposing); }

            this._isOpen = false;
            this._searchText = "";
            this._highlightIndex = -1;

            this._buildDom();
            this._bindEvents();

            setTimeout(function () { self.trigger("contentReady", { component: self }); }, 0);
        },

        // ---------------------------------------------------------------
        // DOM
        // ---------------------------------------------------------------
        _buildDom: function () {
            var cfg = this.config;
            this.$container.empty();

            this.$input = $("<input type='text' class='qpx-selectbox-input' autocomplete='off'>")
                .prop("disabled", !!cfg.disabled)
                .prop("readOnly", !cfg.searchEnabled || !!cfg.readOnly);

            this.$clearBtn = $("<span class='qpx-selectbox-clear' tabindex='-1' title='Vymazat výběr'>✕</span>").hide();
            this.$arrow = $("<span class='qpx-selectbox-arrow'>▾</span>");

            this.$container.append(this.$input, this.$clearBtn, this.$arrow);

            this.$dropdown = $("<div class='qpx-popup-list qpx-selectbox-dropdown'></div>").appendTo(document.body).hide();
            this.$list = $("<div class='qpx-selectbox-list'></div>");
            this.$dropdown.append(this.$list);

            if (cfg.dropDownOptions && cfg.dropDownOptions.width) { this.$dropdown.css("width", qpx.toPx(cfg.dropDownOptions.width)); }
            if (cfg.dropDownOptions && cfg.dropDownOptions.maxHeight) { this.$list.css("max-height", qpx.toPx(cfg.dropDownOptions.maxHeight)); }

            this._renderField();
        },

        _bindEvents: function () {
            var self = this;
            var cfg = this.config;

            this.$container.on("click.qpxSelectBox", function (e) {
                if (cfg.disabled || cfg.readOnly) { return; }
                if ($(e.target).closest(".qpx-selectbox-clear").length) { return; }
                self.$input.trigger("focus");
                if (self._isOpen) { self.close(); } else { self.open(); }
            });

            this.$input.on("focus.qpxSelectBox", function () {
                if (cfg.disabled || cfg.readOnly) { return; }
                if (cfg.searchEnabled) { self.$input.val(""); self._searchText = ""; self._renderDropdownItems(); }
            });

            var searchTimer = null;
            this.$input.on("input.qpxSelectBox", function () {
                if (!cfg.searchEnabled) { return; }
                var val = this.value;
                clearTimeout(searchTimer);
                searchTimer = setTimeout(function () {
                    self._searchText = (val.length >= (cfg.minSearchLength || 0)) ? val : "";
                    self._highlightIndex = -1;
                    self._renderDropdownItems();
                    if (!self._isOpen) { self.open(); }
                }, cfg.searchTimeout);
            });

            this.$input.on("keydown.qpxSelectBox", function (e) {
                if (cfg.disabled || cfg.readOnly) { return; }
                var items = self._filteredItems();

                switch (e.key) {
                    case "ArrowDown":
                        e.preventDefault();
                        if (!self._isOpen) { self.open(); }
                        self._highlightIndex = Math.min(items.length - 1, self._highlightIndex + 1);
                        self._renderDropdownItems();
                        break;

                    case "ArrowUp":
                        e.preventDefault();
                        self._highlightIndex = Math.max(0, self._highlightIndex - 1);
                        self._renderDropdownItems();
                        break;

                    case "Enter":
                        e.preventDefault();
                        if (self._highlightIndex > -1 && items[self._highlightIndex]) {
                            self._selectItem(items[self._highlightIndex]);
                        } else if (cfg.acceptCustomValue && this.value.trim()) {
                            self._handleCustomItemCreating(this.value.trim());
                        }
                        break;

                    case "Escape":
                        e.preventDefault();
                        self._renderField();
                        self.close();
                        break;
                }
            });

            this.$arrow.on("click.qpxSelectBox", function (e) {
                e.stopPropagation();
                if (cfg.disabled || cfg.readOnly) { return; }
                if (self._isOpen) { self.close(); } else { self.$input.trigger("focus"); self.open(); }
            });

            this.$clearBtn.on("click.qpxSelectBox", function (e) {
                e.stopPropagation();
                if (cfg.disabled || cfg.readOnly) { return; }
                self.option("value", null);
            });

            $(document).on("mousedown.qpxSelectBox" + this.id, function (e) {
                if (!self._isOpen) { return; }
                if ($(e.target).closest(self.$dropdown).length || $(e.target).closest(self.$container).length) { return; }
                self._renderField();
                self.close();
            });
        },

        // ---------------------------------------------------------------
        _renderField: function () {
            var cfg = this.config;
            var item = this._itemForValue(cfg.value);
            var text = (cfg.value !== null && cfg.value !== undefined)
                ? (item !== undefined ? this._displayOf(item) : String(cfg.value))
                : "";

            this.$input.val(text).attr("placeholder", cfg.placeholder);
            this.$clearBtn.toggle(!!cfg.showClearButton && cfg.value !== null && cfg.value !== undefined && !cfg.disabled && !cfg.readOnly);
        },

        // ---------------------------------------------------------------
        // Rozbalovací seznam položek
        // ---------------------------------------------------------------
        _renderDropdownItems: function () {
            var self = this;
            var cfg = this.config;
            this.$list.empty();

            var items = this._filteredItems();

            if (!items.length) {
                this.$list.append($("<div class='qpx-selectbox-nodata'></div>").text(cfg.noDataText));
                return;
            }

            items.forEach(function (item, idx) {
                var val = self._valueOf(item);
                var selected = self._valuesEqual(val, cfg.value);

                var $row = $("<div class='qpx-popup-list-item qpx-selectbox-item'></div>")
                    .toggleClass("qpx-state-selected", selected)
                    .toggleClass("qpx-state-highlighted", idx === self._highlightIndex);

                if (qpx.isFunction(cfg.itemTemplate)) {
                    var res = cfg.itemTemplate.call(self, item, idx, $row[0]);
                    if (res !== undefined && res !== null) { $row.append(res); }
                } else {
                    $row.append($("<span class='qpx-selectbox-item-text'></span>").text(self._displayOf(item)));
                }

                $row.on("mousedown.qpxSelectBox", function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    self._selectItem(item);
                });

                self.$list.append($row);
            });
        },

        _filteredItems: function () {
            var self = this;
            var cfg = this.config;
            var text = (this._searchText || "").toLowerCase();

            return (cfg.items || []).filter(function (item) {
                if (!text) { return true; }
                return self._displayOf(item).toLowerCase().indexOf(text) !== -1;
            });
        },

        // ---------------------------------------------------------------
        // Práce s hodnotou
        // ---------------------------------------------------------------
        _valueOf: function (item) {
            if (this.config.valueExpr && this.config.valueExpr !== "this") {
                return qpx.resolve(item, this.config.valueExpr);
            }
            return item;
        },

        _displayOf: function (item) {
            if (this.config.displayExpr) {
                var v = qpx.resolve(item, this.config.displayExpr);
                return (v === undefined || v === null) ? "" : String(v);
            }
            if (qpx.isObject(item)) { return item.text !== undefined ? String(item.text) : JSON.stringify(item); }
            return String(item);
        },

        _itemForValue: function (val) {
            var self = this;
            return (this.config.items || []).filter(function (it) { return self._valuesEqual(self._valueOf(it), val); })[0];
        },

        _valuesEqual: function (a, b) { return a === b; },

        _selectItem: function (item) {
            var val = this._valueOf(item);
            this.option("value", val);
            this.trigger("selectionChanged", { selectedItem: item, component: this });
            this.close();
            this.$input.trigger("focus");
        },

        _handleCustomItemCreating: function (text) {
            var cfg = this.config;
            if (!text) { return; }

            var createdItem;
            if (qpx.isFunction(cfg.onCustomItemCreating)) {
                var args = { text: text, component: this, customItem: undefined };
                var ret = cfg.onCustomItemCreating(args);
                createdItem = (args.customItem !== undefined) ? args.customItem : ret;
            }
            if (createdItem === undefined || createdItem === null) {
                if (!cfg.acceptCustomValue) { return; }
                createdItem = text;
            }

            if (cfg.items.indexOf(createdItem) === -1) { cfg.items.push(createdItem); }
            this._selectItem(createdItem);
        },

        // ---------------------------------------------------------------
        // Popup otevřít/zavřít
        // ---------------------------------------------------------------
        open: function () {
            if (this.config.disabled || this.config.readOnly || this._isOpen) { return this; }
            if (openInstance && openInstance !== this) { openInstance.close(); }

            this._renderDropdownItems();

            var off = this.$container.offset();
            this.$dropdown.css({
                top: off.top + this.$container.outerHeight(),
                left: off.left,
                minWidth: this.$container.outerWidth()
            }).show();

            this._isOpen = true;
            this.$container.attr("aria-expanded", "true");
            openInstance = this;
            this.trigger("opened", { component: this });
            return this;
        },

        close: function () {
            if (!this._isOpen) { return this; }
            this.$dropdown.hide();
            this._isOpen = false;
            this._highlightIndex = -1;
            this.$container.attr("aria-expanded", "false");
            if (openInstance === this) { openInstance = null; }
            this.trigger("closed", { component: this });
            return this;
        },

        // ---------------------------------------------------------------
        // Veřejné API
        // ---------------------------------------------------------------
        value: function (val) {
            if (arguments.length === 0) { return this.config.value; }
            return this.option("value", val);
        },

        getSelectedItem: function () { return this._itemForValue(this.config.value); },
        getDataSource: function () { return this.config.items; },
        reset: function () { return this.option("value", null); },
        focus: function () { this.$input.trigger("focus"); return this; },
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
                case "value": {
                    this._renderField();
                    this.trigger("valueChanged", { value: value, previousValue: prev, component: this, element: this.getNode() });
                    break;
                }

                case "items":
                case "dataSource":
                    this.config.items = value || [];
                    this._renderField();
                    if (this._isOpen) { this._renderDropdownItems(); }
                    break;

                case "disabled":
                    this.$container.toggleClass("qpx-state-disabled", !!value);
                    this.$input.prop("disabled", !!value);
                    if (value) { this.close(); }
                    this._renderField();
                    break;

                case "readOnly":
                    this.$container.toggleClass("qpx-state-readonly", !!value);
                    this.$input.prop("readOnly", !!value || !this.config.searchEnabled);
                    if (value) { this.close(); }
                    this._renderField();
                    break;

                case "visible":
                    this.$container.toggleClass("qpx-hidden", !value);
                    break;

                case "stylingMode":
                    this.$container.removeClass("qpx-selectbox-mode-" + prev).addClass("qpx-selectbox-mode-" + value);
                    break;

                case "searchEnabled":
                    this.$input.prop("readOnly", !value || !!this.config.readOnly);
                    break;

                case "placeholder":
                case "showClearButton":
                    this._renderField();
                    break;

                case "noDataText":
                    if (this._isOpen) { this._renderDropdownItems(); }
                    break;
            }

            this.trigger("optionChanged", { name: name, value: value, previousValue: prev, component: this });
            return this;
        },

        destroy: function () {
            this.$container.off(".qpxSelectBox");
            if (this.$input) { this.$input.off(".qpxSelectBox"); }
            $(document).off(".qpxSelectBox" + this.id);
            if (this.$dropdown) { this.$dropdown.remove(); }
            if (openInstance === this) { openInstance = null; }
            this._super();
        }
    });

    qpx.registerWidget("qpSelectBox", SelectBox);
    qpx.qpSelectBox = SelectBox;

})(window.qpx, jQuery);

/*!
 * qpx - qpDropDownBox
 * Pole zobrazující aktuální hodnotu (přes displayExpr/dataSource), po
 * kliknutí rozbalí POPUP S LIBOVOLNÝM VLASTNÍM OBSAHEM (contentTemplate)
 * — např. qpTreeView, qpDataGrid nebo jinou kombinaci qpx komponent.
 * Koncepčně i vzhledově co nejblíže DevExtreme dxDropDownBox.
 *
 * Narozdíl od qpSelectBox/qpLookup si qpDropDownBox sám nespravuje
 * seznam položek — jen poskytuje "rám" (pole + popup) a řízení hodnoty;
 * o samotný výběr uvnitř popupu se stará obsah vložený přes contentTemplate,
 * který dostane odkaz na komponentu (component.option("value", ...), component.close()).
 *
 * options:
 *   items / dataSource, valueExpr, displayExpr, value,
 *   contentTemplate(e, contentElement), deferRendering,
 *   placeholder, showClearButton, stylingMode ("outlined"|"filled"|"underlined"),
 *   disabled, readOnly, visible, dropDownOptions
 *
 * events:
 *   onInitialized, onContentReady, onValueChanged,
 *   onOpened, onClosed, onOptionChanged, onDisposing
 *
 * methods:
 *   option(name[, value]), value([val]), open(), close(),
 *   content(), reset(), focus(), enable(), disable(), destroy()
 */
(function (qpx, $) {
    "use strict";

    var openInstance = null; // aktuálně otevřená instance (jen jedna najednou)

    var DropDownBox = qpx.Widget.extend({

        defaults: {
            dataSource: null,
            items: [],
            valueExpr: null,
            displayExpr: null,

            value: null,

            contentTemplate: null, // function(e:{component, value}, contentElement)
            deferRendering: true,  // true = obsah popupu se vykreslí až při prvním otevření

            placeholder: "Vyberte...",
            showClearButton: false,
            stylingMode: "outlined",  // outlined | filled | underlined

            disabled: false,
            readOnly: false,
            visible: true,

            dropDownOptions: {}, // { width, height, maxHeight }

            onValueChanged: null,
            onOpened: null,
            onClosed: null,
            onOptionChanged: null,
            onInitialized: null,
            onContentReady: null,
            onDisposing: null
        },

        // ---------------------------------------------------------------
        render: function () {
            var cfg = this.config;
            var self = this;

            cfg.items = (cfg.items && cfg.items.length) ? cfg.items : (cfg.dataSource || []);

            this.$container
                .addClass("qpx-dropdownbox")
                .addClass("qpx-dropdownbox-mode-" + cfg.stylingMode)
                .toggleClass("qpx-hidden", !cfg.visible)
                .toggleClass("qpx-state-disabled", !!cfg.disabled)
                .toggleClass("qpx-state-readonly", !!cfg.readOnly)
                .attr("role", "combobox")
                .attr("aria-expanded", "false");

            if (cfg.onInitialized) { this.on("ready", cfg.onInitialized); }
            if (cfg.onContentReady) { this.on("contentReady", cfg.onContentReady); }
            if (cfg.onValueChanged) { this.on("valueChanged", cfg.onValueChanged); }
            if (cfg.onOpened) { this.on("opened", cfg.onOpened); }
            if (cfg.onClosed) { this.on("closed", cfg.onClosed); }
            if (cfg.onOptionChanged) { this.on("optionChanged", cfg.onOptionChanged); }
            if (cfg.onDisposing) { this.on("destroy", cfg.onDisposing); }

            this._isOpen = false;
            this._contentRendered = false;

            this._buildDom();
            this._bindEvents();

            if (!cfg.deferRendering) { this._ensureContent(); }

            setTimeout(function () { self.trigger("contentReady", { component: self }); }, 0);
        },

        // ---------------------------------------------------------------
        // DOM
        // ---------------------------------------------------------------
        _buildDom: function () {
            var cfg = this.config;
            this.$container.empty();

            this.$input = $("<input type='text' class='qpx-dropdownbox-input' autocomplete='off' readonly>")
                .prop("disabled", !!cfg.disabled);

            this.$clearBtn = $("<span class='qpx-dropdownbox-clear' tabindex='-1' title='Vymazat výběr'>✕</span>").hide();
            this.$arrow = $("<span class='qpx-dropdownbox-arrow'>▾</span>");

            this.$container.append(this.$input, this.$clearBtn, this.$arrow);

            this.$dropdown = $("<div class='qpx-popup-surface qpx-dropdownbox-popup'></div>").appendTo(document.body).hide();
            this.$content = $("<div class='qpx-dropdownbox-content'></div>");
            this.$dropdown.append(this.$content);

            if (cfg.dropDownOptions && cfg.dropDownOptions.width) { this.$dropdown.css("width", qpx.toPx(cfg.dropDownOptions.width)); }
            if (cfg.dropDownOptions && cfg.dropDownOptions.height) { this.$content.css("height", qpx.toPx(cfg.dropDownOptions.height)); }
            if (cfg.dropDownOptions && cfg.dropDownOptions.maxHeight) { this.$content.css("max-height", qpx.toPx(cfg.dropDownOptions.maxHeight)); }

            this._renderField();
        },

        _bindEvents: function () {
            var self = this;
            var cfg = this.config;

            this.$container.on("click.qpxDropDownBox", function (e) {
                if (cfg.disabled || cfg.readOnly) { return; }
                if ($(e.target).closest(".qpx-dropdownbox-clear").length) { return; }
                if (self._isOpen) { self.close(); } else { self.open(); }
            });

            this.$clearBtn.on("click.qpxDropDownBox", function (e) {
                e.stopPropagation();
                if (cfg.disabled || cfg.readOnly) { return; }
                self.option("value", null);
            });

            $(document).on("mousedown.qpxDropDownBox" + this.id, function (e) {
                if (!self._isOpen) { return; }
                if ($(e.target).closest(self.$dropdown).length || $(e.target).closest(self.$container).length) { return; }
                self.close();
            });

            $(document).on("keydown.qpxDropDownBox" + this.id, function (e) {
                if (self._isOpen && e.key === "Escape") { self.close(); }
            });
        },

        _renderField: function () {
            var cfg = this.config;
            this.$input.val(this._resolveDisplayText()).attr("placeholder", cfg.placeholder);
            this.$clearBtn.toggle(!!cfg.showClearButton && cfg.value !== null && cfg.value !== undefined && !cfg.disabled && !cfg.readOnly);
        },

        _resolveDisplayText: function () {
            var cfg = this.config;
            if (cfg.value === null || cfg.value === undefined || cfg.value === "") { return ""; }

            if (cfg.displayExpr || cfg.valueExpr) {
                var self = this;
                var item = (cfg.items || []).filter(function (it) {
                    var v = cfg.valueExpr ? qpx.resolve(it, cfg.valueExpr) : it;
                    return v === cfg.value;
                })[0];
                if (item !== undefined) {
                    if (cfg.displayExpr) {
                        var d = qpx.resolve(item, cfg.displayExpr);
                        return (d === undefined || d === null) ? "" : String(d);
                    }
                    return qpx.isObject(item) ? JSON.stringify(item) : String(item);
                }
            }
            return String(cfg.value);
        },

        // ---------------------------------------------------------------
        // Obsah popupu
        // ---------------------------------------------------------------
        _ensureContent: function () {
            var cfg = this.config;
            if (this._contentRendered) { return; }
            this._contentRendered = true;

            this.$content.empty();
            if (qpx.isFunction(cfg.contentTemplate)) {
                var res = cfg.contentTemplate.call(this, { component: this, value: cfg.value }, this.$content[0]);
                if (res !== undefined && res !== null) { this.$content.append(res); }
            } else {
                this.$content.append($("<div class='qpx-dropdownbox-nocontent'></div>").text("contentTemplate není nastaven."));
            }
        },

        content: function () { return this.$content; },

        // ---------------------------------------------------------------
        // Popup otevřít/zavřít
        // ---------------------------------------------------------------
        open: function () {
            if (this.config.disabled || this.config.readOnly || this._isOpen) { return this; }
            if (openInstance && openInstance !== this) { openInstance.close(); }

            this._ensureContent();

            var off = this.$container.offset();
            this.$dropdown.css({
                top: off.top + this.$container.outerHeight(),
                left: off.left,
                minWidth: this.$container.outerWidth()
            }).show();

            this._isOpen = true;
            this.$container.attr("aria-expanded", "true");
            openInstance = this;
            this.trigger("opened", { component: this });
            return this;
        },

        close: function () {
            if (!this._isOpen) { return this; }
            this.$dropdown.hide();
            this._isOpen = false;
            this.$container.attr("aria-expanded", "false");
            if (openInstance === this) { openInstance = null; }
            this.trigger("closed", { component: this });
            return this;
        },

        // ---------------------------------------------------------------
        // Veřejné API
        // ---------------------------------------------------------------
        value: function (val) {
            if (arguments.length === 0) { return this.config.value; }
            return this.option("value", val);
        },

        getDataSource: function () { return this.config.items; },
        reset: function () { return this.option("value", null); },
        focus: function () { this.$input.trigger("focus"); return this; },
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
                case "value":
                    this._renderField();
                    this.trigger("valueChanged", { value: value, previousValue: prev, component: this, element: this.getNode() });
                    break;

                case "items":
                case "dataSource":
                    this.config.items = value || [];
                    this._renderField();
                    break;

                case "disabled":
                    this.$container.toggleClass("qpx-state-disabled", !!value);
                    this.$input.prop("disabled", !!value);
                    if (value) { this.close(); }
                    this._renderField();
                    break;

                case "readOnly":
                    this.$container.toggleClass("qpx-state-readonly", !!value);
                    if (value) { this.close(); }
                    break;

                case "visible":
                    this.$container.toggleClass("qpx-hidden", !value);
                    break;

                case "stylingMode":
                    this.$container.removeClass("qpx-dropdownbox-mode-" + prev).addClass("qpx-dropdownbox-mode-" + value);
                    break;

                case "placeholder":
                case "showClearButton":
                    this._renderField();
                    break;

                case "contentTemplate":
                    this._contentRendered = false;
                    if (this._isOpen) { this._ensureContent(); }
                    break;
            }

            this.trigger("optionChanged", { name: name, value: value, previousValue: prev, component: this });
            return this;
        },

        destroy: function () {
            this.$container.off(".qpxDropDownBox");
            $(document).off(".qpxDropDownBox" + this.id);
            if (this.$dropdown) { this.$dropdown.remove(); }
            if (openInstance === this) { openInstance = null; }
            this._super();
        }
    });

    qpx.registerWidget("qpDropDownBox", DropDownBox);
    qpx.qpDropDownBox = DropDownBox;

})(window.qpx, jQuery);

/*!
 * qpx - qpLookup
 * Výběr jedné položky ze seznamu, koncepčně i vzhledově co nejblíže
 * DevExtreme dxLookup. Na rozdíl od qpSelectBox se nabídka neotvírá
 * jako úzký dropdown pod polem, ale jako VYSTŘEDĚNÝ POPUP s titulkem,
 * vlastním vyhledávacím polem v hlavičce a (volitelně) tlačítky
 * Hotovo/Zrušit dole (applyValueMode: "useButtons").
 *
 * options:
 *   items / dataSource, valueExpr, displayExpr, value,
 *   placeholder, title, searchEnabled, searchTimeout, minSearchLength,
 *   searchPlaceholder, noDataText, applyValueMode ("instantly"|"useButtons"),
 *   cancelText, doneText, showClearButton,
 *   stylingMode ("outlined"|"filled"|"underlined"),
 *   disabled, readOnly, visible, itemTemplate, dropDownOptions
 *
 * events:
 *   onInitialized, onContentReady, onValueChanged, onSelectionChanged,
 *   onOpened, onClosed, onOptionChanged, onDisposing
 *
 * methods:
 *   option(name[, value]), value([val]), open(), close(),
 *   getSelectedItem(), getDataSource(), reset(), focus(),
 *   enable(), disable(), destroy()
 */
(function (qpx, $) {
    "use strict";

    var openInstance = null; // aktuálně otevřená instance (jen jedna najednou)

    var Lookup = qpx.Widget.extend({

        defaults: {
            dataSource: null,
            items: [],
            valueExpr: null,
            displayExpr: null,

            value: null,

            placeholder: "Vyberte...",
            title: "Vyberte položku",

            searchEnabled: true,
            searchTimeout: 200,
            minSearchLength: 0,
            searchPlaceholder: "Hledat...",
            noDataText: "Žádné položky",

            applyValueMode: "instantly", // instantly | useButtons
            cancelText: "Zrušit",
            doneText: "Hotovo",

            showClearButton: false,
            stylingMode: "outlined",  // outlined | filled | underlined

            disabled: false,
            readOnly: false,
            visible: true,

            itemTemplate: null,  // function(itemData, itemIndex, itemElement)
            dropDownOptions: {}, // { width, height }

            onValueChanged: null,
            onSelectionChanged: null,
            onOpened: null,
            onClosed: null,
            onOptionChanged: null,
            onInitialized: null,
            onContentReady: null,
            onDisposing: null
        },

        // ---------------------------------------------------------------
        render: function () {
            var cfg = this.config;
            var self = this;

            cfg.items = (cfg.items && cfg.items.length) ? cfg.items : (cfg.dataSource || []);

            this.$container
                .addClass("qpx-lookup")
                .addClass("qpx-lookup-mode-" + cfg.stylingMode)
                .toggleClass("qpx-hidden", !cfg.visible)
                .toggleClass("qpx-state-disabled", !!cfg.disabled)
                .toggleClass("qpx-state-readonly", !!cfg.readOnly)
                .attr("role", "button")
                .attr("aria-expanded", "false");

            if (cfg.onInitialized) { this.on("ready", cfg.onInitialized); }
            if (cfg.onContentReady) { this.on("contentReady", cfg.onContentReady); }
            if (cfg.onValueChanged) { this.on("valueChanged", cfg.onValueChanged); }
            if (cfg.onSelectionChanged) { this.on("selectionChanged", cfg.onSelectionChanged); }
            if (cfg.onOpened) { this.on("opened", cfg.onOpened); }
            if (cfg.onClosed) { this.on("closed", cfg.onClosed); }
            if (cfg.onOptionChanged) { this.on("optionChanged", cfg.onOptionChanged); }
            if (cfg.onDisposing) { this.on("destroy", cfg.onDisposing); }

            this._isOpen = false;
            this._searchText = "";
            this._highlightIndex = -1;
            this._pendingValue = cfg.value; // rozpracovaný výběr v režimu "useButtons"

            this._buildDom();
            this._bindEvents();

            setTimeout(function () { self.trigger("contentReady", { component: self }); }, 0);
        },

        // ---------------------------------------------------------------
        // DOM — pole v řádku stránky
        // ---------------------------------------------------------------
        _buildDom: function () {
            var cfg = this.config;
            this.$container.empty();

            this.$input = $("<input type='text' class='qpx-lookup-input' readonly autocomplete='off'>")
                .prop("disabled", !!cfg.disabled);

            this.$clearBtn = $("<span class='qpx-lookup-clear' tabindex='-1' title='Vymazat výběr'>✕</span>").hide();
            this.$arrow = $("<span class='qpx-lookup-arrow'>▾</span>");

            this.$container.append(this.$input, this.$clearBtn, this.$arrow);

            this._buildPopup();
            this._renderField();
        },

        // DOM — vystředěný popup (overlay + hlavička s titulkem/hledáním + seznam + patička)
        _buildPopup: function () {
            var cfg = this.config;

            this.$overlay = $("<div class='qpx-lookup-overlay'></div>").appendTo(document.body).hide();
            this.$popup = $("<div class='qpx-popup-surface qpx-lookup-popup'></div>").appendTo(this.$overlay);

            if (cfg.dropDownOptions && cfg.dropDownOptions.width) { this.$popup.css("width", qpx.toPx(cfg.dropDownOptions.width)); }
            if (cfg.dropDownOptions && cfg.dropDownOptions.height) { this.$popup.css("height", qpx.toPx(cfg.dropDownOptions.height)); }

            this.$header = $("<div class='qpx-lookup-header'></div>");
            this.$title = $("<div class='qpx-lookup-title'></div>").text(cfg.title);
            this.$closeIcon = $("<span class='qpx-lookup-close' title='Zavřít'>✕</span>");
            this.$header.append(this.$title, this.$closeIcon);

            this.$searchWrap = $("<div class='qpx-lookup-search-wrap'></div>");
            this.$searchInput = $("<input type='text' class='qpx-lookup-search' autocomplete='off'>")
                .attr("placeholder", cfg.searchPlaceholder);
            this.$searchWrap.append(this.$searchInput);

            this.$list = $("<div class='qpx-lookup-list'></div>");

            this.$footer = $("<div class='qpx-lookup-footer'></div>");
            this.$cancelBtn = $("<button type='button' class='qpx-lookup-btn qpx-lookup-btn-cancel'></button>").text(cfg.cancelText);
            this.$doneBtn = $("<button type='button' class='qpx-lookup-btn qpx-lookup-btn-done'></button>").text(cfg.doneText);
            this.$footer.append(this.$cancelBtn, this.$doneBtn);

            this.$popup.append(this.$header, this.$searchWrap, this.$list, this.$footer);

            this.$searchWrap.toggle(!!cfg.searchEnabled);
            this.$footer.toggle(cfg.applyValueMode === "useButtons");
        },

        _bindEvents: function () {
            var self = this;
            var cfg = this.config;

            this.$container.on("click.qpxLookup", function (e) {
                if (cfg.disabled || cfg.readOnly) { return; }
                if ($(e.target).closest(".qpx-lookup-clear").length) { return; }
                self.open();
            });

            this.$clearBtn.on("click.qpxLookup", function (e) {
                e.stopPropagation();
                if (cfg.disabled || cfg.readOnly) { return; }
                self.option("value", null);
            });

            var searchTimer = null;
            this.$searchInput.on("input.qpxLookup", function () {
                var val = this.value;
                clearTimeout(searchTimer);
                searchTimer = setTimeout(function () {
                    self._searchText = (val.length >= (cfg.minSearchLength || 0)) ? val : "";
                    self._highlightIndex = -1;
                    self._renderList();
                }, cfg.searchTimeout);
            });

            this.$searchInput.on("keydown.qpxLookup", function (e) {
                if (e.key === "Escape") { self.close(); }
            });

            this.$closeIcon.on("click.qpxLookup", function () { self.close(); });

            this.$overlay.on("mousedown.qpxLookup", function (e) {
                if ($(e.target).is(self.$overlay)) { self.close(); }
            });

            this.$cancelBtn.on("click.qpxLookup", function () {
                self._pendingValue = self.config.value;
                self.close();
            });

            this.$doneBtn.on("click.qpxLookup", function () {
                self.option("value", self._pendingValue);
                self.close();
            });

            $(document).on("keydown.qpxLookup" + this.id, function (e) {
                if (self._isOpen && e.key === "Escape") { self.close(); }
            });
        },

        _renderField: function () {
            var cfg = this.config;
            var item = this._itemForValue(cfg.value);
            var text = (cfg.value !== null && cfg.value !== undefined)
                ? (item !== undefined ? this._displayOf(item) : String(cfg.value))
                : "";

            this.$input.val(text).attr("placeholder", cfg.placeholder);
            this.$clearBtn.toggle(!!cfg.showClearButton && cfg.value !== null && cfg.value !== undefined && !cfg.disabled && !cfg.readOnly);
        },

        // ---------------------------------------------------------------
        // Seznam položek v popupu
        // ---------------------------------------------------------------
        _renderList: function () {
            var self = this;
            var cfg = this.config;
            this.$list.empty();

            var items = this._filteredItems();
            var activeValue = (cfg.applyValueMode === "useButtons") ? this._pendingValue : cfg.value;

            if (!items.length) {
                this.$list.append($("<div class='qpx-lookup-nodata'></div>").text(cfg.noDataText));
                return;
            }

            items.forEach(function (item, idx) {
                var val = self._valueOf(item);
                var selected = val === activeValue;

                var $row = $("<div class='qpx-popup-list-item qpx-lookup-item'></div>")
                    .toggleClass("qpx-state-selected", selected)
                    .toggleClass("qpx-state-highlighted", idx === self._highlightIndex);

                if (qpx.isFunction(cfg.itemTemplate)) {
                    var res = cfg.itemTemplate.call(self, item, idx, $row[0]);
                    if (res !== undefined && res !== null) { $row.append(res); }
                } else {
                    $row.append($("<span class='qpx-lookup-item-text'></span>").text(self._displayOf(item)));
                }

                $row.on("click.qpxLookup", function () { self._chooseItem(item); });

                self.$list.append($row);
            });
        },

        _filteredItems: function () {
            var self = this;
            var cfg = this.config;
            var text = (this._searchText || "").toLowerCase();

            return (cfg.items || []).filter(function (item) {
                if (!text) { return true; }
                return self._displayOf(item).toLowerCase().indexOf(text) !== -1;
            });
        },

        // ---------------------------------------------------------------
        // Práce s hodnotou
        // ---------------------------------------------------------------
        _valueOf: function (item) {
            if (this.config.valueExpr && this.config.valueExpr !== "this") {
                return qpx.resolve(item, this.config.valueExpr);
            }
            return item;
        },

        _displayOf: function (item) {
            if (this.config.displayExpr) {
                var v = qpx.resolve(item, this.config.displayExpr);
                return (v === undefined || v === null) ? "" : String(v);
            }
            if (qpx.isObject(item)) { return item.text !== undefined ? String(item.text) : JSON.stringify(item); }
            return String(item);
        },

        _itemForValue: function (val) {
            var self = this;
            return (this.config.items || []).filter(function (it) { return self._valueOf(it) === val; })[0];
        },

        _chooseItem: function (item) {
            var val = this._valueOf(item);
            var cfg = this.config;

            if (cfg.applyValueMode === "useButtons") {
                this._pendingValue = val;
                this.trigger("selectionChanged", { selectedItem: item, component: this });
                this._renderList();
            } else {
                this.option("value", val);
                this.trigger("selectionChanged", { selectedItem: item, component: this });
                this.close();
            }
        },

        // ---------------------------------------------------------------
        // Popup otevřít/zavřít
        // ---------------------------------------------------------------
        open: function () {
            if (this.config.disabled || this.config.readOnly || this._isOpen) { return this; }
            if (openInstance && openInstance !== this) { openInstance.close(); }

            this._pendingValue = this.config.value;
            this._searchText = "";
            this.$searchInput.val("");
            this._renderList();

            this.$overlay.show();
            this._isOpen = true;
            this.$container.attr("aria-expanded", "true");
            openInstance = this;

            if (this.config.searchEnabled) { this.$searchInput.trigger("focus"); }

            this.trigger("opened", { component: this });
            return this;
        },

        close: function () {
            if (!this._isOpen) { return this; }
            this.$overlay.hide();
            this._isOpen = false;
            this._highlightIndex = -1;
            this.$container.attr("aria-expanded", "false");
            if (openInstance === this) { openInstance = null; }
            this.trigger("closed", { component: this });
            return this;
        },

        // ---------------------------------------------------------------
        // Veřejné API
        // ---------------------------------------------------------------
        value: function (val) {
            if (arguments.length === 0) { return this.config.value; }
            return this.option("value", val);
        },

        getSelectedItem: function () { return this._itemForValue(this.config.value); },
        getDataSource: function () { return this.config.items; },
        reset: function () { return this.option("value", null); },
        focus: function () { this.$input.trigger("focus"); return this; },
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
                case "value":
                    this._pendingValue = value;
                    this._renderField();
                    this.trigger("valueChanged", { value: value, previousValue: prev, component: this, element: this.getNode() });
                    break;

                case "items":
                case "dataSource":
                    this.config.items = value || [];
                    this._renderField();
                    if (this._isOpen) { this._renderList(); }
                    break;

                case "disabled":
                    this.$container.toggleClass("qpx-state-disabled", !!value);
                    this.$input.prop("disabled", !!value);
                    if (value) { this.close(); }
                    this._renderField();
                    break;

                case "readOnly":
                    this.$container.toggleClass("qpx-state-readonly", !!value);
                    if (value) { this.close(); }
                    break;

                case "visible":
                    this.$container.toggleClass("qpx-hidden", !value);
                    break;

                case "stylingMode":
                    this.$container.removeClass("qpx-lookup-mode-" + prev).addClass("qpx-lookup-mode-" + value);
                    break;

                case "placeholder":
                case "showClearButton":
                    this._renderField();
                    break;

                case "title":
                    this.$title.text(value);
                    break;

                case "searchEnabled":
                    this.$searchWrap.toggle(!!value);
                    break;

                case "searchPlaceholder":
                    this.$searchInput.attr("placeholder", value);
                    break;

                case "applyValueMode":
                    this.$footer.toggle(value === "useButtons");
                    break;

                case "cancelText":
                    this.$cancelBtn.text(value);
                    break;

                case "doneText":
                    this.$doneBtn.text(value);
                    break;

                case "noDataText":
                    if (this._isOpen) { this._renderList(); }
                    break;
            }

            this.trigger("optionChanged", { name: name, value: value, previousValue: prev, component: this });
            return this;
        },

        destroy: function () {
            this.$container.off(".qpxLookup");
            $(document).off(".qpxLookup" + this.id);
            if (this.$overlay) { this.$overlay.remove(); }
            if (openInstance === this) { openInstance = null; }
            this._super();
        }
    });

    qpx.registerWidget("qpLookup", Lookup);
    qpx.qpLookup = Lookup;

})(window.qpx, jQuery);

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

/*!
 * qpx - qpRibbonButton
 * Samostatné tlačítko určené výhradně pro položky qpRibbon (na rozdíl od
 * obecného qpButton má vlastní, přesně odměřený vzhled pro obě varianty
 * použité v pásu karet):
 *
 *   size: "large" - velké tlačítko přes celou výšku skupiny, ikona NAHOŘE,
 *                    text POD ní (např. Office "Vložit").
 *   size: "small" - kompaktní tlačítko v jedné řádce (ikona + text vedle
 *                    sebe), výška odpovídá přesně 1/3 dostupné výšky
 *                    skupiny, takže 3 tlačítka naskládaná pod sebe
 *                    (item.stack v qpRibbon) se vejdou beze zbytku a
 *                    nepřetékají mimo skupinu.
 *
 * options:
 *   text, icon (text/emoji glyph, nebo "css:trida-ikony"), size ("large"|"small"),
 *   disabled, visible, hint, onClick, onOptionChanged
 *
 * methods:
 *   option(name[, value]), enable(), disable(), focus(), destroy()
 *
 * events:
 *   onClick, onOptionChanged
 */
(function (qpx, $) {
    "use strict";

    var RibbonButton = qpx.Widget.extend({

        defaults: {
            text: "",
            icon: "",
            size: "small",        // large | small
            disabled: false,
            visible: true,
            hint: "",
            onClick: null,
            onOptionChanged: null
        },

        render: function () {
            var cfg = this.config;
            this.$container
                .addClass("qpx-ribbonbutton")
                .addClass("qpx-ribbonbutton-" + cfg.size)
                .toggleClass("qpx-state-disabled", !!cfg.disabled)
                .toggleClass("qpx-hidden", !cfg.visible)
                .attr("tabindex", cfg.disabled ? "-1" : "0")
                .attr("role", "button");

            if (cfg.onClick) { this.on("click", cfg.onClick); }
            if (cfg.onOptionChanged) { this.on("optionChanged", cfg.onOptionChanged); }

            this._renderContent();
            this._bindEvents();
        },

        _renderContent: function () {
            var cfg = this.config;
            this.$container.empty();

            if (cfg.icon) {
                var $icon = $("<span class='qpx-icon'></span>");
                if (String(cfg.icon).indexOf("css:") === 0) {
                    $icon.addClass(String(cfg.icon).slice(4));
                } else {
                    $icon.text(cfg.icon);
                }
                this.$container.append($icon);
            }
            if (cfg.text) {
                this.$container.append($("<span class='qpx-ribbonbutton-text'></span>").text(cfg.text));
            }
            if (cfg.hint) { this.$container.attr("title", cfg.hint); }
        },

        _bindEvents: function () {
            var self = this;

            this.$container.on("click.qpxRibbonButton", function (e) {
                if (self.config.disabled) { return; }
                self.trigger("click", { event: e, component: self, element: self.getNode() });
            });
            this.$container.on("keydown.qpxRibbonButton", function (e) {
                if (self.config.disabled) { return; }
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    self.$container.trigger("click");
                }
            });
        },

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

            if (name === "size") {
                this.$container.removeClass("qpx-ribbonbutton-" + prev).addClass("qpx-ribbonbutton-" + value);
            } else if (name === "disabled") {
                this.$container.toggleClass("qpx-state-disabled", !!value).attr("tabindex", value ? "-1" : "0");
            } else if (name === "visible") {
                this.$container.toggleClass("qpx-hidden", !value);
            } else {
                this._renderContent();
            }

            this.trigger("optionChanged", { name: name, value: value, previousValue: prev, component: this });
            return this;
        },

        enable: function () { return this.option("disabled", false); },
        disable: function () { return this.option("disabled", true); },
        focus: function () { this.$container.trigger("focus"); return this; },

        destroy: function () {
            this.$container.off(".qpxRibbonButton");
            this._super();
        }
    });

    qpx.registerWidget("qpRibbonButton", RibbonButton);
    qpx.qpRibbonButton = RibbonButton;

})(window.qpx, jQuery);

/*!
 * qpx - qpRibbonDropDownButton
 * Rozbalovací (příp. "split") tlačítko určené výhradně pro položky
 * qpRibbon - obdoba qpDropDownButton, ale s dvěma velikostmi ve stylu
 * MS Office přesně jako u qpRibbonButton:
 *
 *   size: "large" - ikona nahoře, pod ní pruh s textem a šipkou ▾
 *                    (u splitButton je horní ikonová část samostatná
 *                    klikací zóna s výchozí akcí, spodní pruh text+šipka
 *                    otevírá menu - přesně jako Office "Vložit ▾").
 *   size: "small" - kompaktní jedna řádka: ikona + text + šipka ▾
 *                    (u splitButton je ikona+text jedna klikací zóna
 *                    s výchozí akcí, šipka samostatná zóna pro menu).
 *
 * Výška "small" varianty je stejná jako u qpRibbonButton
 * ($qpx-ribbon-btn-small-height), takže se dá stejně jako on řadit
 * do svislého "mini-sloupce" (item.stack v qpRibbon).
 *
 * options:
 *   text, icon, size ("large"|"small"), items, keyExpr, displayExpr,
 *   splitButton, useSelectMode, selectedItemKey, disabled, visible, hint,
 *   dropDownOptions ({ width })
 *
 * events:
 *   onButtonClick, onItemClick, onSelectionChanged, onOptionChanged
 *
 * methods:
 *   option(name[, value]), enable(), disable(), destroy()
 */
(function (qpx, $) {
    "use strict";

    var openInstance = null; // aktuálně otevřená instance (jen jedna najednou)

    var RibbonDropDownButton = qpx.Widget.extend({

        defaults: {
            text: "",
            icon: "",
            size: "small",           // large | small

            items: [],               // [{ text, icon, key, disabled }]
            keyExpr: "key",
            displayExpr: "text",

            splitButton: false,      // true = samostatná ikonová zóna (výchozí akce) + zóna text/šipka (menu)
            useSelectMode: false,    // true = vybraná položka nahradí text tlačítka
            selectedItemKey: null,

            disabled: false,
            visible: true,
            hint: "",
            dropDownOptions: {},     // { width }

            onButtonClick: null,
            onItemClick: null,
            onSelectionChanged: null,
            onOptionChanged: null
        },

        // ---------------------------------------------------------------
        render: function () {
            var cfg = this.config;

            this.$container
                .addClass("qpx-ribbon-ddbutton")
                .addClass("qpx-ribbon-ddbutton-" + cfg.size)
                .toggleClass("qpx-ribbon-ddbutton-split", !!cfg.splitButton)
                .toggleClass("qpx-state-disabled", !!cfg.disabled)
                .toggleClass("qpx-hidden", !cfg.visible)
                .attr("tabindex", cfg.disabled ? "-1" : "0");

            if (cfg.onButtonClick) { this.on("buttonClick", cfg.onButtonClick); }
            if (cfg.onItemClick) { this.on("itemClick", cfg.onItemClick); }
            if (cfg.onSelectionChanged) { this.on("selectionChanged", cfg.onSelectionChanged); }
            if (cfg.onOptionChanged) { this.on("optionChanged", cfg.onOptionChanged); }

            this._isOpen = false;
            this._buildDom();
            this._bindEvents();
        },

        _keyOf: function (item, index) {
            return item[this.config.keyExpr] !== undefined ? item[this.config.keyExpr] : index;
        },
        _labelOf: function (item) {
            return item[this.config.displayExpr];
        },

        _currentText: function () {
            var cfg = this.config;
            if (cfg.useSelectMode && cfg.selectedItemKey !== null) {
                var self = this;
                var found = cfg.items.filter(function (it, i) { return self._keyOf(it, i) === cfg.selectedItemKey; })[0];
                if (found) { return this._labelOf(found); }
            }
            return cfg.text;
        },

        // ---------------------------------------------------------------
        // DOM - vždy stejná struktura (icon-zone + label-zone), rozdíl
        // mezi "large"/"small" a split/non-split řeší jen CSS + to, na
        // který element se pověsí které klikací chování (viz _bindEvents).
        // ---------------------------------------------------------------
        _buildDom: function () {
            var cfg = this.config;
            this.$container.empty();
            if (cfg.hint) { this.$container.attr("title", cfg.hint); }

            this.$iconZone = $("<span class='qpx-ribbon-ddbutton-iconzone'></span>");
            if (cfg.icon) {
                var $icon = $("<span class='qpx-icon'></span>");
                (String(cfg.icon).indexOf("css:") === 0) ? $icon.addClass(String(cfg.icon).slice(4)) : $icon.text(cfg.icon);
                this.$iconZone.append($icon);
            }

            this.$labelZone = $("<span class='qpx-ribbon-ddbutton-labelzone'></span>");
            this.$textEl = $("<span class='qpx-ribbonbutton-text'></span>").text(this._currentText());
            this.$arrowEl = $("<span class='qpx-ribbon-ddbutton-arrow'>▾</span>");
            this.$labelZone.append(this.$textEl, this.$arrowEl);

            this.$container.append(this.$iconZone, this.$labelZone);

            this.$menu = $("<div class='qpx-popup-list qpx-ribbon-ddbutton-menu'></div>").appendTo(document.body).hide();
            this._renderMenuItems();
        },

        _renderMenuItems: function () {
            var self = this;
            var cfg = this.config;
            this.$menu.empty();
            if (cfg.dropDownOptions && cfg.dropDownOptions.width) {
                this.$menu.css("width", qpx.toPx(cfg.dropDownOptions.width));
            }

            cfg.items.forEach(function (item, index) {
                var key = self._keyOf(item, index);
                var $row = $("<div class='qpx-popup-list-item'></div>")
                    .toggleClass("qpx-state-disabled", !!item.disabled)
                    .toggleClass("qpx-state-selected", cfg.useSelectMode && cfg.selectedItemKey === key);

                if (item.icon) {
                    var $icon = $("<span class='qpx-icon'></span>");
                    (String(item.icon).indexOf("css:") === 0) ? $icon.addClass(String(item.icon).slice(4)) : $icon.text(item.icon);
                    $row.append($icon);
                }
                $row.append($("<span></span>").text(self._labelOf(item)));

                $row.on("click", function (e) {
                    if (item.disabled) { return; }
                    self._close();
                    if (cfg.useSelectMode) {
                        var prevKey = cfg.selectedItemKey;
                        cfg.selectedItemKey = key;
                        self.$textEl.text(self._currentText());
                        self.trigger("selectionChanged", { item: item, key: key, previousKey: prevKey, component: self });
                    }
                    self.trigger("itemClick", { event: e, itemData: item, itemIndex: index, component: self });
                });

                self.$menu.append($row);
            });
        },

        // ---------------------------------------------------------------
        _bindEvents: function () {
            var self = this;
            var cfg = this.config;

            if (cfg.splitButton) {
                this.$iconZone.on("click.qpxRibbonDdb", function (e) {
                    if (self.config.disabled) { return; }
                    self._close();
                    self.trigger("buttonClick", { event: e, component: self, element: self.getNode() });
                });
                this.$labelZone.on("click.qpxRibbonDdb", function (e) {
                    if (self.config.disabled) { return; }
                    e.stopPropagation();
                    self._toggle();
                });
            } else {
                this.$container.on("click.qpxRibbonDdb", function (e) {
                    if (self.config.disabled) { return; }
                    self._toggle();
                    self.trigger("buttonClick", { event: e, component: self, element: self.getNode() });
                });
            }

            this.$container.on("keydown.qpxRibbonDdb", function (e) {
                if (self.config.disabled) { return; }
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    self._toggle();
                }
            });

            $(document).on("mousedown.qpxRibbonDdb" + this.id, function (e) {
                if (!self._isOpen) { return; }
                if ($(e.target).closest(self.$menu).length || $(e.target).closest(self.$container).length) { return; }
                self._close();
            });
        },

        _toggle: function () { this._isOpen ? this._close() : this._open(); },

        _open: function () {
            if (openInstance && openInstance !== this) { openInstance._close(); }
            var off = this.$container.offset();
            this.$menu.css({
                top: off.top + this.$container.outerHeight(),
                left: off.left,
                minWidth: this.$container.outerWidth()
            }).show();
            this._isOpen = true;
            openInstance = this;
            this.trigger("opened", { component: this });
        },

        _close: function () {
            if (!this._isOpen) { return; }
            this.$menu.hide();
            this._isOpen = false;
            if (openInstance === this) { openInstance = null; }
            this.trigger("closed", { component: this });
        },

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
            if (prev === value) { return this; }
            this.config[name] = value;

            switch (name) {
                case "size":
                    this.$container.removeClass("qpx-ribbon-ddbutton-" + prev).addClass("qpx-ribbon-ddbutton-" + value);
                    break;

                case "disabled":
                    this.$container.toggleClass("qpx-state-disabled", !!value).attr("tabindex", value ? "-1" : "0");
                    break;

                case "visible":
                    this.$container.toggleClass("qpx-hidden", !value);
                    break;

                case "splitButton":
                    this.$container.toggleClass("qpx-ribbon-ddbutton-split", !!value);
                    this.$iconZone.off(".qpxRibbonDdb");
                    this.$labelZone.off(".qpxRibbonDdb");
                    this.$container.off(".qpxRibbonDdb click");
                    this._bindEvents();
                    break;

                case "items":
                case "dropDownOptions":
                    this._renderMenuItems();
                    break;

                default:
                    this._buildDom();
                    this._bindEvents();
            }

            this.trigger("optionChanged", { name: name, value: value, previousValue: prev, component: this });
            return this;
        },

        enable: function () { return this.option("disabled", false); },
        disable: function () { return this.option("disabled", true); },

        destroy: function () {
            this.$container.off(".qpxRibbonDdb");
            if (this.$iconZone) { this.$iconZone.off(".qpxRibbonDdb"); }
            if (this.$labelZone) { this.$labelZone.off(".qpxRibbonDdb"); }
            $(document).off(".qpxRibbonDdb" + this.id);
            if (this.$menu) { this.$menu.remove(); }
            if (openInstance === this) { openInstance = null; }
            this._super();
        }
    });

    qpx.registerWidget("qpRibbonDropDownButton", RibbonDropDownButton);
    qpx.qpRibbonDropDownButton = RibbonDropDownButton;

})(window.qpx, jQuery);

/*!
 * qpx - qpTreeView
 * Stromová struktura inspirovaná DevExtreme dxTreeView.
 *  - items: [{ id, parentId, text, icon, expanded, selected, disabled }]
 *  - selectionMode: "single" | "multiple"
 *  - expandEvent: "click" | "dblclick"
 *  - showCheckBoxesMode: "none" | "normal" | "selectAll"
 *  - dragEnabled: true/false (drag & drop mezi uzly)
 *  - cascadeCheck: true/false (parent → children)
 *  - useIndeterminate: true/false (partial selection)
 *  - události: onItemClick, onSelectionChanged, onItemExpanded, onItemCollapsed,
 *              onOptionChanged, onDragStart, onDragEnter, onDragLeave,
 *              onDragOver, onDrop, onReorder, onMove
 */

(function (qpx, $) {
    "use strict";

    var TreeView = qpx.Widget.extend({

        defaults: {
            items: [],
            keyExpr: "id",
            parentIdExpr: "parentId",
            displayExpr: "text",
            selectionMode: "single",
            expandEvent: "click",
            showCheckBoxesMode: "none", // none | normal | selectAll
            disabled: false,
            visible: true,

            dragEnabled: false,
            cascadeCheck: false,
            useIndeterminate: true,

            onItemClick: null,
            onSelectionChanged: null,
            onItemExpanded: null,
            onItemCollapsed: null,
            onOptionChanged: null,

            onDragStart: null,
            onDragEnter: null,
            onDragLeave: null,
            onDragOver: null,
            onDrop: null,
            onReorder: null,
            onMove: null
        },

        render: function () {
            var cfg = this.config;

            this.$container
                .addClass("qpx-treeview")
                .toggleClass("qpx-hidden", !cfg.visible)
                .toggleClass("qpx-state-disabled", !!cfg.disabled)
                .attr("role", "tree");

            if (cfg.onItemClick) this.on("itemClick", cfg.onItemClick);
            if (cfg.onSelectionChanged) this.on("selectionChanged", cfg.onSelectionChanged);
            if (cfg.onItemExpanded) this.on("itemExpanded", cfg.onItemExpanded);
            if (cfg.onItemCollapsed) this.on("itemCollapsed", cfg.onItemCollapsed);
            if (cfg.onOptionChanged) this.on("optionChanged", cfg.onOptionChanged);

            if (cfg.onDragStart) this.on("dragStart", cfg.onDragStart);
            if (cfg.onDragEnter) this.on("dragEnter", cfg.onDragEnter);
            if (cfg.onDragLeave) this.on("dragLeave", cfg.onDragLeave);
            if (cfg.onDragOver) this.on("dragOver", cfg.onDragOver);
            if (cfg.onDrop) this.on("drop", cfg.onDrop);
            if (cfg.onReorder) this.on("reorder", cfg.onReorder);
            if (cfg.onMove) this.on("move", cfg.onMove);

            this._selectedKeys = [];
            this._expandedKeys = [];

            this._indexItems();
            this._renderTree();

            if (cfg.dragEnabled) {
                this._enableDragDrop();
            }
        },

        _indexItems: function () {
            var cfg = this.config;
            var key = cfg.keyExpr;
            var parent = cfg.parentIdExpr;

            this._map = {};
            this._children = {};
            this._selectedKeys = [];
            this._expandedKeys = [];

            (cfg.items || []).forEach(function (item) {
                var id = item[key];
                var pid = item[parent];

                this._map[id] = item;
                this._children[pid] = this._children[pid] || [];
                this._children[pid].push(item);

                if (item.expanded) this._expandedKeys.push(id);
                if (item.selected) this._selectedKeys.push(id);

            }.bind(this));
        },

        _renderTree: function () {
            this.$container.empty();
            var roots = this._children[null] || this._children[undefined] || [];
            var $ul = $("<ul class='qpx-tree-root'></ul>");
            this._renderNodes($ul, roots);
            this.$container.append($ul);
        },

        _renderNodes: function ($parent, items) {
            var self = this;
            items.forEach(function (item) {
                var id = item[self.config.keyExpr];
                var text = item[self.config.displayExpr];
                var disabled = !!item.disabled;
                var expanded = self._expandedKeys.indexOf(id) !== -1;
                var selected = self._selectedKeys.indexOf(id) !== -1;

                var $li = $("<li class='qpx-tree-item' role='treeitem'></li>")
                    .attr("data-key", id)
                    .toggleClass("qpx-state-disabled", disabled)
                    .toggleClass("qpx-state-selected", selected)
                    .toggleClass("qpx-expanded", expanded);

                var $row = $("<div class='qpx-tree-row'></div>");
                if (self.config.dragEnabled && !disabled) {
                    $row.attr("draggable", "true");
                }

                var hasChildren = !!self._children[id];
                var $toggle = $("<span class='qpx-tree-toggle'></span>")
                    .text(hasChildren ? (expanded ? "▾" : "▸") : "")
                    .toggleClass("qpx-tree-toggle-empty", !hasChildren);

                var $checkbox = null;
                if (self.config.showCheckBoxesMode !== "none") {
                    $checkbox = $("<input type='checkbox' class='qpx-tree-checkbox' />")
                        .prop("checked", selected)
                        .prop("disabled", disabled);
                }

                var $icon = null;
                if (item.icon) {
                    $icon = $("<span class='qpx-tree-icon'></span>");
                    if (String(item.icon).indexOf("css:") === 0)
                        $icon.addClass(String(item.icon).slice(4));
                    else
                        $icon.text(item.icon);
                }

                var $text = $("<span class='qpx-tree-text'></span>").text(text);

                $row.append($toggle);
                if ($checkbox) $row.append($checkbox);
                if ($icon) $row.append($icon);
                $row.append($text);

                $li.append($row);

                $toggle.on(self.config.expandEvent + ".qpxTree", function () {
                    if (disabled || !hasChildren) return;
                    self._toggleExpand(id, $li);
                });

                $row.on("click.qpxTree", function () {
                    if (disabled) return;
                    var checked = !$li.hasClass("qpx-state-selected");
                    self._handleSelection(id, item, $li, checked);
                    if (self.config.cascadeCheck && self.config.showCheckBoxesMode !== "none") {
                        self._cascadeToChildren(id, checked);
                        if (self.config.useIndeterminate) {
                            self._updateParentIndeterminate(id);
                        }
                    }
                    self.trigger("itemClick", { itemData: item, key: id, component: self });
                });

                if ($checkbox) {
                    $checkbox.on("change.qpxTree", function () {
                        if (disabled) return;

                        var checked = $checkbox.prop("checked");

                        self._handleSelection(id, item, $li, checked);

                        if (self.config.cascadeCheck) {
                            self._cascadeToChildren(id, checked);
                        }

                        if (self.config.useIndeterminate) {
                            self._updateParentIndeterminate(id);
                        }
                    });
                }

                if (hasChildren) {
                    var $ul = $("<ul class='qpx-tree-children'></ul>")
                        .toggle(expanded);
                    self._renderNodes($ul, self._children[id]);
                    $li.append($ul);
                }

                $parent.append($li);
            });
        },

        _toggleExpand: function (id, $li) {
            var expanded = $li.hasClass("qpx-expanded");
            $li.toggleClass("qpx-expanded", !expanded);
            $li.children("ul.qpx-tree-children").slideToggle(120);

            if (!expanded) {
                if (this._expandedKeys.indexOf(id) === -1) this._expandedKeys.push(id);
                this.trigger("itemExpanded", { key: id, component: this });
            } else {
                this._expandedKeys = this._expandedKeys.filter(function (k) { return k !== id; });
                this.trigger("itemCollapsed", { key: id, component: this });
            }
        },

        _handleSelection: function (id, item, $li, checked) {
            var mode = this.config.selectionMode;
            var prev = this._selectedKeys.slice();

            if (mode === "single") {
                this._selectedKeys = checked ? [id] : [];
            } else {
                var idx = this._selectedKeys.indexOf(id);
                if (checked && idx === -1) this._selectedKeys.push(id);
                if (!checked && idx !== -1) this._selectedKeys.splice(idx, 1);
            }

            this.$container.find(".qpx-tree-item").removeClass("qpx-state-selected");
            this._selectedKeys.forEach(function (k) {
                this.$container.find("[data-key='" + k + "']").addClass("qpx-state-selected");
            }.bind(this));

            this.trigger("selectionChanged", {
                selectedItemKeys: this._selectedKeys.slice(),
                previousItemKeys: prev,
                component: this
            });
        },

        _cascadeToChildren: function (id, checked) {
            var self = this;
            var children = this._children[id];
            if (!children) return;

            children.forEach(function (child) {
                var childId = child[self.config.keyExpr];

                var idx = self._selectedKeys.indexOf(childId);
                if (checked && idx === -1) self._selectedKeys.push(childId);
                if (!checked && idx !== -1) self._selectedKeys.splice(idx, 1);

                var $childItem = self.$container.find("[data-key='" + childId + "']");
                var $checkbox = $childItem.find(".qpx-tree-checkbox");
                if ($checkbox.length) {
                    $checkbox.prop("checked", checked);
                    $checkbox.prop("indeterminate", false);
                }

                self._cascadeToChildren(childId, checked);
            });

            this.$container.find(".qpx-tree-item").removeClass("qpx-state-selected");
            this._selectedKeys.forEach(function (k) {
                this.$container.find("[data-key='" + k + "']").addClass("qpx-state-selected");
            }.bind(this));
        },

        _updateParentIndeterminate: function (id) {
            var parentId = this._map[id][this.config.parentIdExpr];
            if (parentId === null || parentId === undefined) return;

            var children = this._children[parentId];
            if (!children) return;

            var selectedCount = 0;
            var childCount = children.length;

            children.forEach(function (child) {
                var childId = child[this.config.keyExpr];
                if (this._selectedKeys.indexOf(childId) !== -1) {
                    selectedCount++;
                }
            }.bind(this));

            var $parentItem = this.$container.find("[data-key='" + parentId + "']");
            var $checkbox = $parentItem.find(".qpx-tree-checkbox");

            if (!$checkbox.length) return;

            if (selectedCount === 0) {
                $checkbox.prop("checked", false);
                $checkbox.prop("indeterminate", false);
            } else if (selectedCount === childCount) {
                $checkbox.prop("checked", true);
                $checkbox.prop("indeterminate", false);
            } else {
                $checkbox.prop("checked", false);
                $checkbox.prop("indeterminate", true);
            }

            this._updateParentIndeterminate(parentId);
        },

        _enableDragDrop: function () {
            var self = this;

            this.$container.on("dragstart.qpxTree", ".qpx-tree-row", function (e) {
                var $row = $(this);
                var $item = $row.closest(".qpx-tree-item");
                var key = $item.data("key");

                e.originalEvent.dataTransfer.effectAllowed = "move";
                e.originalEvent.dataTransfer.setData("text/plain", key);

                $item.addClass("qpx-tree-dragging");

                self.trigger("dragStart", { key, item: self._map[key], component: self });
            });

            this.$container.on("dragend.qpxTree", ".qpx-tree-row", function () {
                self.$container.find(".qpx-tree-dragging").removeClass("qpx-tree-dragging");
                self.$container.find(".qpx-tree-drop-target")
                    .removeClass("qpx-tree-drop-target qpx-tree-drop-above qpx-tree-drop-below qpx-tree-drop-inside");
            });

            this.$container.on("dragenter.qpxTree", ".qpx-tree-row", function (e) {
                e.preventDefault();
                var $row = $(this);
                var $item = $row.closest(".qpx-tree-item");
                $item.addClass("qpx-tree-drop-target");

                var key = $item.data("key");
                self.trigger("dragEnter", { key, item: self._map[key], component: self });
            });

            this.$container.on("dragleave.qpxTree", ".qpx-tree-row", function () {
                var $item = $(this).closest(".qpx-tree-item");
                $item.removeClass("qpx-tree-drop-target qpx-tree-drop-above qpx-tree-drop-below qpx-tree-drop-inside");

                var key = $item.data("key");
                self.trigger("dragLeave", { key, item: self._map[key], component: self });
            });

            this.$container.on("dragover.qpxTree", ".qpx-tree-row", function (e) {
                e.preventDefault();

                var $row = $(this);
                var $item = $row.closest(".qpx-tree-item");
                var offset = $row.offset();
                var y = e.originalEvent.clientY - offset.top;

                $item.removeClass("qpx-tree-drop-above qpx-tree-drop-below qpx-tree-drop-inside");

                if (y < 8) {
                    $item.addClass("qpx-tree-drop-above");
                } else if (y > $row.outerHeight() - 8) {
                    $item.addClass("qpx-tree-drop-below");
                } else {
                    $item.addClass("qpx-tree-drop-inside");
                }

                var key = $item.data("key");
                self.trigger("dragOver", { key, item: self._map[key], component: self });
            });

            this.$container.on("drop.qpxTree", ".qpx-tree-row", function (e) {
                e.preventDefault();

                var $targetRow = $(this);
                var $targetItem = $targetRow.closest(".qpx-tree-item");
                var targetKey = $targetItem.data("key");

                var sourceKey = e.originalEvent.dataTransfer.getData("text/plain");
                var sourceItem = self._map[sourceKey];
                var targetItem = self._map[targetKey];

                var dropType = $targetItem.hasClass("qpx-tree-drop-above") ? "above"
                    : $targetItem.hasClass("qpx-tree-drop-below") ? "below"
                    : "inside";

                self._performDrop(sourceKey, targetKey, dropType);

                self.trigger("drop", {
                    sourceKey,
                    targetKey,
                    dropType,
                    sourceItem,
                    targetItem,
                    component: self
                });
            });
        },

        _performDrop: function (sourceKey, targetKey, dropType) {
            var cfg = this.config;
            var keyExpr = cfg.keyExpr;
            var parentExpr = cfg.parentIdExpr;

            var source = this._map[sourceKey];
            var target = this._map[targetKey];

            if (!source || !target) return;

            var oldParent = source[parentExpr];

            if (dropType === "inside") {
                source[parentExpr] = target[keyExpr];

                this.trigger("move", {
                    sourceKey,
                    targetKey,
                    newParent: target[keyExpr],
                    oldParent,
                    component: this
                });
            } else {
                var siblings = this._children[target[parentExpr]] || [];
                var targetIndex = siblings.indexOf(target);

                var sourceSiblings = this._children[source[parentExpr]];
                if (sourceSiblings) {
                    var idx = sourceSiblings.indexOf(source);
                    if (idx !== -1) sourceSiblings.splice(idx, 1);
                }

                source[parentExpr] = target[parentExpr];

                siblings = this._children[target[parentExpr]] || [];
                if (dropType === "above") {
                    siblings.splice(targetIndex, 0, source);
                } else {
                    siblings.splice(targetIndex + 1, 0, source);
                }

                this.trigger("reorder", {
                    sourceKey,
                    targetKey,
                    dropType,
                    newParent: target[parentExpr],
                    oldParent,
                    component: this
                });
            }

            this._indexItems();
            this._renderTree();
            if (this.config.dragEnabled) this._enableDragDrop();
        },

        option: function (name, value) {
            if (arguments.length === 0) return this.config;
            if (qpx.isObject(name)) {
                var self = this;
                $.each(name, function (k, v) { self.option(k, v); });
                return this;
            }
            if (arguments.length === 1) return this.config[name];

            var prev = this.config[name];
            if (prev === value) return this;

            this.config[name] = value;

            if (name === "items") {
                this._indexItems();
                this._renderTree();
                if (this.config.dragEnabled) this._enableDragDrop();
            } else if (name === "visible") {
                this.$container.toggleClass("qpx-hidden", !value);
            } else if (name === "disabled") {
                this.$container.toggleClass("qpx-state-disabled", !!value);
            } else if (name === "dragEnabled") {
                this.$container.off(".qpxTree");
                this._renderTree();
                if (value) this._enableDragDrop();
            }

            this.trigger("optionChanged", { name, value, previousValue: prev });
            return this;
        },

        destroy: function () {
            this.$container.off(".qpxTree");
            this._super();
        }
    });

    qpx.registerWidget("qpTreeView", TreeView);
    qpx.qpTreeView = TreeView;

})(window.qpx, jQuery);

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

/*!
 * qpx - qpSyntaxEditor
 * Obálka nad Ace Editorem (https://ace.c9.io) - editor kódu se zvýrazňováním
 * syntaxe (JavaScript, SQL, JSON, HTML/CSS, Python, ...), integrovaná do
 * qpx frameworku stejným způsobem, jakým Webix zapouzdřuje widgety třetích
 * stran (vlastní view, vlastní kontejner, syncování hodnoty/rozměrů,
 * proxy na nativní API, úklid v destroy()).
 *
 * Na rozdíl od ostatních qpx widgetů se Ace Editor NENAČÍTÁ staticky
 * <script> tagem předem - qpSyntaxEditor si ho při první instanci sám
 * dynamicky stáhne (a využije vestavěný dynamický loader Ace pro
 * mode-*.js/theme-*.js/ext-*.js soubory). Container se proto vykreslí
 * ihned (se stavem "načítání"), samotná instance Ace je k dispozici až
 * po dokončení načtení - viz event "contentReady" / metoda isReady().
 *
 * Umístění knihovny (analogie k /devel/libs/qpx, /devel/libs/jquery)
 * se nastavuje staticky před vytvořením první instance:
 *
 *   qpx.qpSyntaxEditor.configure({ basePath: "/devel/libs/ace/" });
 *   // nebo per-instance přepsáním options.basePath
 *
 * options:
 *   value (string), mode ("javascript"|"sql"|"json"|"html"|"css"|"xml"|
 *     "python"|"php"|"csharp"|"java"|"yaml"|"markdown"|"text" nebo přímo
 *     "ace/mode/xxx"), theme ("light"|"dark" - namapováno
 *     na Ace témata "chrome"/"tomorrow_night" - nebo přímo název/"ace/theme/xxx"),
 *   autoTheme (při theme:null odvodí světlé/tmavé téma z nejbližšího
 *     předka se třídou "qpx-theme-light/dark"),
 *   placeholder, fontSize, tabSize, useSoftTabs, wrap, showGutter,
 *   showPrintMargin, printMarginColumn, highlightActiveLine, showInvisibles,
 *   minLines, maxLines, autocomplete (lazy-load ext-language_tools),
 *   keyboardHandler (null|"vim"|"emacs"|"sublime"),
 *   basePath (přepíše statické qpx.qpSyntaxEditor.basePath jen pro tuto instanci),
 *   disabled, readOnly, visible, height (výchozí 240 - Ace potřebuje explicitní výšku)
 *
 * events:
 *   onInitialized, onContentReady (voláno až PO úspěšném načtení Ace a
 *     vytvoření instance - obsahuje i "editor": nativní objekt Ace),
 *   onValueChanged, onFocusIn, onFocusOut, onOptionChanged,
 *   onLoadError (nepodařilo se stáhnout Ace), onDisposing
 *
 * methods:
 *   option(name[, value]), value([val]), focus(), blur(), reset(),
 *   enable(), disable(), resize(), insert(text), gotoLine(line[, column]),
 *   undo(), redo(), setAnnotations(list), clearAnnotations(),
 *   getEditor() - vrátí nativní instanci Ace (přímý přístup ke třetí straně),
 *   isReady(), destroy()
 *
 * statické (qpx.qpSyntaxEditor.*):
 *   basePath - výchozí cesta ke souborům Ace,
 *   configure({ basePath }) - pohodlná změna basePath pro všechny další instance
 */
(function (qpx, $) {
    "use strict";

    var MODE_ALIASES = {
        js: "javascript", ts: "typescript",
        json: "json", html: "html", htm: "html",
        css: "css", scss: "scss", less: "less",
        xml: "xml", sql: "sql", python: "python", py: "python",
        java: "java", csharp: "csharp", cs: "csharp", php: "php",
        yaml: "yaml", yml: "yaml", markdown: "markdown", md: "markdown",
        text: "text", plain_text: "text", plaintext: "text",
        sh: "sh", bash: "sh", c_cpp: "c_cpp", cpp: "c_cpp"
    };

    var THEME_ALIASES = {
        "light": "chrome",
        "dark": "tomorrow_night"
    };

    // sdílený loader - stačí jedno stažení ace.js na basePath, i pro víc instancí
    var loadPromises = {};

    function ensureAce(basePath) {
        if (window.ace) {
            window.ace.config.set("basePath", basePath);
            window.ace.config.set("modePath", basePath);
            window.ace.config.set("themePath", basePath);
            return $.Deferred().resolve(window.ace).promise();
        }
        if (loadPromises[basePath]) { return loadPromises[basePath]; }

        var dfd = $.Deferred();
        var script = document.createElement("script");
        script.src = basePath + "ace.js";
        script.async = true;
        script.onload = function () {
            window.ace.config.set("basePath", basePath);
            window.ace.config.set("modePath", basePath);
            window.ace.config.set("themePath", basePath);
            dfd.resolve(window.ace);
        };
        script.onerror = function () {
            dfd.reject(new Error("qpx.qpSyntaxEditor: nepodařilo se načíst Ace Editor ze souboru '" + script.src + "'."));
        };
        document.head.appendChild(script);
        loadPromises[basePath] = dfd.promise();
        return loadPromises[basePath];
    }

    // =====================================================================
    var SyntaxEditor = qpx.Widget.extend({

        defaults: {
            value: "",
            mode: "text",
            theme: null,        // null = odvodí se dle autoTheme, jinak "light"/"dark" nebo název Ace tématu
            autoTheme: true,

            placeholder: "",

            fontSize: 13,
            tabSize: 4,
            useSoftTabs: true,
            wrap: false,
            showGutter: true,
            showPrintMargin: false,
            printMarginColumn: 80,
            highlightActiveLine: true,
            showInvisibles: false,

            minLines: null,
            maxLines: null,

            autocomplete: false,
            keyboardHandler: null, // null | "vim" | "emacs" | "sublime"

            basePath: null,     // přepíše qpx.qpSyntaxEditor.basePath jen pro tuto instanci
            height: 240,        // Ace potřebuje explicitní výšku kontejneru

            disabled: false,
            readOnly: false,
            visible: true,

            onValueChanged: null,
            onOptionChanged: null,
            onInitialized: null,
            onContentReady: null,
            onFocusIn: null,
            onFocusOut: null,
            onLoadError: null,
            onDisposing: null
        },

        // ---------------------------------------------------------------
        render: function () {
            var cfg = this.config;
            var self = this;

            this._editor = null;
            this._aceReady = false;
            this._resizeObserver = null;
            this._suppressChange = false;

            this.$container
                .addClass("qpx-syntaxeditor")
                .toggleClass("qpx-hidden", !cfg.visible)
                .toggleClass("qpx-state-disabled", !!cfg.disabled)
                .toggleClass("qpx-state-readonly", !!cfg.readOnly);

            if (cfg.onInitialized) { this.on("ready", cfg.onInitialized); }
            if (cfg.onContentReady) { this.on("contentReady", cfg.onContentReady); }
            if (cfg.onValueChanged) { this.on("valueChanged", cfg.onValueChanged); }
            if (cfg.onOptionChanged) { this.on("optionChanged", cfg.onOptionChanged); }
            if (cfg.onFocusIn) { this.on("focusIn", cfg.onFocusIn); }
            if (cfg.onFocusOut) { this.on("focusOut", cfg.onFocusOut); }
            if (cfg.onLoadError) { this.on("loadError", cfg.onLoadError); }
            if (cfg.onDisposing) { this.on("destroy", cfg.onDisposing); }

            this.$host = $("<div class='qpx-syntaxeditor-host'></div>");
            this.$placeholder = $("<div class='qpx-syntaxeditor-placeholder'></div>").hide();
            this.$overlay = $("<div class='qpx-syntaxeditor-overlay'></div>");
            this.$overlayText = $("<span></span>");
            this.$overlay.append(this.$overlayText);

            this.$container.append(this.$host, this.$placeholder, this.$overlay);

            this._showOverlay("Načítání editoru...", false);

            var basePath = cfg.basePath || this.constructor.basePath;

            ensureAce(basePath)
                .done(function (ace) { self._initAce(ace); })
                .fail(function (err) {
                    self._showOverlay((err && err.message) || "Editor se nepodařilo načíst.", true);
                    self.trigger("loadError", { error: err, component: self });
                });
        },

        _showOverlay: function (text, isError) {
            this.$overlayText.text(text);
            this.$overlay.toggleClass("qpx-syntaxeditor-overlay-error", !!isError).show();
        },

        _hideOverlay: function () {
            this.$overlay.hide();
        },

        // ---------------------------------------------------------------
        // Inicializace nativní instance Ace (volá se asynchronně po načtení)
        // ---------------------------------------------------------------
        _initAce: function (ace) {
            var cfg = this.config;
            var self = this;

            var editor = ace.edit(this.$host[0]);
            this._editor = editor;

            editor.setTheme(this._resolveTheme());
            editor.session.setMode(this._resolveMode());
            editor.setFontSize(cfg.fontSize);
            editor.setReadOnly(!!cfg.readOnly || !!cfg.disabled);
            editor.setShowPrintMargin(!!cfg.showPrintMargin);
            editor.setPrintMarginColumn(cfg.printMarginColumn);
            editor.setHighlightActiveLine(!!cfg.highlightActiveLine);
            editor.setShowInvisibles(!!cfg.showInvisibles);
            editor.renderer.setShowGutter(cfg.showGutter !== false);
            editor.session.setTabSize(cfg.tabSize);
            editor.session.setUseSoftTabs(cfg.useSoftTabs !== false);
            editor.session.setUseWrapMode(!!cfg.wrap);
            if (cfg.minLines) { editor.setOption("minLines", cfg.minLines); }
            if (cfg.maxLines) { editor.setOption("maxLines", cfg.maxLines); }
            if (cfg.keyboardHandler) { editor.setKeyboardHandler("ace/keyboard/" + cfg.keyboardHandler); }

            this._suppressChange = true;
            editor.setValue(cfg.value || "", -1); // -1 = kurzor na začátek (bez ozn. celého textu)
            this._suppressChange = false;

            if (cfg.autocomplete) { this._applyAutocomplete(true); }

            this._bindAceEvents();

            if (window.ResizeObserver) {
                this._resizeObserver = new ResizeObserver(function () {
                    if (self._editor) { self._editor.resize(); }
                });
                this._resizeObserver.observe(this.$host[0]);
            }

            this._aceReady = true;
            this._hideOverlay();
            this._updatePlaceholder();

            this.trigger("contentReady", { component: this, editor: editor });
        },

        _applyAutocomplete: function (enabled) {
            var editor = this._editor;
            if (!editor) { return; }
            if (enabled) {
                try { window.ace.require("ace/ext/language_tools"); } catch (e) { /* dotáhne se dynamicky přes basePath */ }
                editor.setOptions({ enableBasicAutocompletion: true, enableLiveAutocompletion: true, enableSnippets: true });
            } else {
                editor.setOptions({ enableBasicAutocompletion: false, enableLiveAutocompletion: false, enableSnippets: false });
            }
        },

        _bindAceEvents: function () {
            var self = this;
            var editor = this._editor;

            editor.session.on("change", function () {
                if (self._suppressChange) { return; }
                var val = editor.getValue();
                if (val === self.config.value) { return; }
                var prev = self.config.value;
                self.config.value = val;
                self._updatePlaceholder();
                self.trigger("valueChanged", { value: val, previousValue: prev, component: self, editor: editor });
            });

            editor.on("focus", function () {
                self.$container.addClass("qpx-state-focused");
                self._updatePlaceholder();
                self.trigger("focusIn", { component: self, editor: editor });
            });

            editor.on("blur", function () {
                self.$container.removeClass("qpx-state-focused");
                self._updatePlaceholder();
                self.trigger("focusOut", { component: self, editor: editor });
            });
        },

        _updatePlaceholder: function () {
            var cfg = this.config;
            var isEmpty = !cfg.value || cfg.value.length === 0;
            var isFocused = this.$container.hasClass("qpx-state-focused");
            this.$placeholder.text(cfg.placeholder || "").toggle(!!cfg.placeholder && isEmpty && !isFocused);
        },

        _resolveMode: function () {
            var m = this.config.mode || "text";
            if (m.indexOf("ace/mode/") === 0) { return m; }
            return "ace/mode/" + (MODE_ALIASES[m] || m);
        },

        _resolveTheme: function () {
            var cfg = this.config;
            var raw = cfg.theme;

            if (!raw && cfg.autoTheme) {
                var isDark = this.$container.closest(".qpx-theme-dark").length > 0 ||
                    this.$container.hasClass("qpx-theme-dark");
                raw = isDark ? "dark" : "light";
            }
            raw = raw || "light";

            if (raw.indexOf("ace/theme/") === 0) { return raw; }
            return "ace/theme/" + (THEME_ALIASES[raw] || raw);
        },

        // ---------------------------------------------------------------
        // Veřejné API
        // ---------------------------------------------------------------
        value: function (val) {
            if (arguments.length === 0) { return this.config.value; }
            return this.option("value", val);
        },

        focus: function () { if (this._editor) { this._editor.focus(); } return this; },
        blur: function () { if (this._editor) { this._editor.blur(); } return this; },
        reset: function () { return this.option("value", ""); },
        enable: function () { return this.option("disabled", false); },
        disable: function () { return this.option("disabled", true); },

        resize: function () { if (this._editor) { this._editor.resize(true); } return this; },
        insert: function (text) { if (this._editor) { this._editor.insert(text); } return this; },
        gotoLine: function (line, column) { if (this._editor) { this._editor.gotoLine(line, column || 0, true); } return this; },
        undo: function () { if (this._editor) { this._editor.undo(); } return this; },
        redo: function () { if (this._editor) { this._editor.redo(); } return this; },
        setAnnotations: function (list) { if (this._editor) { this._editor.session.setAnnotations(list || []); } return this; },
        clearAnnotations: function () { if (this._editor) { this._editor.session.clearAnnotations(); } return this; },

        getEditor: function () { return this._editor; },
        isReady: function () { return !!this._aceReady; },

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

            var editor = this._editor;

            switch (name) {
                case "value":
                    if (editor) {
                        this._suppressChange = true;
                        var pos = editor.getCursorPosition();
                        editor.setValue(value || "", -1);
                        try { editor.moveCursorToPosition(pos); } catch (e) { /* mimo rozsah nového textu - ignorovat */ }
                        this._suppressChange = false;
                    }
                    this._updatePlaceholder();
                    this.trigger("valueChanged", { value: value, previousValue: prev, component: this, editor: editor });
                    break;

                case "mode":
                    if (editor) { editor.session.setMode(this._resolveMode()); }
                    break;

                case "theme":
                    if (editor) { editor.setTheme(this._resolveTheme()); }
                    break;

                case "autoTheme":
                    if (editor && !this.config.theme) { editor.setTheme(this._resolveTheme()); }
                    break;

                case "fontSize":
                    if (editor) { editor.setFontSize(value); }
                    break;

                case "tabSize":
                    if (editor) { editor.session.setTabSize(value); }
                    break;

                case "useSoftTabs":
                    if (editor) { editor.session.setUseSoftTabs(!!value); }
                    break;

                case "wrap":
                    if (editor) { editor.session.setUseWrapMode(!!value); }
                    break;

                case "showGutter":
                    if (editor) { editor.renderer.setShowGutter(!!value); }
                    break;

                case "showPrintMargin":
                    if (editor) { editor.setShowPrintMargin(!!value); }
                    break;

                case "printMarginColumn":
                    if (editor) { editor.setPrintMarginColumn(value); }
                    break;

                case "highlightActiveLine":
                    if (editor) { editor.setHighlightActiveLine(!!value); }
                    break;

                case "showInvisibles":
                    if (editor) { editor.setShowInvisibles(!!value); }
                    break;

                case "minLines":
                case "maxLines":
                    if (editor) { editor.setOption(name, value); }
                    break;

                case "autocomplete":
                    this._applyAutocomplete(!!value);
                    break;

                case "keyboardHandler":
                    if (editor) { editor.setKeyboardHandler(value ? ("ace/keyboard/" + value) : null); }
                    break;

                case "disabled":
                    this.$container.toggleClass("qpx-state-disabled", !!value);
                    if (editor) { editor.setReadOnly(!!value || !!this.config.readOnly); }
                    break;

                case "readOnly":
                    this.$container.toggleClass("qpx-state-readonly", !!value);
                    if (editor) { editor.setReadOnly(!!value || !!this.config.disabled); }
                    break;

                case "visible":
                    this.$container.toggleClass("qpx-hidden", !value);
                    if (value) { this.resize(); }
                    break;

                case "placeholder":
                    this._updatePlaceholder();
                    break;
            }

            this.trigger("optionChanged", { name: name, value: value, previousValue: prev, component: this });
            return this;
        },

        destroy: function () {
            if (this._resizeObserver) { this._resizeObserver.disconnect(); this._resizeObserver = null; }
            if (this._editor) { this._editor.destroy(); this._editor = null; }
            this._super();
        }

    }, {
        // --- statické členy (qpx.Class podporuje statiku podobně jako Java) ---
        basePath: "/devel/libs/ace/",
        configure: function (opts) {
            if (opts && opts.basePath) { this.basePath = opts.basePath; }
        }
    });

    qpx.registerWidget("qpSyntaxEditor", SyntaxEditor);
    qpx.qpSyntaxEditor = SyntaxEditor;

})(window.qpx, jQuery);

/*!
 * qpx - parser
 * Umožňuje definovat komponenty třemi způsoby:
 *
 *  1) JSON skládání (viz qpx.ui/qpx.Layout):
 *       qpx.ui({ rows: [ {view:"template", template:"Ahoj"} ] }, "#app");
 *
 *  2) Napojení na konkrétní HTML element (jako kendoUI / easyUI):
 *       $("#box").qpx("template", { template: "Ahoj #name#" });
 *       // nebo:
 *       $("#box").qpx({ view: "template", template: "Ahoj" });
 *
 *  3) Deklarativně přes data-qpx-* atributy přímo v HTML (jako metro UI CSS):
 *       <div data-qpx-view="template" data-qpx-template="Ahoj #name#"></div>
 *       qpx.parse(); // proskenuje dokument a vše inicializuje
 */
(function (qpx, $) {
    "use strict";

    // převede "data-qpx-auto-height" -> "autoHeight"
    function toCamelCase(str) {
        return str.replace(/-([a-z0-9])/g, function (_, c) { return c.toUpperCase(); });
    }

    // načte všechny data-qpx-* atributy jednoho elementu do konfiguračního objektu.
    // Hodnoty se pokusí naparsovat jako JSON (čísla, booleany, objekty, pole),
    // pokud to nejde, použije se jako obyčejný string.
    qpx.parseAttrs = function (el) {
        var config = {};
        var attrs = el.attributes;
        for (var i = 0; i < attrs.length; i++) {
            var attr = attrs[i];
            var m = attr.name.match(/^data-qpx-(.+)$/);
            if (!m || m[1] === "id") { continue; }

            var key = toCamelCase(m[1]);
            var raw = attr.value;
            var value;
            try {
                value = JSON.parse(raw);
            } catch (e) {
                value = raw;
            }
            config[key] = value;
        }
        if (el.id) { config.id = config.id || el.id; }
        return config;
    };

    // proskenuje strom (celý dokument, nebo zadaný kořen) a inicializuje
    // všechny dosud neinicializované elementy s atributem data-qpx-view
    qpx.parse = function (root) {
        var $scope = root ? $(root) : $(document);
        var $found = $scope.find("[data-qpx-view]");
        if ($scope.is && $scope.is("[data-qpx-view]")) { $found = $found.add($scope); }

        $found.each(function () {
            if ($(this).data("qpx-widget")) { return; } // už inicializováno
            var cfg = qpx.parseAttrs(this);
            qpx.ui(cfg, this);
        });
        return qpx;
    };

    // vrátí instanci komponenty napojenou na daný element (nebo undefined)
    qpx.$find = function (el) {
        return $(el).data("qpx-widget");
    };

    // -----------------------------------------------------------------
    // jQuery plugin — napojení komponenty přímo na konkrétní element(y)
    // -----------------------------------------------------------------
    $.fn.qpx = function (view, config) {
        var cfg;
        if (qpx.isString(view)) {
            cfg = $.extend({ view: view }, config || {});
        } else {
            cfg = view || {};
        }

        var result = this;
        this.each(function () {
            var widget = qpx.ui(cfg, this);
            $(this).data("qpx-widget", widget);
        });
        return result;
    };

    // po načtení DOM automaticky zpracuje deklarativně zapsané komponenty,
    // pokud si to vývojář výslovně nevypne (qpx.autoParse = false;)
    $(function () {
        if (qpx.autoParse !== false) {
            qpx.parse(document);
        }
    });

})(window.qpx, jQuery);
