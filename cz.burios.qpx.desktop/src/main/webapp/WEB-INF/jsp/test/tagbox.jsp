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
				<h1>qpTagBox – test</h1>
				<p class="subtitle">Vícenásobný výběr s tagy — analogie DevExtreme dxTagBox. Přepínač stylu níže mění téma i stylingMode přímo na živých instancích.</p>
			</header>
			<div class="toolbar-wrap">
				<div id="pageToolbar"></div>
			</div>

			<main>
				<div class="demo-block">
					<h2>1) Základní použití — dataSource z objektů</h2>
					<p class="desc">valueExpr: "id", displayExpr: "name", showSelectionControls, hideSelectedItems.</p>
					<div id="tagbox1"></div>
					<div class="value-out" id="out1"></div>
				</div>
				<div class="demo-block">
					<h2>2) maxDisplayedTags + showMultiTagOnly</h2>
					<p class="desc">Při velkém počtu vybraných položek se zobrazí jen souhrnný tag „N vybráno“.</p>
					<div id="tagbox2"></div>
				</div>
				<div class="demo-block">
					<h2>3) acceptCustomValue — psaní vlastních tagů</h2>
					<p class="desc">Enter s textem, který v seznamu není, vytvoří novou položku (onCustomItemCreating).</p>
					<div id="tagbox3"></div>
				</div>
				<div class="demo-block">
					<h2>4) disabled / readOnly</h2>
					<div id="tagbox4"></div>
				</div>
			</main>
		</div>

		<script>
		var widgetName = "qpTagBox";
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
		    // 1) základní demo
		    // -----------------------------------------------------------------
		    var tagbox1 = qpx.ui({
		        view: "qpTagBox",
		        width: 420,
		        dataSource: countries,
		        valueExpr: "id",
		        displayExpr: "name",
		        value: [1, 2],
		        placeholder: "Vyberte země...",
		        showSelectionControls: true,
		        hideSelectedItems: false,
		        showClearButton: true,
		        stylingMode: "outlined",
		        onValueChanged: function (e) {
		            $("#out1").text("value: [" + e.value.join(", ") + "]");
		        },
		        onSelectionChanged: function (e) {
		            console.log("selectionChanged -> přidáno", e.addedItems.length, "odebráno", e.removedItems.length);
		        }
		    }, "#tagbox1");
		    $("#out1").text("value: [" + tagbox1.value().join(", ") + "]");

		    // -----------------------------------------------------------------
		    // 2) maxDisplayedTags / showMultiTagOnly
		    // -----------------------------------------------------------------
		    var tagbox2 = qpx.ui({
		        view: "qpTagBox",
		        width: 420,
		        dataSource: countries,
		        valueExpr: "id",
		        displayExpr: "name",
		        value: [1, 2, 3, 4, 5, 6],
		        maxDisplayedTags: 3,
		        stylingMode: "filled"
		    }, "#tagbox2");

		    var multiTagToggle = qpx.ui({
		        view: "qpButton",
		        text: "Přepnout showMultiTagOnly",
		        stylingMode: "outlined",
		        css: "demo-inline-btn",
		        onClick: function () {
		            tagbox2.option("showMultiTagOnly", !tagbox2.option("showMultiTagOnly"));
		        }
		    });
		    $("#tagbox2").after(multiTagToggle.getContainer().css("margin-top", "8px"));

		    // -----------------------------------------------------------------
		    // 3) acceptCustomValue
		    // -----------------------------------------------------------------
		    var tagbox3 = qpx.ui({
		        view: "qpTagBox",
		        width: 420,
		        dataSource: ["JavaScript", "TypeScript", "Java", "Python", "Go"],
		        value: ["JavaScript"],
		        placeholder: "Napište technologii a stiskněte Enter...",
		        acceptCustomValue: true,
		        stylingMode: "underlined",
		        onCustomItemCreating: function (args) {
		            // vlastní validace / normalizace před přidáním nové položky
		            args.customItem = args.text.trim();
		        }
		    }, "#tagbox3");

		    // -----------------------------------------------------------------
		    // 4) disabled / readOnly
		    // -----------------------------------------------------------------
		    var tagbox4 = qpx.ui({
		        view: "qpTagBox",
		        width: 420,
		        dataSource: countries,
		        valueExpr: "id",
		        displayExpr: "name",
		        value: [4, 7],
		        readOnly: true,
		        stylingMode: "outlined"
		    }, "#tagbox4");

		    // -----------------------------------------------------------------
		    // Horní panel: přepínač tématu + stylingMode (aplikuje se na všechny 4 instance)
		    // -----------------------------------------------------------------
		    var allTagBoxes = [tagbox1, tagbox2, tagbox3, tagbox4];
			/*
			*/
		    function applyStylingMode(mode) {
		        allTagBoxes.forEach(function (tb) { tb.option("stylingMode", mode); });
		    }

		    var toolbar = qpx.ui({
		        view: "qpToolBar",
		        items: [
		            {
		                location: "before", widget: "qpButtonGroup",
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
		});
		</script>
	</body>
</html>
