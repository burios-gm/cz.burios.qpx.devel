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
				<h1>qpTextBox – test</h1>
				<p class="subtitle">Jednořádkové textové pole — analogie DevExtreme dxTextBox.</p>
			</header>
			<div class="toolbar-wrap">
				<div id="pageToolbar"></div>
			</div>
			<main>
				<div class="demo-block">
					<h2>1) Základní použití — showClearButton</h2>
					<p class="desc">placeholder, showClearButton, onValueChanged.</p>
					<div id="textbox1"></div>
					<div class="value-out" id="out1"></div>
				</div>
				<div class="demo-block">
					<h2>2) mode: "password"</h2>
					<p class="desc">Skryté zadávání hesla.</p>
					<div id="textbox2"></div>
				</div>
				<div class="demo-block">
					<h2>3) maxLength + valueChangeEvent: "input"</h2>
					<p class="desc">Hodnota (a event onValueChanged) se aktualizuje při každém stisku klávesy, max. 12 znaků.</p>
					<div id="textbox3"></div>
					<div class="value-out" id="out3"></div>
				</div>
				<div class="demo-block">
					<h2>4) disabled / readOnly</h2>
					<div id="textbox4"></div>
					<div id="textbox4b" style="margin-top: 8px;"></div>
				</div>
			</main>
		</div>

		<script>
		var widgetName = "qpTextBox";
		$(function () {
			// -----------------------------------------------------------------
			// 1) základní demo
			// -----------------------------------------------------------------
			var textbox1 = qpx.ui({
				view: "qpTextBox",
				width: 320,
				value: "Ahoj světe",
				placeholder: "Zadejte text...",
				showClearButton: true,
				stylingMode: "outlined",
				onValueChanged: function (e) {
					$("#out1").text("value: " + JSON.stringify(e.value));
				}
			}, "#textbox1");
			$("#out1").text("value: " + JSON.stringify(textbox1.value()));

			// -----------------------------------------------------------------
			// 2) heslo
			// -----------------------------------------------------------------
			var textbox2 = qpx.ui({
				view: "qpTextBox",
				width: 320,
				mode: "password",
				placeholder: "Heslo...",
				showClearButton: true,
				stylingMode: "filled"
			}, "#textbox2");

			// -----------------------------------------------------------------
			// 3) maxLength + valueChangeEvent: "input"
			// -----------------------------------------------------------------
			var textbox3 = qpx.ui({
				view: "qpTextBox",
				width: 320,
				placeholder: "Max. 12 znaků...",
				maxLength: 12,
				valueChangeEvent: "input",
				stylingMode: "underlined",
				onValueChanged: function (e) {
					$("#out3").text("value: " + JSON.stringify(e.value) + " (" + e.value.length + "/12)");
				}
			}, "#textbox3");
			$("#out3").text("value: \"\" (0/12)");

			// -----------------------------------------------------------------
			// 4) disabled / readOnly
			// -----------------------------------------------------------------
			var textbox4 = qpx.ui({
				view: "qpTextBox",
				width: 320,
				value: "Needitovatelné pole",
				disabled: true,
				stylingMode: "outlined"
			}, "#textbox4");

			var textbox4b = qpx.ui({
				view: "qpTextBox",
				width: 320,
				value: "Jen ke čtení",
				readOnly: true,
				stylingMode: "outlined"
			}, "#textbox4b");

			// -----------------------------------------------------------------
			// Horní panel: přepínač tématu + stylingMode (aplikuje se na všechny instance)
			// -----------------------------------------------------------------
			var allTextBoxes = [textbox1, textbox2, textbox3, textbox4, textbox4b];
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
		    function applyStylingMode(mode) {
		        allTextBoxes.forEach(function (tb) { tb.option("stylingMode", mode); });
		    }

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
				}, {
					location: "after", 
					widget: "qpDropDownButton",
					options: {
						items: [
							{ text: "outlined", key: "outlined" },
							{ text: "filled", key: "filled" },
							{ text: "underlined", key: "underlined" }
						],
						selectedItemKeys: ["outlined"],
						onSelectionChanged: function (e) {
							var mode = e.component.getSelectedItemKeys()[0] || "outlined";
							// applyStylingMode(mode);
						}
					}
				}]
			}, "#pageToolbar");
	
			// applyTheme("qpx-theme-light");
		});
		</script>
	</body>
</html>
