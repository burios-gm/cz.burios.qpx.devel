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
				<i class="qpxicon qpxicon-circle"></i>
				<h1>qpRibbon – test</h1>
				<p class="subtitle">Pás karet ve stylu MS Office 365 online — přepracování původního jquery.ribbon.js na qpx widget skládaný z dalších qpx widgetů (qpRibbonButton, qpRibbonDropDownButton, qpTextBox, qpNumberBox, qpCheckBox).</p>
			</header>
			<div class="toolbar-wrap">
				<div id="pageToolbar"></div>
			</div>
			<main>
				<div class="demo-block">
					<h2>1) Ribbon s kartami Domů / Vložení / Zobrazení</h2>
					<p class="desc">Skupiny Schránka / Písmo / Odstavec, velké tlačítko, "mini-sloupec" (stack) malých tlačítek, split tlačítko, textbox + numberbox pro písmo, oddělovač.</p>
					<div id="ribbon1"></div>
					<div class="value-out" id="out1"></div>
				</div>
				<div class="demo-block">
					<h2>2) Přístup k jednotlivým položkám jako k widgetům</h2>
					<p class="desc">getItemWidget(tabKey, groupKey, itemIndex) vrátí skutečnou instanci qpx widgetu (zde qpCheckBox "Tučné") - lze na ní volat běžné API (value(), option()...).</p>
					<button type="button" id="btnToggleBold">Přepnout "Tučné" (přes getItemWidget)</button>
					<div class="value-out" id="out2"></div>
				</div>
				<div class="demo-block">
					<h2>3) disabled</h2>
					<div id="ribbon2"></div>
				</div>
			</main>
		</div>

		<script>
		var widgetName = "qpRibbon";
		
		$(function () {
		    // -----------------------------------------------------------------
		    // 1) hlavní demo - Domů / Vložení / Zobrazení
		    // -----------------------------------------------------------------
		    var ribbon1 = qpx.ui({
		        view: "qpRibbon",
		        activeTabKey: "home",
		        tabs: [{
					key: "home", 
					text: "Domů",
					groups: [{
						key: "clipboard", title: "Schránka",
						items: [
							{ widget: "qpRibbonButton", size: "large", options: { text: "Vložit", icon: "📋", onClick: function () { logClick("Vložit"); } } },
							{ widget: "qpRibbonButton", stack: true, options: { text: "Kopírovat", icon: "📄", onClick: function () { logClick("Kopírovat"); } } },
							{ widget: "qpRibbonButton", stack: true, options: { text: "Vyjmout", icon: "✂", onClick: function () { logClick("Vyjmout"); } } },
							{ widget: "qpRibbonButton", stack: true, options: { text: "Kopie formátu", icon: "🖌", onClick: function () { logClick("Kopie formátu"); } } },
							{ type: "separator" },
							{
								widget: "qpRibbonDropDownButton",
								size: "large",
								options: {
									text: "Vložit jinak", icon: "📋", splitButton: true,
									items: [
										{ text: "Vložit jako hodnoty" },
										{ text: "Vložit jako formát" },
										{ text: "Vložit odkaz" }
									],
									onButtonClick: function () { logClick("Vložit jinak"); },
									onItemClick: function (e) { logClick("Vložit jinak → " + e.itemData.text); }
								}
							}
						]
					}, {
						key: "font", 
						title: "Písmo",
						items: [
							{ widget: "qpTextBox", options: { width: 92, value: "Calibri", stylingMode: "outlined" } },
							{ widget: "qpNumberBox", options: { width: 46, value: 11, min: 1, max: 400, showSpinButtons: false, stylingMode: "outlined" } },
							{ type: "separator" },
							{ widget: "qpRibbonButton", stack: true, options: { text: "Tučné", icon: "B", onClick: function () { logClick("Tučné"); } } },
							{ widget: "qpRibbonButton", stack: true, options: { text: "Kurzíva", icon: "I", onClick: function () { logClick("Kurzíva"); } } }
						]
					}, {
						key: "paragraph", 
						title: "Odstavec",
						items: [
							{ widget: "qpCheckBox", options: { text: "Tučné", value: false, onValueChanged: function (e) { logClick("Tučné (checkbox): " + e.value); } } },
							{ widget: "qpRibbonButton", stack: true, options: { text: "Zarovnat vlevo", icon: "⯇", onClick: function () { logClick("Zarovnat vlevo"); } } },
							{
								widget: "qpRibbonDropDownButton", 
								stack: true,
								options: {
									text: "Odrážky", icon: "≡",
									items: [
										{ text: "Odrážky - kolečko" },
										{ text: "Odrážky - čtverec" },
										{ text: "Číslování" }
									],
									useSelectMode: true,
									onSelectionChanged: function (e) { logClick("Odrážky → " + e.item.text); }
								}
							}
						]
					}]
				}, {
					key: "insert", 
					text: "Vložení",
					groups: [{
						key: "tables", 
						title: "Tabulky",
						items: [
						    { widget: "qpRibbonButton", size: "large", options: { text: "Tabulka", icon: "▦", onClick: function () { logClick("Tabulka"); } } }
						]
					}, {
						key: "media", title: "Média",
						items: [
							{ widget: "qpRibbonButton", size: "large", options: { text: "Obrázky", icon: "🖼", onClick: function () { logClick("Obrázky"); } } },
							{ widget: "qpRibbonButton", size: "large", options: { text: "Tvary", icon: "◇", onClick: function () { logClick("Tvary"); } } }
						]
					}]
				}, {
					key: "view", text: "Zobrazení",
					groups: [{
						key: "zoom", 
						title: "Lupa",
						items: [
							{ widget: "qpRibbonButton", stack: true, options: { text: "Přiblížit", icon: "+", onClick: function () { logClick("Přiblížit"); } } },
							{ widget: "qpRibbonButton", stack: true, options: { text: "Oddálit", icon: "–", onClick: function () { logClick("Oddálit"); } } }
						]
					}]
				}],
				onTabChanged: function (e) {
					$("#out1").text("aktivní karta: " + e.key);
				},
				onItemClick: function () { /* viz logClick() níže - agregované kliky jsou i tady k dispozici */ }
			}, "#ribbon1");
			$("#out1").text("aktivní karta: " + ribbon1.getActiveTabKey());

			function logClick(what) {
				$("#out1").text("naposledy kliknuto: " + what);
			}

			// -----------------------------------------------------------------
			// 2) přístup k položce jako k widgetu (qpCheckBox "Tučné" ve skupině "paragraph")
			// -----------------------------------------------------------------
			$("#btnToggleBold").on("click", function () {
				var boldCheckbox = ribbon1.getItemWidget("home", "paragraph", 0);
				if (!boldCheckbox) { return; }
				var next = !boldCheckbox.value();
				boldCheckbox.value(next);
				$("#out2").text("qpCheckBox \"Tučné\".value() = " + next);
			});

			// -----------------------------------------------------------------
			// 3) disabled
			// -----------------------------------------------------------------
			var ribbon2 = qpx.ui({
				view: "qpRibbon",
				disabled: true,
				tabs: [{
					key: "home", text: "Domů",
					groups: [{
						key: "g1", title: "Needitovatelné",
						items: [
							{ widget: "qpRibbonButton", size: "large", options: { text: "Vložit", icon: "📋" } }
						]
					}]
				}]
			}, "#ribbon2");

			// -----------------------------------------------------------------
			// Horní panel: přepínač tématu + sbalení/rozbalení pásu karet
			// -----------------------------------------------------------------
			var allRibbons = [ribbon1, ribbon2];
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
		    function applyCollapsed(collapsed) {
		        allRibbons.forEach(function (r) { r.option("collapsed", collapsed); });
		    }
		    var toolbar = qpx.ui({
		        view: "qpToolBar",
		        items: [{
					location: "after",
					widget: "qpDropDownButton",
					options: {
						items: [
							{ text: "Rozbalený pás karet", key: false },
							{ text: "Sbalený pás karet", key: true }
						],
						selectedItemKeys: [false],
						onSelectionChanged: function (e) {
							var collapsed = !!e.component.getSelectedItemKeys()[0];
							applyCollapsed(collapsed);
						}
					}
				}]
			}, "#pageToolbar");

			// applyTheme("qpx-theme-light");
		});
		</script>
	</body>
</html>
