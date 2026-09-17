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
				<h1>qpNumberBox – test</h1>
				<p class="subtitle">Číselné vstupní pole se spin tlačítky — analogie DevExtreme dxNumberBox.</p>
			</header>
			<div class="toolbar-wrap">
				<div id="pageToolbar"></div>
			</div>
			<main>
				<div class="demo-block">
					<h2>1) Základní použití — min/max/step</h2>
					<p class="desc">min: 0, max: 100, step: 5, showSpinButtons.</p>
					<div id="numberbox1"></div>
					<div class="value-out" id="out1"></div>
				</div>
				<div class="demo-block">
					<h2>2) format — 2 desetinná místa</h2>
					<p class="desc">Hodnota (např. cena) se zobrazuje vždy na 2 desetinná místa.</p>
					<div id="numberbox2"></div>
				</div>
				<div class="demo-block">
					<h2>3) showClearButton, bez spin tlačítek</h2>
					<p class="desc">showSpinButtons: false, showClearButton: true.</p>
					<div id="numberbox3"></div>
				</div>
				<div class="demo-block">
					<h2>4) disabled / readOnly</h2>
					<div id="numberbox4"></div>
					<div id="numberbox4b" style="margin-top: 8px;"></div>
				</div>
			</main>
		</div>

		<script>
		var widgetName = "qpNumberBox";
		$(function () {
		    // -----------------------------------------------------------------
		    // 1) základní demo
		    // -----------------------------------------------------------------
		    var numberbox1 = qpx.ui({
		        view: "qpNumberBox",
		        width: 220,
		        value: 25,
		        min: 0,
		        max: 100,
		        step: 5,
		        showSpinButtons: true,
		        stylingMode: "outlined",
		        onValueChanged: function (e) {
		            $("#out1").text("value: " + JSON.stringify(e.value));
		        }
		    }, "#numberbox1");
		    $("#out1").text("value: " + JSON.stringify(numberbox1.value()));

		    // -----------------------------------------------------------------
		    // 2) format s 2 desetinnými místy
		    // -----------------------------------------------------------------
		    var numberbox2 = qpx.ui({
		        view: "qpNumberBox",
		        width: 220,
		        value: 199.9,
		        min: 0,
		        format: 2,
		        step: 0.5,
		        stylingMode: "filled"
		    }, "#numberbox2");

		    // -----------------------------------------------------------------
		    // 3) bez spin tlačítek, s clear tlačítkem
		    // -----------------------------------------------------------------
		    var numberbox3 = qpx.ui({
		        view: "qpNumberBox",
		        width: 220,
		        value: null,
		        placeholder: "Zadejte číslo...",
		        showSpinButtons: false,
		        showClearButton: true,
		        stylingMode: "underlined"
		    }, "#numberbox3");

		    // -----------------------------------------------------------------
		    // 4) disabled / readOnly
		    // -----------------------------------------------------------------
		    var numberbox4 = qpx.ui({
		        view: "qpNumberBox",
		        width: 220,
		        value: 42,
		        disabled: true,
		        stylingMode: "outlined"
		    }, "#numberbox4");

		    var numberbox4b = qpx.ui({
		        view: "qpNumberBox",
		        width: 220,
		        value: 7,
		        readOnly: true,
		        stylingMode: "outlined"
		    }, "#numberbox4b");

		    // -----------------------------------------------------------------
		    // Horní panel: přepínač tématu + stylingMode (aplikuje se na všechny instance)
		    // -----------------------------------------------------------------
		    var allNumberBoxes = [numberbox1, numberbox2, numberbox3, numberbox4, numberbox4b];
			/*
		    function applyTheme(themeClass) {
		        allNumberBoxes.forEach(function (nb) {
		            nb.getContainer().removeClass("qpx-theme-light qpx-theme-dark").addClass(themeClass);
		        });
		        toolbar.option("theme", themeClass.replace("qpx-theme-", ""));
		        $("body").toggleClass("qpx-page-dark", themeClass === "qpx-theme-dark");
		    }
			*/
		    function applyStylingMode(mode) {
		        allNumberBoxes.forEach(function (nb) { nb.option("stylingMode", mode); });
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
