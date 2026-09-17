<%@ page contentType="text/html; charset=UTF-8" pageEncoding="UTF-8" language="java" %>
<!DOCTYPE html>
<html lang="cs">
	<head>
		<meta charset="UTF-8">
		<meta name="viewport" content="width=device-width, initial-scale=1">

		<title>${appTitle}</title>

		<link rel="icon" href="/devel/favicon.png">
		<link rel="stylesheet" href="/devel/libs/fonts/fontawesome/4.7/css/font-awesome.min.css" type="text/css" media="all" />
		<link rel="stylesheet" href="/devel/libs/qpx/themes/jquery.qpx.default.css?build=${ timeNo }" rel="stylesheet" type="text/css">
		<link rel="stylesheet" href="/devel/api/qpx-test.css?build=${timeNo}">

		<script type="text/javascript" src="/devel/libs/jquery/jquery-3.7.1.js"></script>
		<script type="text/javascript" src="/devel/libs/qpx/jquery.qpx.all.js?build=${timeNo}"></script>
		<script type="text/javascript" src="/devel/api/qpx-test.js?build=${timeNo}"></script>
	</head>
	<body class="qpx-view">
		<div class="qpx-test-topbar1">
			<div id="pageTopbar" style="width: 100%"></div>
		</div>

		<div class="qpx-test-content">
			<header class="page-head">
				<h1>qpSyntaxEditor</h1>
				<p class="subtitle">Zvýrazňování syntaxe nad Ace Editorem — integrace widgetu třetí strany do QPX (Ace se donačte dynamicky z <code>/devel/libs/ace/1.33.0/</code>).</p>
			</header>
			<main>
				<div id="pageToolbar"></div>

				<div class="demo-block">
					<h2>1) JavaScript, s automatickým doplňováním (autocomplete)</h2>
					<p class="desc">mode: "javascript", autocomplete: true, onValueChanged.</p>
					<div id="editor1"></div>
					<div class="value-out" id="out1"></div>
				</div>
				<div class="demo-block">
					<h2>2) SQL</h2>
					<p class="desc">mode: "sql", showPrintMargin, tlačítko demonstrující přímý přístup k nativní instanci Ace (getEditor()).</p>
					<div id="editor2"></div>
					<div class="demo-actions">
						<button type="button" id="btnInsertSql">Vložit "SELECT * FROM "</button>
						<button type="button" id="btnFormatUpper">Klíčová slova VELKÝMI (getEditor())</button>
					</div>
				</div>
				<div class="demo-block">
					<h2>3) JSON — automatická výška (minLines/maxLines) a zalamování</h2>
					<p class="desc">mode: "json", wrap: true, minLines: 4, maxLines: 14 (výška roste s obsahem).</p>
					<div id="editor3"></div>
				</div>
				<div class="demo-block">
					<h2>4) disabled / readOnly</h2>
					<div id="editor4"></div>
					<div id="editor4b" style="margin-top: 12px;"></div>
				</div>
			</main>
		</div>

		<script>
		var widgetName = "qpSyntaxEditor";

		// Cesta ke knihovně Ace - analogie k /devel/libs/qpx, /devel/libs/jquery.
		// Musí být nastaveno před vytvořením první instance qpSyntaxEditor.
		qpx.qpSyntaxEditor.configure({ basePath: "/devel/libs/ace/1.33.0/" });

		$(function () {
		    // -----------------------------------------------------------------
		    // 1) JavaScript + autocomplete
		    // -----------------------------------------------------------------
		    var editor1 = qpx.ui({
		        view: "qpSyntaxEditor",
		        height: 200,
		        mode: "javascript",
		        autocomplete: true,
		        value: "function soucet(a, b) {\n    return a + b;\n}\n\nconsole.log(soucet(2, 3));",
		        onValueChanged: function (e) {
		            $("#out1").text(e.value);
		        },
		        onContentReady: function (e) {
		            $("#out1").text(e.component.value());
		        }
		    }, "#editor1");

		    // -----------------------------------------------------------------
		    // 2) SQL + přímý přístup na nativní Ace instanci
		    // -----------------------------------------------------------------
		    var editor2 = qpx.ui({
		        view: "qpSyntaxEditor",
		        height: 160,
		        mode: "sql",
		        showPrintMargin: true,
		        printMarginColumn: 60,
		        value: "SELECT id, nazev, cena\nFROM produkty\nWHERE aktivni = 1\nORDER BY nazev;"
		    }, "#editor2");

		    $("#btnInsertSql").on("click", function () {
		        editor2.insert("SELECT * FROM ");
		        editor2.focus();
		    });

		    $("#btnFormatUpper").on("click", function () {
		        // ukázka přímého volání nativního Ace API přes getEditor()
		        var nativeEditor = editor2.getEditor();
		        if (!nativeEditor) { return; }
		        var keywords = ["select", "from", "where", "order by", "insert", "update", "delete"];
		        var text = nativeEditor.getValue();
		        keywords.forEach(function (kw) {
		            text = text.replace(new RegExp("\\b" + kw + "\\b", "gi"), kw.toUpperCase());
		        });
		        editor2.value(text);
		    });

		    // -----------------------------------------------------------------
		    // 3) JSON s automatickým růstem výšky
		    // -----------------------------------------------------------------
		    var editor3 = qpx.ui({
		        view: "qpSyntaxEditor",
		        mode: "json",
		        wrap: true,
		        minLines: 4,
		        maxLines: 14,
		        showGutter: true,
		        value: JSON.stringify({ id: 1, nazev: "Ukázka", polozky: ["a", "b", "c"], aktivni: true }, null, 4)
		    }, "#editor3");

		    // -----------------------------------------------------------------
		    // 4) disabled / readOnly
		    // -----------------------------------------------------------------
		    var editor4 = qpx.ui({
		        view: "qpSyntaxEditor",
		        height: 120,
		        mode: "text",
		        disabled: true,
		        value: "Needitovatelný obsah (disabled)."
		    }, "#editor4");

		    var editor4b = qpx.ui({
		        view: "qpSyntaxEditor",
		        height: 120,
		        mode: "text",
		        readOnly: true,
		        value: "Jen ke čtení (readOnly) - lze označit a zkopírovat."
		    }, "#editor4b");

		    // -----------------------------------------------------------------
		    // Horní panel: přepínač tématu (light/dark) + zalamování řádků
		    //
		    // Téma se přepíná JEDINÝM místem — třídou qpx-theme-light/
		    // -dark na <body>. Díky dědičnosti CSS proměnných (--qpx-bg,
		    // --qpx-text, --qpx-border, ...) se automaticky obarví jak
		    // widgety, tak okolní obsah stránky (nadpisy, .value-out, topbar).
		    // U qpSyntaxEditoru navíc voláme ed.option("theme", ...), protože
		    // Ace Editor má svůj VLASTNÍ, samostatný systém témat (na CSS
		    // proměnných frameworku nezávislý) — to je jediný widget na téhle
		    // stránce, který takové zvláštní zacházení potřebuje.
		    // -----------------------------------------------------------------
		    var allEditors = [editor1, editor2, editor3, editor4, editor4b];
			/*
			function applyTheme(themeKey) {
				$("body")
					.removeClass("qpx-theme-light qpx-theme-dark")
					.addClass("qpx-theme-" + themeKey);
				$("body").toggleClass("qpx-page-dark", themeClass === "qpx-theme-dark");
				toolbar.option("theme", themeKey);
			}
			*/
			function applyWrap(wrapOn) {
				allEditors.forEach(function (ed) { ed.option("wrap", wrapOn); });
			}

			var toolbar = qpx.ui({
				view: "qpToolBar",
				items: [{
					location: "before", widget: "template",
					template: "<b style='padding:0 4px;'>Téma:</b>"
				}, {
					location: "before",
					widget: "buttonGroup",
					options: {
						items: [
							{ text: "Světlé", key: "light" },
							{ text: "Tmavé", key: "dark" }
						],
						selectedItemKeys: ["light"],
						onSelectionChanged: function (e) {
							var key = e.component.getSelectedItemKeys()[0] || "light";
							applyTheme(key);
						}
					}
				}, {
					location: "after", widget: "buttonGroup",
					options: {
						items: [
							{ text: "Bez zalamování", key: false },
							{ text: "Zalamovat řádky", key: true }
						],
						selectedItemKeys: [false],
						onSelectionChanged: function (e) {
							var wrapOn = !!e.component.getSelectedItemKeys()[0];
							// applyWrap(wrapOn);
						}
					}
				}]
			}, "#pageToolbar");
			// applyTheme("light");
		});
		</script>
	</body>
</html>
