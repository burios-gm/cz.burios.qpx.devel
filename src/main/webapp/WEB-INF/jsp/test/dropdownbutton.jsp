<%@ page contentType="text/html;charset=UTF-8" %>
<%@ taglib prefix = "c" uri = "http://java.sun.com/jsp/jstl/core" %>
<%
%>
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
				<h1>qpDropDownButton — testovací stránka</h1>
				<p class="subtitle">...</p>
			</header>

			<main>
				<div class="demo-block">
					<h2>1) Obyčejné tlačítko (splitButton: false)</h2>
					<div id="normalRow" class="row"></div>
					<div id="log1" class="value-out">...</div>
				</div>
				<div class="demo-block">
					<!-- ============================================================ -->
					<h2>2) Split tlačítko (splitButton: true)</h2>
					<div id="splitRow" class="row"></div>
					<div id="log2" class="value-out">...</div>
				</div>
				<div class="demo-block">

					<!-- ============================================================ -->
					<h2>3) useSelectMode — vybraná položka nahradí text tlačítka</h2>
					<div id="selectRow" class="row"></div>
					<div id="log3" class="value-out">...</div>
				</div>
				<div class="demo-block">
					<h2>4) opened / closed eventy, dropDownOptions.width</h2>
					<div id="widthRow" class="row"></div>
					<div id="log4" class="value-out">...</div>
				</div>
			</main>
		</div>

		<script>
		var widgetName = "qpDropDownButton";
		$(function () {
			qpx.ui({
				view: "qpDropDownButton",
				text: "Akce",
				icon: "⋯",
				stylingMode: "outlined",
				items: [
					{ text: "Upravit", key: "edit" },
					{ text: "Duplikovat", key: "duplicate" },
					{ text: "Smazat", key: "delete", disabled: true }
				],
				onButtonClick: function () { $("#log1").text("buttonClick (menu se přepnulo)"); },
				onItemClick: function (e) { $("#log1").text("itemClick: " + e.itemData.text); }
			}, "#normalRow");

			qpx.ui({
				view: "qpDropDownButton",
				text: "Export",
				icon: "⭳",
				splitButton: true,
				type: "default",
				items: [
					{ text: "Export do PDF", key: "pdf" },
					{ text: "Export do Excelu", key: "xlsx" },
					{ text: "Export do CSV", key: "csv" }
				],
				onButtonClick: function () { $("#log2").text("buttonClick — hlavní část (bez otevření menu)"); },
				onItemClick: function (e) { $("#log2").text("itemClick: " + e.itemData.text); }
			}, "#splitRow");

			qpx.ui({
				view: "qpDropDownButton",
				useSelectMode: true,
				selectedItemKey: "cs",
				items: [
					{ text: "Čeština", key: "cs" },
					{ text: "English", key: "en" },
					{ text: "Deutsch", key: "de" }
				],
				onSelectionChanged: function (e) {
					$("#log3").text("selectionChanged: " + e.previousKey + " -> " + e.key);
				}
			}, "#selectRow");

			qpx.ui({
				view: "qpDropDownButton",
				text: "Široké menu (300px)",
				dropDownOptions: { width: 300 },
				items: [
					{ text: "Krátká položka", key: 1 },
					{ text: "Delší popisek položky pro ukázku šířky menu", key: 2 }
				],
				onOptionChanged: function (e) { console.log("optionChanged", e.name, e.value); }
			}, "#widthRow").on("opened", function () {
				$("#log4").text("menu otevřeno");
			}).on("closed", function () {
				$("#log4").text("menu zavřeno");
			});
		});
		</script>
	</body>
</html>
