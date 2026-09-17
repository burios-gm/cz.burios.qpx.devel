<%@ page contentType="text/html; charset=UTF-8" pageEncoding="UTF-8" language="java" %>
<!DOCTYPE html>
<html lang="cs">
	<head>
		<meta charset="UTF-8">
		<meta name="viewport" content="width=device-width, initial-scale=1">
		
		<title>${appTitle}</title>
		
		<link rel="icon" href="/devel/favicon.png">
		<link rel="stylesheet" href="/devel/libs/fonts/fontawesome/4.7/css/font-awesome.min.css" type="text/css" media="all" />
		<link rel="stylesheet" href="/devel/libs/qpx/themes/jquery.qpx.default.css?build=${ timeNo }" type="text/css">
		<link rel="stylesheet" href="/devel/api/qpx-test.css?build=${timeNo}">
		
		<script type="text/javascript" src="/devel/libs/jquery/jquery-3.7.1.js"></script>
		<script type="text/javascript" src="/devel/libs/qpx/jquery.qpx.all.js"></script>
		<script type="text/javascript" src="/devel/api/qpx-test.js?build=${timeNo}"></script>
	</head>

	<body class="qpx-view">
		<div class="qpx-test-topbar1">
			<div id="pageTopbar" style="width: 100%"></div>
		</div>

		<div class="qpx-test-content">
			<header class="page-head">
				<h1>qpAutocomplete – test</h1>
				<p class="subtitle">
					Textové pole s automatickým našeptáváním — analogie DevExtreme dxAutocomplete.
					Hodnotou je vždy zadaný text, položka z nabídky ho jen doplní.
				</p>
			</header>
			<main>
				<div class="demo-block">
					<h2>1) Základní použití — dataSource z objektů</h2>
					<p class="desc">displayExpr: "name", minSearchLength: 1, showClearButton.</p>
					<div id="autocomplete1"></div>
					<div class="value-out" id="out1"></div>
				</div>

				<div class="demo-block">
					<h2>2) maxItemCount</h2>
					<p class="desc">Nabídka je omezena na max. 4 zobrazené položky, i když jich vyhovuje víc.</p>
					<div id="autocomplete2"></div>
				</div>

				<div class="demo-block">
					<h2>3) onSelectionChanged / onEnterKey</h2>
					<p class="desc">Odlišení, zda hodnota vznikla výběrem položky, nebo jen volným zadáním textu.</p>
					<div id="autocomplete3"></div>
					<div class="value-out" id="out3"></div>
				</div>

				<div class="demo-block">
					<h2>4) disabled / readOnly</h2>
					<div id="autocomplete4"></div>
				</div>

			</main>
		</div>

		<script>
		var widgetName = "qpAutocomplete";
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
			var autocomplete1 = qpx.ui({
				view: "qpAutocomplete",
				width: 320,
				dataSource: countries,
				displayExpr: "name",
				placeholder: "Začněte psát zemi...",
				minSearchLength: 1,
				showClearButton: true,
				stylingMode: "outlined",
				onValueChanged: function (e) {
					$("#out1").text("value: " + JSON.stringify(e.value));
				}
			}, "#autocomplete1");
			$("#out1").text("value: " + JSON.stringify(autocomplete1.value()));

			// -----------------------------------------------------------------
			// 2) maxItemCount
			// -----------------------------------------------------------------
			var autocomplete2 = qpx.ui({
				view: "qpAutocomplete",
				width: 320,
				dataSource: countries,
				displayExpr: "name",
				minSearchLength: 0,
				maxItemCount: 4,
				stylingMode: "filled"
			}, "#autocomplete2");

			// -----------------------------------------------------------------
			// 3) onSelectionChanged vs. volný text
			// -----------------------------------------------------------------
			var autocomplete3 = qpx.ui({
				view: "qpAutocomplete",
				width: 320,
				dataSource: ["JavaScript", "TypeScript", "Java", "Python", "Go"],
				value: "JavaScript",
				minSearchLength: 0,
				stylingMode: "underlined",
				onSelectionChanged: function (e) {
					$("#out3").text("vybráno ze seznamu: " + e.item);
				},
				onValueChanged: function (e) {
					if ($("#out3").text().indexOf(e.value) === -1) {
						$("#out3").text("volný text: " + e.value);
					}
				}
			}, "#autocomplete3");
			$("#out3").text("volný text: " + autocomplete3.value());

			// -----------------------------------------------------------------
			// 4) disabled / readOnly
			// -----------------------------------------------------------------
			var autocomplete4 = qpx.ui({
				view: "qpAutocomplete",
				width: 320,
				dataSource: countries,
				displayExpr: "name",
				value: "Francie",
				readOnly: true,
				stylingMode: "outlined"
			}, "#autocomplete4");
		});
		</script>
	</body>
</html>
