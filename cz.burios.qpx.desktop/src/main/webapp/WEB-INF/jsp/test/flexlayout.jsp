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

		<script type="text/javascript">var widgetName = "qpFlexLayout";</script>
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
				<i class="qpxicon qpxicon-circle"></i>
				<h1>qpFlexLayout – test</h1>
				<p class="subtitle">Rozkládací kontejner nad CSS flexboxem — analogie Webix FlexLayout.</p>
			</header>
			<div class="toolbar-wrap">
				<div id="pageToolbar"></div>
			</div>
			<main>
				<div class="demo-block">
					<h2>1) Řádek — pevná šířka + grow (vnořené widgety)</h2>
					<p class="desc">direction: "row", buňky s width (pevné), grow (roztažitelné) a vnořenými qpx widgety (qpButton, qpTextBox).</p>
					<div id="flexlayout1" style="height: 40px;"></div>
				</div>

				<div class="demo-block">
					<h2>2) Sloupec — postranní panel + obsah</h2>
					<p class="desc">direction: "row" s pevným postranním panelem (width) a obsahem (grow: 1), uvnitř obsahu vnořený qpFlexLayout s direction: "column".</p>
					<div id="flexlayout2" style="height: 160px;"></div>
				</div>

				<div class="demo-block">
					<h2>3) Živá ukázka — wrap / justify / align</h2>
					<p class="desc">Karty pevné šířky, zalamování a zarovnání se mění ovládacími prvky níže (žádný JS listener na resize — vše čisté CSS).</p>
					<div class="demo-actions">
						<label>direction:
							<select id="ctlDirection">
								<option value="row" selected>row</option>
								<option value="row-reverse">row-reverse</option>
								<option value="column">column</option>
							</select>
						</label>
						<label>wrap:
							<select id="ctlWrap">
								<option value="true" selected>wrap</option>
								<option value="false">nowrap</option>
							</select>
						</label>
						<label>justify:
							<select id="ctlJustify">
								<option value="start" selected>start</option>
								<option value="center">center</option>
								<option value="end">end</option>
								<option value="space-between">space-between</option>
								<option value="space-around">space-around</option>
								<option value="space-evenly">space-evenly</option>
							</select>
						</label>
						<label>align:
							<select id="ctlAlign">
								<option value="stretch" selected>stretch</option>
								<option value="start">start</option>
								<option value="center">center</option>
								<option value="end">end</option>
							</select>
						</label>
					</div>
					<div id="flexlayout3" style="height: 180px; border: 1px dashed var(--qpx-border, #d3d9df); margin-top: 10px;"></div>
				</div>

				<div class="demo-block">
					<h2>4) Vnořené FlexLayouty</h2>
					<p class="desc">Skládání do stromu — buňka může být sama qpFlexLayout (view: "qpFlexLayout") s vlastním direction/gap.</p>
					<div id="flexlayout4" style="height: 140px;"></div>
				</div>

				<div class="demo-block">
					<h2>5) Spacer buňky, debug obrys, skrytí buňky</h2>
					<p class="desc">Prázdná buňka {} = pružná mezera; debug: true vykreslí obrys a pořadové číslo každé buňky.</p>
					<div class="demo-actions">
						<button type="button" id="btnToggleDebug">Přepnout debug</button>
						<button type="button" id="btnToggleCell">Skrýt/zobrazit prostřední buňku</button>
					</div>
					<div id="flexlayout5" style="height: 50px; margin-top: 10px;"></div>
				</div>
			</main>
		</div>

		<script>
		var widgetName = "qpFlexLayout";
		$(function () {
			// -----------------------------------------------------------------
			// 1) řádek s pevnou šířkou + grow, vnořené qpx widgety
			// -----------------------------------------------------------------
			var flexlayout1 = qpx.ui({
				view: "qpFlexLayout",
				direction: "row",
				align: "center",
				gap: 8,
				items: [
					{ content: "<b>Filtr:</b>", width: 60 },
					{ view: "qpTextBox", placeholder: "Hledat...", stylingMode: "outlined", grow: 1 },
					{ view: "qpButton", text: "Hledat", width: 90 }
				]
			}, "#flexlayout1");

			// -----------------------------------------------------------------
			// 2) postranní panel + obsah (vnořený sloupcový qpFlexLayout)
			// -----------------------------------------------------------------
			var flexlayout2 = qpx.ui({
				view: "qpFlexLayout",
				direction: "row",
				gap: 0,
				items: [
					{
						content:
							"<div style='padding:10px;background:var(--qpx-surface,#f8f9fb);height:100%;box-sizing:border-box;'>" +
							"<b>Menu</b><br>Položka 1<br>Položka 2<br>Položka 3</div>",
						width: 140
					},
					{
						view: "qpFlexLayout",
						direction: "column",
						gap: 8,
						grow: 1,
						items: [
							{ content: "<div style='padding:10px;'><b>Nadpis obsahu</b></div>", height: 40 },
							{
								content: "<div style='padding:0 10px;color:var(--qpx-text-muted,#767676);'>Hlavní obsah roztažený přes zbývající výšku (grow: 1).</div>",
								grow: 1
							}
						]
					}
				]
			}, "#flexlayout2");

			// -----------------------------------------------------------------
			// 3) živá ukázka - wrap/justify/align ovládané selecty
			// -----------------------------------------------------------------
			function cardContent(i) {
				return "<div style='padding:10px;background:var(--qpx-surface,#f8f9fb);border:1px solid var(--qpx-border,#d3d9df);border-radius:4px;'>Karta " + i + "</div>";
			}
			var flexlayout3 = qpx.ui({
				view: "qpFlexLayout",
				direction: "row",
				wrap: true,
				justify: "start",
				align: "stretch",
				gap: 10,
				padding: 10,
				items: [1, 2, 3, 4, 5, 6, 7, 8].map(function (i) {
					return { content: cardContent(i), width: 120 };
				})
			}, "#flexlayout3");

			$("#ctlDirection").on("change", function () { flexlayout3.option("direction", $(this).val()); });
			$("#ctlWrap").on("change", function () { flexlayout3.option("wrap", $(this).val() === "true"); });
			$("#ctlJustify").on("change", function () { flexlayout3.option("justify", $(this).val()); });
			$("#ctlAlign").on("change", function () { flexlayout3.option("align", $(this).val()); });

			// -----------------------------------------------------------------
			// 4) vnořené FlexLayouty
			// -----------------------------------------------------------------
			var flexlayout4 = qpx.ui({
				view: "qpFlexLayout",
				direction: "row",
				gap: 10,
				items: [
					{
						view: "qpFlexLayout",
						direction: "column",
						gap: 6,
						grow: 1,
						items: [
							{ content: cardContent("A1") },
							{ content: cardContent("A2") }
						]
					},
					{
						view: "qpFlexLayout",
						direction: "column",
						gap: 6,
						grow: 2,
						items: [
							{ content: cardContent("B1") },
							{
								view: "qpFlexLayout",
								direction: "row",
								gap: 6,
								grow: 1,
								items: [
									{ content: cardContent("B2a") },
									{ content: cardContent("B2b") }
								]
							}
						]
					}
				]
			}, "#flexlayout4");

			// -----------------------------------------------------------------
			// 5) spacer buňky, debug obrys, skrytí buňky
			// -----------------------------------------------------------------
			var flexlayout5 = qpx.ui({
				view: "qpFlexLayout",
				direction: "row",
				align: "center",
				gap: 8,
				items: [
					{ content: cardContent(1), width: 90 },
					{}, // spacer - pružná mezera
					{ content: cardContent(2), width: 90 },
					{}, // spacer
					{ content: cardContent(3), width: 90 }
				]
			}, "#flexlayout5");

			$("#btnToggleDebug").on("click", function () {
				flexlayout5.option("debug", !flexlayout5.option("debug"));
			});
			$("#btnToggleCell").on("click", function () {
				var items = flexlayout5.items().slice();
				items[2] = $.extend({}, items[2], { hidden: !items[2].hidden });
				flexlayout5.option("items", items);
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
							// applyTheme("qpx-theme-" + key);
						}
					}
				}]
			}, "#pageToolbar");

			applyTheme("qpx-theme-light");
		});
		</script>
	</body>
</html>
