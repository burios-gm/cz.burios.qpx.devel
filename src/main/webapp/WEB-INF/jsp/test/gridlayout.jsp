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

		<script type="text/javascript">var widgetName = "qpGridLayout";</script>
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
				<i class="qpxicon qpxicon-gridlayout"></i>
				<h1>qpGridLayout – test</h1>
				<p class="subtitle">Rozkládací kontejner nad nativním CSS Gridem — analogie Webix GridLayout, včetně slučování buněk.</p>
			</header>
			<div class="toolbar-wrap">
				<div id="pageToolbar"></div>
			</div>
			<main>
				<div class="demo-block">
					<h2>1) Základní mřížka — pevné i pružné sloupce</h2>
					<p class="desc">columns: [140, "1fr", 100], řádky auto, buňky se umísťují automaticky (autoFlow: "row").</p>
					<div id="gridlayout1" style="height: 120px;"></div>
				</div>

				<div class="demo-block">
					<h2>2) Sloučené buňky (colSpan / rowSpan)</h2>
					<p class="desc">
						Klasické "dashboard" rozvržení: záhlaví přes celou šířku (colSpan: 3), postranní
						panel přes dva řádky (rowSpan: 2), hlavní obsah a patička — to, co flexbox sám
						neumí, ale CSS Grid ano.
					</p>
					<div id="gridlayout2" style="height: 220px;"></div>
				</div>

				<div class="demo-block">
					<h2>3) Responzivní mřížka (výchozí columns)</h2>
					<p class="desc">
						columns není zadané — použije se výchozí repeat(auto-fit, minmax(120px, 1fr)),
						počet sloupců se sám přepočítává podle šířky komponenty (žádný JS listener na
						resize). Zkuste zmenšit okno prohlížeče.
					</p>
					<div id="gridlayout3"></div>
				</div>

				<div class="demo-block">
					<h2>4) Vnořené GridLayouty a kombinace s qpFlexLayout</h2>
					<p class="desc">Buňka může být sama qpGridLayout nebo qpFlexLayout — skládání do stromu stejně jako u qpFlexLayout.</p>
					<div id="gridlayout4" style="height: 180px;"></div>
				</div>

				<div class="demo-block">
					<h2>5) Spacer buňky, debug obrys, skrytí buňky</h2>
					<p class="desc">Prázdná buňka {} = vyhrazené prázdné místo v mřížce; debug: true vykreslí obrys a pořadové číslo každé buňky.</p>
					<div class="demo-actions">
						<button type="button" id="btnToggleDebug">Přepnout debug</button>
						<button type="button" id="btnToggleCell">Skrýt/zobrazit prostřední buňku</button>
					</div>
					<div id="gridlayout5" style="height: 130px; margin-top: 10px;"></div>
				</div>
			</main>
		</div>

		<script>
		var widgetName = "qpGridLayout";
		$(function () {
			function cardContent(i) {
				return "<div style='padding:10px;background:var(--qpx-surface,#f8f9fb);border:1px solid var(--qpx-border,#d3d9df);border-radius:4px;height:100%;box-sizing:border-box;'>Buňka " + i + "</div>";
			}

			// -----------------------------------------------------------------
			// 1) základní mřížka - pevné i pružné sloupce
			// -----------------------------------------------------------------
			var gridlayout1 = qpx.ui({
				view: "qpGridLayout",
				columns: [140, "1fr", 100],
				gap: 8,
				items: [1, 2, 3, 4, 5, 6].map(function (i) { return { content: cardContent(i) }; })
			}, "#gridlayout1");

			// -----------------------------------------------------------------
			// 2) sloučené buňky - dashboard rozvržení
			// -----------------------------------------------------------------
			var gridlayout2 = qpx.ui({
				view: "qpGridLayout",
				columns: [160, "1fr", "1fr"],
				rows: [50, "1fr", 40],
				gap: 8,
				items: [
					{
						content: "<div style='padding:10px;background:var(--qpx-accent,#337ab7);color:#fff;border-radius:4px;height:100%;box-sizing:border-box;display:flex;align-items:center;'><b>Záhlaví (colSpan: 3)</b></div>",
						col: 0, row: 0, colSpan: 3
					},
					{
						content: "<div style='padding:10px;background:var(--qpx-surface,#f8f9fb);border:1px solid var(--qpx-border,#d3d9df);border-radius:4px;height:100%;box-sizing:border-box;'><b>Menu</b><br>Položka 1<br>Položka 2</div>",
						col: 0, row: 1, rowSpan: 2
					},
					{ content: cardContent("obsah 1"), col: 1, row: 1 },
					{ content: cardContent("obsah 2"), col: 2, row: 1 },
					{
						content: "<div style='padding:10px;background:var(--qpx-surface,#f8f9fb);border:1px solid var(--qpx-border,#d3d9df);border-radius:4px;height:100%;box-sizing:border-box;color:var(--qpx-text-muted,#767676);'>Patička (colSpan: 2)</div>",
						col: 1, row: 2, colSpan: 2
					}
				]
			}, "#gridlayout2");

			// -----------------------------------------------------------------
			// 3) responzivní mřížka - výchozí columns (auto-fit)
			// -----------------------------------------------------------------
			var gridlayout3 = qpx.ui({
				view: "qpGridLayout",
				gap: 8,
				items: Array.from({ length: 10 }, function (_, i) { return { content: cardContent(i + 1) }; })
			}, "#gridlayout3");

			// -----------------------------------------------------------------
			// 4) vnořené GridLayouty a qpFlexLayout
			// -----------------------------------------------------------------
			var gridlayout4 = qpx.ui({
				view: "qpGridLayout",
				columns: ["1fr", "1fr"],
				gap: 8,
				items: [
					{
						view: "qpGridLayout",
						columns: ["1fr", "1fr"],
						rows: ["1fr", "1fr"],
						gap: 6,
						items: [
							{ content: cardContent("A1") },
							{ content: cardContent("A2") },
							{ content: cardContent("A3"), colSpan: 2 }
						]
					},
					{
						view: "qpFlexLayout",
						direction: "column",
						gap: 6,
						items: [
							{ content: cardContent("B1") },
							{ content: cardContent("B2"), grow: 1 }
						]
					}
				]
			}, "#gridlayout4");

			// -----------------------------------------------------------------
			// 5) spacer buňky, debug obrys, skrytí buňky
			// -----------------------------------------------------------------
			var gridlayout5 = qpx.ui({
				view: "qpGridLayout",
				columns: [90, "1fr", 90, "1fr", 90],
				rows: ["1fr"],
				gap: 8,
				items: [
					{ content: cardContent(1) },
					{}, // spacer
					{ content: cardContent(2) },
					{}, // spacer
					{ content: cardContent(3) }
				]
			}, "#gridlayout5");

			$("#btnToggleDebug").on("click", function () {
				gridlayout5.option("debug", !gridlayout5.option("debug"));
			});
			$("#btnToggleCell").on("click", function () {
				var items = gridlayout5.items().slice();
				items[2] = $.extend({}, items[2], { hidden: !items[2].hidden });
				gridlayout5.option("items", items);
			});

			// -----------------------------------------------------------------
			// Horní panel: přepínač tématu (aplikuje se na celý .qpx-test-content)
			// -----------------------------------------------------------------
			/*
			function applyTheme(themeClass) {
				$(".qpx-test-content")
					.removeClass("qpx-theme-light qpx-theme-dark")
					.addClass(themeClass);
				toolbar.option("theme", themeClass.replace("qpx-theme-", ""));
				// zpětně kompatibilní přepínač pro topbar (viz qpx-test.css)
				$("body").toggleClass("qpx-page-dark", themeClass === "qpx-theme-dark");
			}
			*/
			var toolbar = qpx.ui({
				view: "qpToolBar",
				items: [{
					location: "before", widget: "template",
					template: "<b style='padding:0 4px;'>Styl:</b>"
				}, {
					location: "before",
					widget: "qpDropDownButton",
					options: {
						items: [
							{ text: "Světlé", key: "light" },
							{ text: "Tmavé", key: "dark" }
						],
						selectedItemKeys: ["light"],
						onSelectionChanged: function (e) {
							var key = e.component.getSelectedItemKeys()[0] || "light";
							applyTheme("qpx-theme-" + key);
						}
					}
				}]
			}, "#pageToolbar");

			// applyTheme("qpx-theme-light");
		});
		</script>
	</body>
</html>
