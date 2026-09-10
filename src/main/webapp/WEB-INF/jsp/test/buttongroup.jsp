<%@ page contentType="text/html;charset=UTF-8" %>
<%@ taglib prefix = "c" uri = "http://java.sun.com/jsp/jstl/core" %>
<%
System.out.println("/devel/buttongroup.jsp");
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
				<h1>qpButtonGroup — testovací stránka</h1>
				<p class="subtitle">...</p>
			</header>
			<main>
				<div class="demo-block">
					<h2>1) selectionMode: single</h2>
					<p class="desc"></p>
					<div id="single" class="row"></div>
					<div id="log1" class="value-out">Vyber období...</div>
				</div>
				<div class="demo-block">
					<h2>2) selectionMode: multiple</h2>
					<p class="desc"></p>
					<div id="multiple" class="row"></div>
					<div id="log2" class="value-out">Vyber filtry...</div>
				</div>
		
				<!-- ============================================================ -->
				<div class="demo-block">
					<h2>3) selectionMode: none (jen kliky, bez výběru) + disabled položka</h2>
					<div id="noneMode" class="row"></div>
					<div id="log3" class="value-out">...</div>
				</div>		
				<!-- ============================================================ -->
				<div class="demo-block">
					<h2>4) API — getSelectedItemKeys() / option()</h2>
					<div class="row">
						<button id="btnGet" type="button">getSelectedItemKeys()</button>
						<button id="btnDisable" type="button">enable() / disable()</button>
					</div>
					<div id="log4" class="value-out">...</div>
				</div>
			</main>
		</div>

		<script>
		var widgetName = "qpButtonGroup";
		$(function () {
			var single = qpx.ui({
				view: "qpButtonGroup",
				selectionMode: "single",
				stylingMode: "outlined",
				items: [
					{ text: "Den", key: "day" },
					{ text: "Týden", key: "week" },
					{ text: "Měsíc", key: "month" }
				],
				selectedItemKeys: ["week"],
				onSelectionChanged: function (e) {
					$("#log1").text("selectionChanged — added: " + JSON.stringify(e.addedItemKeys) +
						", removed: " + JSON.stringify(e.removedItemKeys));
				}
			}, "#single");

			qpx.ui({
				view: "qpButtonGroup",
				selectionMode: "multiple",
				stylingMode: "contained",
				items: [
					{ text: "Aktivní", key: "active" },
					{ text: "Archiv", key: "archived" },
					{ text: "Smazané", key: "deleted", disabled: true }
				],
				onSelectionChanged: function (e) {
					$("#log2").text("aktuálně vybráno: " + JSON.stringify(e.component.getSelectedItemKeys()));
				}
			}, "#multiple");

			qpx.ui({
				view: "qpButtonGroup",
				selectionMode: "none",
				items: [
					{ text: "Akce A", key: "a" },
					{ text: "Akce B", key: "b" },
					{ text: "Akce C (disabled)", key: "c", disabled: true }
				],
				onItemClick: function (e) {
					$("#log3").text("itemClick: " + e.itemData.text);
				}
			}, "#noneMode");

			$("#btnGet").on("click", function () {
				$("#log4").text("single.getSelectedItemKeys() = " + JSON.stringify(single.getSelectedItemKeys()));
			});
			$("#btnDisable").on("click", function () {
				single.option("disabled") ? single.enable() : single.disable();
				$("#log4").text("disabled = " + single.option("disabled"));
			});
		});
		</script>
	</body>
</html>
