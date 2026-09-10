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
