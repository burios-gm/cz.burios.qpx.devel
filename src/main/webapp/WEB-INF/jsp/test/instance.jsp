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
			<div id="pageTopbar"></div>
		</div>
		<div class="qpx-test-content">
			<header class="page-head">
				<h1>Získání instance widgetu přes jQuery – test</h1>
				<p class="subtitle">
					Čtyři rovnocenné způsoby, jak z <code>$(selector)</code> získat živou instanci qpx widgetu —
					obdoba <code>$(...).data("kendoTagBox")</code> u KendoUI a <code>$(...).dxTagBox("instance")</code>
					u DevExtreme. Na konci i důkaz, že po <code>destroy()</code> už žádný z nich instanci nevrátí.
				</p>
			</header>
			<main>
				<div class="demo-block">
					<h2>1) qpSwitch — všechny 4 způsoby vedle sebe</h2>
					<p class="desc">
						Widget má v HTML pevné <code>id="switchDemo"</code>. Každé tlačítko získá instanci JINÝM
						způsobem a zavolá na ní <code>value()</code> — výsledek je pokaždé stejný, protože jde
						o STEJNOU instanci.
					</p>
					<div id="switchDemo"></div>
					<div class="demo-actions">
						<button type="button" data-method="data">$(el).data("qpSwitch")</button>
						<button type="button" data-method="instance">$(el).qpSwitch("instance")</button>
						<button type="button" data-method="plugin">$(el).qpSwitch()</button>
						<button type="button" data-method="getInstance">qpx.getInstance(el)</button>
					</div>
					<div class="value-out" id="switchOut">Klikni na některé z tlačítek výše...</div>
	
					<p class="desc" style="margin-top:14px;">
						Stejná instance jde použít i k VOLÁNÍ METOD nebo hromadnému nastavení options
						přímo přes jQuery plugin, bez nutnosti si instanci nikam ukládat do proměnné:
					</p>
					<div class="demo-actions">
						<button type="button" id="switchToggle">$(el).qpSwitch("toggle") — volání metody</button>
						<button type="button" id="switchBulk">$(el).qpSwitch({ onText:"ANO", offText:"NE" }) — hromadné option</button>
					</div>
				</div>
	
				<div class="demo-block">
					<h2>2) qpTextBox</h2>
					<p class="desc">Stejné 4 způsoby čtení + ukázka zápisu hodnoty metodou přes plugin.</p>
					<div id="textboxDemo"></div>
					<div class="demo-actions">
						<button type="button" data-widget="textbox" data-method="data">data("qpTextBox")</button>
						<button type="button" data-widget="textbox" data-method="instance">qpTextBox("instance")</button>
						<button type="button" data-widget="textbox" data-method="plugin">qpTextBox()</button>
						<button type="button" data-widget="textbox" data-method="getInstance">qpx.getInstance()</button>
					</div>
					<div class="value-out" id="textboxOut">...</div>
					<div class="demo-actions" style="margin-top:8px;">
						<button type="button" id="textboxSetValue">$(el).qpTextBox("value", "Nastaveno přes plugin")</button>
					</div>
				</div>
	
				<div class="demo-block">
					<h2>3) qpTagBox</h2>
					<p class="desc">Funguje stejně i u widgetů s polem hodnot (multi-select).</p>
					<div id="tagboxDemo"></div>
					<div class="demo-actions">
						<button type="button" data-widget="tagbox" data-method="data">data("qpTagBox")</button>
						<button type="button" data-widget="tagbox" data-method="instance">qpTagBox("instance")</button>
						<button type="button" data-widget="tagbox" data-method="plugin">qpTagBox()</button>
						<button type="button" data-widget="tagbox" data-method="getInstance">qpx.getInstance()</button>
					</div>
					<div class="value-out" id="tagboxOut">...</div>
				</div>
	
				<div class="demo-block">
					<h2>4) qpSelectBox</h2>
					<div id="selectboxDemo"></div>
					<div class="demo-actions">
						<button type="button" data-widget="selectbox" data-method="data">data("qpSelectBox")</button>
						<button type="button" data-widget="selectbox" data-method="instance">qpSelectBox("instance")</button>
						<button type="button" data-widget="selectbox" data-method="plugin">qpSelectBox()</button>
						<button type="button" data-widget="selectbox" data-method="getInstance">qpx.getInstance()</button>
					</div>
					<div class="value-out" id="selectboxOut">...</div>
				</div>
	
				<div class="demo-block">
					<h2>5) Po destroy() — všechny 4 způsoby musí vrátit undefined</h2>
					<p class="desc">
						Ověření opravy: dřív <code>destroy()</code> mazal jen <code>data("qpx-widget")</code>,
						takže <code>data("qpSwitch")</code> po zničení widgetu ještě chvíli vracelo starou,
						už neplatnou instanci. Teď se mažou oba klíče najednou.
					</p>
					<div id="destroyDemo"></div>
					<div class="demo-actions">
						<button type="button" id="destroyCheckBefore">Zjistit instanci (před destroy)</button>
						<button type="button" id="destroyNow">$(el).data("qpSwitch").destroy()</button>
						<button type="button" id="destroyCheckAfter">Zjistit instanci (po destroy)</button>
					</div>
					<div class="value-out" id="destroyOut">...</div>
				</div>
	
			</main>
		</div>
	
		<script>
		var widgetName = "Instance widgetu";
		$(function () {

			// ---------------------------------------------------------------
			// 1) qpSwitch
			// ---------------------------------------------------------------
			qpx.ui({
				view: "qpSwitch",
				value: true,
				onText: "Zapnuto",
				offText: "Vypnuto"
			}, "#switchDemo");

			function getSwitchInstance(method) {
				var $el = $("#switchDemo");
				switch (method) {
					case "data": return $el.data("qpSwitch");
					case "instance": return $el.qpSwitch("instance");
					case "plugin": return $el.qpSwitch();
					case "getInstance": return qpx.getInstance("#switchDemo");
				}
			}

			$(".demo-actions button[data-method]").not("[data-widget]").on("click", function () {
				var method = $(this).data("method");
				var inst = getSwitchInstance(method);
				$("#switchOut").text(
					"[" + method + "] instance nalezena: " + (!!inst) +
					", value() = " + JSON.stringify(inst && inst.value())
				);
			});

			$("#switchToggle").on("click", function () {
				$("#switchDemo").qpSwitch("toggle");
				$("#switchOut").text("Po toggle(): value() = " + $("#switchDemo").qpSwitch("instance").value());
			});

			$("#switchBulk").on("click", function () {
				$("#switchDemo").qpSwitch({ onText: "ANO", offText: "NE" });
				$("#switchOut").text("Popisky přenastaveny hromadně přes $(el).qpSwitch({...}).");
			});

			// ---------------------------------------------------------------
			// 2) qpTextBox
			// ---------------------------------------------------------------
			qpx.ui({
				view: "qpTextBox",
				value: "Ahoj qpx",
				placeholder: "Napiš něco...",
				stylingMode: "outlined"
			}, "#textboxDemo");

			function getInstanceByMethod(widgetName, elSelector, method) {
				var $el = $(elSelector);
				switch (method) {
					case "data": return $el.data(widgetName);
					case "instance": return $el[widgetName]("instance");
					case "plugin": return $el[widgetName]();
					case "getInstance": return qpx.getInstance(elSelector);
				}
			}

			$('[data-widget="textbox"]').on("click", function () {
				var method = $(this).data("method");
				var inst = getInstanceByMethod("qpTextBox", "#textboxDemo", method);
				$("#textboxOut").text(
					"[" + method + "] instance nalezena: " + (!!inst) +
					", value() = " + JSON.stringify(inst && inst.value())
				);
			});

			$("#textboxSetValue").on("click", function () {
				$("#textboxDemo").qpTextBox("value", "Nastaveno přes plugin");
				$("#textboxOut").text("Hodnota nastavena voláním metody přes plugin: $(el).qpTextBox(\"value\", ...)");
			});

			// ---------------------------------------------------------------
			// 3) qpTagBox
			// ---------------------------------------------------------------
			var fruits = ["Jablko", "Hruška", "Banán", "Pomeranč", "Meruňka"];
			qpx.ui({
				view: "qpTagBox",
				dataSource: fruits,
				value: ["Jablko", "Banán"]
			}, "#tagboxDemo");

			$('[data-widget="tagbox"]').on("click", function () {
				var method = $(this).data("method");
				var inst = getInstanceByMethod("qpTagBox", "#tagboxDemo", method);
				$("#tagboxOut").text(
					"[" + method + "] instance nalezena: " + (!!inst) +
					", value() = " + JSON.stringify(inst && inst.value())
				);
			});

			// ---------------------------------------------------------------
			// 4) qpSelectBox
			// ---------------------------------------------------------------
			qpx.ui({
				view: "qpSelectBox",
				dataSource: fruits,
				value: "Hruška"
			}, "#selectboxDemo");

			$('[data-widget="selectbox"]').on("click", function () {
				var method = $(this).data("method");
				var inst = getInstanceByMethod("qpSelectBox", "#selectboxDemo", method);
				$("#selectboxOut").text(
					"[" + method + "] instance nalezena: " + (!!inst) +
					", value() = " + JSON.stringify(inst && inst.value())
				);
			});

			// ---------------------------------------------------------------
			// 5) destroy() - ověření, že po zničení widgetu vrací
			// VŠECHNY způsoby undefined (dřív to platilo jen pro
			// data("qpx-widget"), ne pro data("qpSwitch"))
			// ---------------------------------------------------------------
			qpx.ui({ view: "qpSwitch", value: false }, "#destroyDemo");

			function describeDestroyState() {
				var results = {
					'data("qpSwitch")': $("#destroyDemo").data("qpSwitch"),
					'qpSwitch("instance")': $("#destroyDemo").qpSwitch ? $("#destroyDemo").qpSwitch("instance") : undefined,
					'qpSwitch()': $("#destroyDemo").qpSwitch ? $("#destroyDemo").qpSwitch() : undefined,
					'qpx.getInstance()': qpx.getInstance("#destroyDemo")
				};
				var lines = [];
				$.each(results, function (label, inst) {
					lines.push(label + " -> " + (inst === undefined ? "undefined" : "INSTANCE NALEZENA (chyba!)"));
				});
				return lines.join("\n");
			}

			$("#destroyCheckBefore").on("click", function () {
				$("#destroyOut").text(describeDestroyState());
			});

			$("#destroyNow").on("click", function () {
				var inst = $("#destroyDemo").data("qpSwitch");
				if (inst) { inst.destroy(); }
				$("#destroyOut").text("Widget zničen (destroy() zavolán).");
			});

			$("#destroyCheckAfter").on("click", function () {
				$("#destroyOut").text(describeDestroyState());
			});
		});
		</script>
	</body>
</html>
