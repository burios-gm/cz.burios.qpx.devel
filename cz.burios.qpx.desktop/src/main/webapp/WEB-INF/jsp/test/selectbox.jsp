<%@ page contentType="text/html; charset=UTF-8" pageEncoding="UTF-8" language="java" %>
<!DOCTYPE html>
<html lang="cs">
	<head>
		<meta charset="UTF-8">
		<meta name="viewport" content="width=device-width, initial-scale=1">
		
		<title>${appTitle}</title>
		
		<link rel="icon" href="/devel/favicon.png">
		<link rel="stylesheet" href="/devel/libs/fonts/fontawesome/4.7/css/font-awesome.min.css" type="text/css" media="all" />
		<link rel="stylesheet" href="/devel/libs/qpx/themes/jquery.qpx.light.css?build=${ timeNo }" type="text/css">
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
	            <h1>qpSelectBox</h1>
	            <p class="subtitle">
	                Výběr jedné položky z rozbalovacího seznamu — analogie DevExtreme dxSelectBox.
	                Na rozdíl od qpAutocomplete hodnota vždy odpovídá položce ze seznamu.
	            </p>
	        </header>
	        <div class="toolbar-wrap">
	            <div id="pageToolbar"></div>
	        </div>
			<main>
	            <div class="demo-block">
	                <h2>1) Základní použití — dataSource z objektů</h2>
	                <p class="desc">valueExpr: "id", displayExpr: "name", showClearButton.</p>
	                <div id="selectbox1"></div>
	                <div class="value-out" id="out1"></div>
	            </div>
	            <div class="demo-block">
	                <h2>2) searchEnabled — vyhledávání přímo v poli</h2>
	                <p class="desc">Psaní filtruje nabídku, ale výběr je vždy jen z položek seznamu.</p>
	                <div id="selectbox2"></div>
	            </div>
	            <div class="demo-block">
	                <h2>3) acceptCustomValue — psaní vlastních položek</h2>
	                <p class="desc">Enter s textem, který v seznamu není, vytvoří novou položku (onCustomItemCreating).</p>
	                <div id="selectbox3"></div>
	            </div>
	            <div class="demo-block">
	                <h2>4) disabled / readOnly</h2>
	                <div id="selectbox4"></div>
	            </div>
	        </main>
	    </div>

	    <script>
	    var widgetName = "qpSelectBox";
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
	
	            var selectbox1 = qpx.ui({
	                view: "qpSelectBox",
	                width: 320,
	                dataSource: countries,
	                valueExpr: "id",
	                displayExpr: "name",
	                value: 1,
	                placeholder: "Vyberte zemi...",
	                showClearButton: true,
	                stylingMode: "outlined",
	                onValueChanged: function (e) {
	                    $("#out1").text("value: " + JSON.stringify(e.value));
	                }
	            }, "#selectbox1");
	            $("#out1").text("value: " + JSON.stringify(selectbox1.value()));
	
	            var selectbox2 = qpx.ui({
	                view: "qpSelectBox",
	                width: 320,
	                dataSource: countries,
	                valueExpr: "id",
	                displayExpr: "name",
	                searchEnabled: true,
	                stylingMode: "filled"
	            }, "#selectbox2");
	
	            var selectbox3 = qpx.ui({
	                view: "qpSelectBox",
	                width: 320,
	                dataSource: ["JavaScript", "TypeScript", "Java", "Python", "Go"],
	                value: "JavaScript",
	                searchEnabled: true,
	                acceptCustomValue: true,
	                stylingMode: "underlined",
	                onCustomItemCreating: function (args) {
	                    args.customItem = args.text.trim();
	                }
	            }, "#selectbox3");
	
	            var selectbox4 = qpx.ui({
	                view: "qpSelectBox",
	                width: 320,
	                dataSource: countries,
	                valueExpr: "id",
	                displayExpr: "name",
	                value: 7,
	                readOnly: true,
	                stylingMode: "outlined"
	            }, "#selectbox4");
	
	            var allSelectBoxes = [selectbox1, selectbox2, selectbox3, selectbox4];
				/*
	            function applyTheme(themeClass) {
	                allSelectBoxes.forEach(function (sb) {
	                    sb.getContainer().removeClass("qpx-theme-light qpx-theme-dark").addClass(themeClass);
	                });
	                toolbar.option("theme", themeClass.replace("qpx-theme-", ""));
	                $("body").toggleClass("qpx-page-dark", themeClass === "qpx-theme-dark");
	            }
				*/
	            function applyStylingMode(mode) {
	                allSelectBoxes.forEach(function (sb) { sb.option("stylingMode", mode); });
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
