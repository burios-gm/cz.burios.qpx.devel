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
