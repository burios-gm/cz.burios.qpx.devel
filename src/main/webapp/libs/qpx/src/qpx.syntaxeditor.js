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
