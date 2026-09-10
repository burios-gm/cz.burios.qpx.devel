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

	    <!-- Scrollovací obsah -->
	    <div class="qpx-test-content">
	        <header class="page-head">
	            <h1>qpCheckBox – test</h1>
	            <p class="subtitle">
	                Zaškrtávací pole s podporou neurčitého ("indeterminate") stavu — analogie DevExtreme dxCheckBox.
	            </p>
	        </header>
	
	        <div class="toolbar-wrap">
	            <div id="pageToolbar"></div>
	        </div>
	
	        <main>
	
	            <div class="demo-block">
	                <h2>1) Základní použití</h2>
	                <p class="desc">value, text, onValueChanged.</p>
	                <div id="checkbox1"></div>
	                <div class="value-out" id="out1"></div>
	            </div>
	
	            <div class="demo-block">
	                <h2>2) Skupina "vybrat vše" — indeterminate stav</h2>
	                <p class="desc">
	                    Nadřazený checkbox se přepne do neurčitého stavu, pokud jsou zaškrtnuté jen některé podřízené položky.
	                </p>
	
	                <div class="demo-col">
	                    <div id="checkboxAll"></div>
	
	                    <div class="demo-col" style="padding-left: 26px;">
	                        <div id="checkboxChild1"></div>
	                        <div id="checkboxChild2"></div>
	                        <div id="checkboxChild3"></div>
	                    </div>
	                </div>
	            </div>
	
	            <div class="demo-block">
	                <h2>3) disabled / readOnly</h2>
	                <div class="demo-row">
	                    <div id="checkbox3a"></div>
	                    <div id="checkbox3b"></div>
	                </div>
	            </div>
	
	        </main>
	    </div>

	    <script>
	    var widgetName = "qpCheckBox";
        $(function () {

            // -----------------------------------------------------------------
            // 1) základní demo
            // -----------------------------------------------------------------
            var checkbox1 = qpx.ui({
                view: "qpCheckBox",
                value: true,
                text: "Souhlasím s podmínkami",
                onValueChanged: function (e) {
                    $("#out1").text("value: " + JSON.stringify(e.value));
                }
            }, "#checkbox1");
            $("#out1").text("value: " + JSON.stringify(checkbox1.value()));

            // -----------------------------------------------------------------
            // 2) skupina s "vybrat vše" a indeterminate stavem
            // -----------------------------------------------------------------
            var children = [];

            function refreshParentState() {
                var values = children.map(function (c) { return c.value(); });
                var allChecked = values.every(function (v) { return v === true; });
                var noneChecked = values.every(function (v) { return v === false; });

                checkboxAll._settingFromChildren = true;
                checkboxAll.option("value", allChecked ? true : (noneChecked ? false : null));
                checkboxAll._settingFromChildren = false;
            }

            var checkboxAll = qpx.ui({
                view: "qpCheckBox",
                value: true,
                text: "Vybrat vše",
                onValueChanged: function (e) {
                    if (e.component._settingFromChildren) { return; }
                    children.forEach(function (c) { c.option("value", !!e.value); });
                }
            }, "#checkboxAll");

            var checkboxChild1 = qpx.ui({
                view: "qpCheckBox",
                value: true,
                text: "Položka 1",
                onValueChanged: function () { refreshParentState(); }
            }, "#checkboxChild1");

            var checkboxChild2 = qpx.ui({
                view: "qpCheckBox",
                value: true,
                text: "Položka 2",
                onValueChanged: function () { refreshParentState(); }
            }, "#checkboxChild2");

            var checkboxChild3 = qpx.ui({
                view: "qpCheckBox",
                value: false,
                text: "Položka 3",
                onValueChanged: function () { refreshParentState(); }
            }, "#checkboxChild3");

            children = [checkboxChild1, checkboxChild2, checkboxChild3];
            refreshParentState();

            // -----------------------------------------------------------------
            // 3) disabled / readOnly
            // -----------------------------------------------------------------
            var checkbox3a = qpx.ui({
                view: "qpCheckBox",
                value: true,
                text: "disabled",
                disabled: true
            }, "#checkbox3a");

            var checkbox3b = qpx.ui({
                view: "qpCheckBox",
                value: false,
                text: "readOnly",
                readOnly: true
            }, "#checkbox3b");

            // -----------------------------------------------------------------
            // Horní panel: přepínač tématu + velikosti ikony
            // -----------------------------------------------------------------
            var allCheckBoxes = [
                checkbox1, checkboxAll,
                checkboxChild1, checkboxChild2, checkboxChild3,
                checkbox3a, checkbox3b
            ];
			/*
            function applyTheme(themeClass) {
                allCheckBoxes.forEach(function (cb) {
                    cb.getContainer()
                        .removeClass("qpx-theme-light qpx-theme-dark")
                        .addClass(themeClass);
                });
                toolbar.option("theme", themeClass.replace("qpx-theme-", ""));
                $("body").toggleClass("qpx-page-dark", themeClass === "qpx-theme-dark");
            }
			*/
            function applyIconSize(size) {
                allCheckBoxes.forEach(function (cb) { cb.option("iconSize", size); });
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
                                { text: "18px", key: 18 },
                                { text: "22px", key: 22 },
                                { text: "26px", key: 26 }
                            ],
                            selectedItemKeys: [18],
                            onSelectionChanged: function (e) {
                                var size = e.component.getSelectedItemKeys()[0] || 18;
                                applyIconSize(size);
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
