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
			<strong>QPX qpTabView – test</strong>
			<div class="qpx-testbar">
				<label>Téma:
					<select id="ctlTheme">
						<option value="qpx-theme-light">light</option>
						<option value="qpx-theme-dark">dark</option>
					</select>
				</label>
			
				<label>Styling:
					<select id="ctlStyling">
						<option value="primary">primary (podtržení)</option>
						<option value="secondary">secondary (pilulky)</option>
					</select>
				</label>
			
				<label>Pozice záložek:
					<select id="ctlPosition">
						<option value="top">top</option>
						<option value="bottom">bottom</option>
						<option value="left">left</option>
						<option value="right">right</option>
					</select>
				</label>
			
				<label><input type="checkbox" id="ctlRtl"> RTL</label>
				<label><input type="checkbox" id="ctlDisabled"> disabled</label>
				<label><input type="checkbox" id="ctlNavButtons" checked> nav tlačítka</label>
				
				<button id="ctlAddTab" type="button">+ přidat záložku</button>
			</div>
	
			<div class="qpx-demo-wrap">
	
				<h2>1) Hlavní demo (ovládané přepínačem nahoře)</h2>
				<div id="tabviewMain"></div>
				
				<h2>2) Deklarativně přes data-qpx-* atributy</h2>
				<div data-qpx-view="qpTabView"
					data-qpx-tabs-position="top"
					data-qpx-styling-mode="secondary"
					data-qpx-items='[
						{"title":"Přehled","text":"Deklarativně inicializovaná záložka č. 1."},
						{"title":"Detail","text":"Deklarativně inicializovaná záložka č. 2."},
						{"title":"Historie","text":"Deklarativně inicializovaná záložka č. 3.","disabled":true}
					]'>
				</div>
		
				<h2>3) Vnořené qpx widgety v panelu (rows/cols layout)</h2>
				<div id="tabviewNested"></div>
			</div>	
		</div>

		<script>
		var widgetName = "qpTabView";
		$(function () {
			// -----------------------------------------------------------------
			// 1) Hlavní demo — items s různým obsahem (template, html, text)
			// -----------------------------------------------------------------
			var mainTabs = qpx.ui({
				view: "qpTabView",
				width: "100%",
				tabsPosition: "top",
				stylingMode: "primary",
				showNavButtons: true,
				deferRendering: true,
				animationEnabled: true,
				items: [
		            {
		                title: "Dashboard",
		                icon: "home",
		                template: function (itemData, itemIndex, element) {
		                    return "<div class='qpx-demo-panel-content'>" +
		                        "<h3>Dashboard</h3>" +
		                        "<p>Obsah vykreslený přes <code>template</code> jako funkci vracející HTML.</p>" +
		                        "</div>";
		                }
		            },
		            {
		                title: "Uživatelé",
		                icon: "user",
		                badge: 5,
		                html: "<div class='qpx-demo-panel-content'><h3>Uživatelé</h3><p>Obsah zadaný přímo přes <code>html</code>.</p></div>"
		            },
		            {
		                title: "Nastavení",
		                icon: "settings",
		                text: "Obsah zadaný jako čistý text přes 'text' (společně s 'title')."
		            },
		            {
		                title: "Zakázaná záložka",
		                disabled: true,
		                text: "Tento obsah by neměl jít nikdy zobrazit."
		            },
		            {
		                title: "Dlouhý název záložky pro test přetečení A",
		                text: "Testovací obsah A."
		            },
		            {
		                title: "Dlouhý název záložky pro test přetečení B",
		                text: "Testovací obsah B."
		            },
		            {
		                title: "Dlouhý název záložky pro test přetečení C",
		                text: "Testovací obsah C."
		            }
		        ],
		        onSelectionChanged: function (e) {
		            console.log("selectionChanged ->", e.addedItems[0] && e.addedItems[0].title);
		        },
		        onTitleClick: function (e) {
		            console.log("titleClick ->", e.itemData.title);
		        },
		        onContentReady: function () {
		            console.log("qpTabView: contentReady");
		        }
		    }, "#tabviewMain");
		
		    // -----------------------------------------------------------------
		    // 2) Ovládací panel nahoře -> volání .option(...) na instanci
		    // -----------------------------------------------------------------
		    function applyTheme(themeClass) {
		        mainTabs.getContainer()
		            .removeClass("qpx-theme-light qpx-theme-dark")
		            .addClass(themeClass);
		        $("body").toggleClass("qpx-page-dark", themeClass === "qpx-theme-dark");
		    }
		
		    applyTheme($("#ctlTheme").val());
		
		    $("#ctlTheme").on("change", function () { applyTheme(this.value); });
		
		    $("#ctlStyling").on("change", function () {
		        mainTabs.option("stylingMode", this.value);
		    });
		
		    $("#ctlPosition").on("change", function () {
		        mainTabs.option("tabsPosition", this.value);
		    });
		
		    $("#ctlRtl").on("change", function () {
		        mainTabs.option("rtlEnabled", this.checked);
		    });
		
		    $("#ctlDisabled").on("change", function () {
		        mainTabs.option("disabled", this.checked);
		    });
		
		    $("#ctlNavButtons").on("change", function () {
		        mainTabs.option("showNavButtons", this.checked);
		    });
		
		    $("#ctlAddTab").on("click", function () {
		        var items = mainTabs.option("items").slice();
		        var n = items.length + 1;
		        items.push({ title: "Nová " + n, text: "Dynamicky přidaná záložka č. " + n + "." });
		        mainTabs.option("items", items);
		        mainTabs.option("selectedIndex", items.length - 1);
		    });
		
		    // -----------------------------------------------------------------
		    // 3) Vnořené qpx widgety (layout rows/cols) uvnitř panelu
		    // -----------------------------------------------------------------
		    qpx.ui({
		        view: "qpTabView",
		        tabsPosition: "left",
		        stylingMode: "primary",
		        deferRendering: false,
		        items: [
		            {
		                title: "Formulář",
		                rows: [
		                    { view: "template", template: "<div class='qpx-demo-panel-content'><h3>Vnořený layout</h3><p>Tento panel je celý sestaven přes <code>qpx.ui</code> (rows/cols), stejně jako u qpToolBar položek.</p></div>", height: 90 },
		                    {
		                        cols: [
		                            { view: "template", template: "<div class='qpx-demo-panel-content'>Sloupec A</div>" },
		                            { view: "template", template: "<div class='qpx-demo-panel-content'>Sloupec B</div>" }
		                        ]
		                    }
		                ]
		            },
		            {
		                title: "Toolbar demo",
		                rows: [
		                    {
		                        view: "qpToolBar",
		                        height: 44,
		                        items: [
		                            { location: "before", widget: "template", template: "<b style='padding:0 12px;'>Panel s toolbarem uvnitř qpTabView</b>" },
		                            { location: "after", widget: "qpButton", options: { text: "Akce" } }
		                        ]
		                    }
		                ]
		            }
		        ]
		    }, "#tabviewNested");
		
		});
		</script>
	</body>
</html>
