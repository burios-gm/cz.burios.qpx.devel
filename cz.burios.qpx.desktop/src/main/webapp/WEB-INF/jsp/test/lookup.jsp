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
				<h1>qpLookup – test</h1>
				<p class="subtitle">Výběr položky přes vystředěný popup s vyhledáváním v hlavičce — analogie DevExtreme dxLookup. Na rozdíl od qpSelectBox se neotvírá jako úzký dropdown pod polem.</p>
			</header>
			<div class="toolbar-wrap">
				<div id="pageToolbar"></div>
			</div>
			<main>
				<div class="demo-block">
					<h2>1) Základní použití — applyValueMode: "instantly"</h2>
					<p class="desc">valueExpr: "id", displayExpr: "name", klik na položku hodnotu ihned uloží a popup zavře.</p>
					<div id="lookup1"></div>
					<div class="value-out" id="out1"></div>
				</div>
				<div class="demo-block">
					<h2>2) applyValueMode: "useButtons"</h2>
					<p class="desc">Výběr se potvrzuje tlačítkem „Hotovo“ v patičce popupu, „Zrušit“ zahodí rozpracovanou volbu.</p>
					<div id="lookup2"></div>
				</div>
				<div class="demo-block">
					<h2>3) searchEnabled: false — bez vyhledávání</h2>
					<p class="desc">Hlavička popupu nemá vyhledávací pole, jen titulek a zavírací křížek.</p>
					<div id="lookup3"></div>
				</div>
				<div class="demo-block">
					<h2>4) disabled / readOnly</h2>
					<div id="lookup4"></div>
				</div>
			</main>
		</div>

		<script>
		var widgetName = "qpLookup";
		$(function () {
		    var countries = [
		        { id: 1, name: "Česko" },
		        { id: 2, name: "Slovensko" },
		        { id: 3, name: "Rakousko" },
		        { id: 4, name: "Německo" },
		        { id: 5, name: "Polsko" },
		        { id: 6, name: "Maďarsko" },
		        { id: 7, name: "Francie" },
		        { id: 8, name: "Itálie" },
		        { id: 9, name: "Španělsko" },
		        { id: 10, name: "Portugalsko" },
		        { id: 11, name: "Nizozemsko" },
		        { id: 12, name: "Belgie" }
		    ];
		
		    // -----------------------------------------------------------------
		    // 1) základní demo — instantly
		    // -----------------------------------------------------------------
		    var lookup1 = qpx.ui({
		        view: "qpLookup",
		        width: 320,
		        dataSource: countries,
		        valueExpr: "id",
		        displayExpr: "name",
		        value: 1,
		        title: "Vyberte zemi",
		        placeholder: "Vyberte zemi...",
		        showClearButton: true,
		        stylingMode: "outlined",
		        onValueChanged: function (e) {
		            $("#out1").text("value: " + JSON.stringify(e.value));
		        }
		    }, "#lookup1");
		    $("#out1").text("value: " + JSON.stringify(lookup1.value()));
		
		    // -----------------------------------------------------------------
		    // 2) useButtons
		    // -----------------------------------------------------------------
		    var lookup2 = qpx.ui({
		        view: "qpLookup",
		        width: 320,
		        dataSource: countries,
		        valueExpr: "id",
		        displayExpr: "name",
		        title: "Vyberte zemi (s potvrzením)",
		        applyValueMode: "useButtons",
		        stylingMode: "filled"
		    }, "#lookup2");
		
		    // -----------------------------------------------------------------
		    // 3) bez vyhledávání
		    // -----------------------------------------------------------------
		    var lookup3 = qpx.ui({
		        view: "qpLookup",
		        width: 320,
		        dataSource: ["JavaScript", "TypeScript", "Java", "Python", "Go"],
		        title: "Vyberte jazyk",
		        searchEnabled: false,
		        stylingMode: "underlined"
		    }, "#lookup3");
		
		    // -----------------------------------------------------------------
		    // 4) disabled / readOnly
		    // -----------------------------------------------------------------
		    var lookup4 = qpx.ui({
		        view: "qpLookup",
		        width: 320,
		        dataSource: countries,
		        valueExpr: "id",
		        displayExpr: "name",
		        value: 7,
		        readOnly: true,
		        stylingMode: "outlined"
		    }, "#lookup4");
		
		    // -----------------------------------------------------------------
		    // Horní panel: přepínač tématu + stylingMode (aplikuje se na všechny 4 instance)
		    // -----------------------------------------------------------------
		    var allLookups = [lookup1, lookup2, lookup3, lookup4];
			/*
		    function applyTheme(themeClass) {
		        allLookups.forEach(function (lk) {
		            lk.getContainer().removeClass("qpx-theme-light qpx-theme-dark").addClass(themeClass);
		        });
		        toolbar.option("theme", themeClass.replace("qpx-theme-", ""));
		        $("body").toggleClass("qpx-page-dark", themeClass === "qpx-theme-dark");
		    }
			*/
		    function applyStylingMode(mode) {
		        allLookups.forEach(function (lk) { lk.option("stylingMode", mode); });
		    }
		
		    var toolbar = qpx.ui({
		        view: "qpToolBar",
		        items: [
		            {
		                location: "before", widget: "template",
		                template: "<b style='padding:0 4px;'>Styl:</b>"
		            },
		            {
		                location: "before", widget: "qpButtonGroup",
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
		            },
		            {
		                location: "after", widget: "qpButtonGroup",
		                options: {
		                    items: [
		                        { text: "outlined", key: "outlined" },
		                        { text: "filled", key: "filled" },
		                        { text: "underlined", key: "underlined" }
		                    ],
		                    selectedItemKeys: ["outlined"],
		                    onSelectionChanged: function (e) {
		                        var mode = e.component.getSelectedItemKeys()[0] || "outlined";
		                        applyStylingMode(mode);
		                    }
		                }
		            }
		        ]
		    }, "#pageToolbar");
		
		    // applyTheme("qpx-theme-light");
		});
		</script>
	</body>
</html>
