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
				<h1>qpBreadcrumb – test</h1>
				<p class="subtitle">
					Navigační "drobečková" stezka inspirovaná KendoUI Breadcrumb a Fluent2 Breadcrumb —
					klikatelné položky, aktuální (poslední) položka jako nezvýrazněný text a automatické
					sbalení prostředních položek do "..." při nedostatku místa.
				</p>
			</header>
			<div class="toolbar-wrap">
				<div id="styleToolbar"></div>
			</div>
			<main>
				<div class="demo-block">
					<h2>1) Základní použití</h2>
					<p class="desc">items, value, ikony u položek, onItemClick / onValueChanged.</p>
					<div id="breadcrumb1"></div>
					<div class="value-out" id="out1"></div>
				</div>
				<div class="demo-block">
					<h2>2) Fluent2 styl — ikonový kořen</h2>
					<p class="desc">
						První položka bez textu (jen ikona domečku) — rootIcon, vlastní separatorIcon.
					</p>
					<div id="breadcrumb2"></div>
				</div>
				<div class="demo-block">
					<h2>3) Dynamická navigace (simulace procházení složek)</h2>
					<p class="desc">
						Kliknutím na položku se mění value a přidávají/odebírají se navazující úrovně —
						obdoba navigace ve správci souborů.
					</p>
					<div id="breadcrumb3"></div>
					<div class="value-out" id="out3"></div>
				</div>
				<div class="demo-block">
					<h2>4) disabled položka / disabled celý widget</h2>
					<div class="demo-col">
						<div id="breadcrumb4a"></div>
						<div id="breadcrumb4b"></div>
					</div>
				</div>
				<div class="demo-block">
					<h2>5) Přetečení (overflow)</h2>
					<p class="desc">
						Úzký kontejner s mnoha položkami — prostřední položky se automaticky sbalí do "..."
						s popup nabídkou. Zkus zmenšit okno prohlížeče.
					</p>
					<div style="max-width: 360px; border: 1px dashed var(--qpx-border, #d3d9df); padding: 6px 8px;">
						<div id="breadcrumb5"></div>
					</div>
				</div>
			</main>
		</div>

		<script>
		var widgetName = "qpBreadcrumb";		
		$(function () {
			// -----------------------------------------------------------------
			// 1) základní demo
			// -----------------------------------------------------------------
			var breadcrumb1 = qpx.ui({
				view: "qpBreadcrumb",
				items: [
					{ id: "home", text: "Domů", icon: "fa-home", url: "#" },
					{ id: "docs", text: "Dokumenty", icon: "fa-folder", url: "#" },
					{ id: "projects", text: "Projekty", icon: "fa-folder", url: "#" },
					{ id: "qpx", text: "qpx-framework" }
				],
				onValueChanged: function (e) {
					$("#out1").text("value: " + JSON.stringify(e.value));
				},
				onItemClick: function (e) {
					console.log("breadcrumb1 itemClick:", e.item);
				}
			}, "#breadcrumb1");
			$("#out1").text("value: " + JSON.stringify(breadcrumb1.value()));

			// -----------------------------------------------------------------
			// 2) Fluent2 styl - ikonový kořen + vlastní oddělovač
			// -----------------------------------------------------------------
			var breadcrumb2 = qpx.ui({
				view: "qpBreadcrumb",
				rootIcon: "fa-home",
				separatorIcon: "fa-chevron-right",
				items: [
					{ id: "root", url: "#" },
					{ id: "settings", text: "Nastavení", url: "#" },
					{ id: "users", text: "Uživatelé", url: "#" },
					{ id: "detail", text: "Jan Novák" }
				]
			}, "#breadcrumb2");

			// -----------------------------------------------------------------
			// 3) dynamická navigace - simulace stromu složek
			// -----------------------------------------------------------------
			var tree = {
				root: { text: "Disk", icon: "fa-hdd-o", children: ["dev"] },
				dev: { text: "devel", icon: "fa-folder", children: ["libs", "css"] },
				libs: { text: "libs", icon: "fa-folder", children: ["qpx"] },
				css: { text: "css", icon: "fa-folder", children: [] },
				qpx: { text: "qpx", icon: "fa-folder", children: ["widgets"] },
				widgets: { text: "widgets", icon: "fa-folder", children: [] }
			};

			function pathTo(id) {
				var path = [];
				var cur = id;
				var parentOf = {};
				$.each(tree, function (key, node) {
					(node.children || []).forEach(function (childId) { parentOf[childId] = key; });
				});
				while (cur) {
					path.unshift(cur);
					cur = parentOf[cur];
				}
				return path.map(function (nodeId) {
					return { id: nodeId, text: tree[nodeId].text, icon: tree[nodeId].icon };
				});
			}

			var breadcrumb3 = qpx.ui({
				view: "qpBreadcrumb",
				items: pathTo("widgets"),
				onItemClick: function (e) {
					$("#out3").text("naposledy kliknuto: " + e.item.text);
				},
				onValueChanged: function (e) {
					breadcrumb3.option("items", pathTo(e.value));
				}
			}, "#breadcrumb3");

			// -----------------------------------------------------------------
			// 4) disabled
			// -----------------------------------------------------------------
			var breadcrumb4a = qpx.ui({
				view: "qpBreadcrumb",
				items: [
					{ id: "a", text: "Domů", url: "#" },
					{ id: "b", text: "Nedostupná sekce", disabled: true, url: "#" },
					{ id: "c", text: "Aktuální stránka" }
				]
			}, "#breadcrumb4a");

			var breadcrumb4b = qpx.ui({
				view: "qpBreadcrumb",
				disabled: true,
				items: [
					{ id: "a", text: "Domů", url: "#" },
					{ id: "b", text: "Sekce", url: "#" },
					{ id: "c", text: "Celý breadcrumb disabled" }
				]
			}, "#breadcrumb4b");

		 // -----------------------------------------------------------------
		 // 5) přetečení
		 // -----------------------------------------------------------------
		 var breadcrumb5 = qpx.ui({
			view: "qpBreadcrumb",
			items: [
				{ id: "1", text: "Domů", icon: "fa-home", url: "#" },
				{ id: "2", text: "Sklad", url: "#" },
				{ id: "3", text: "Kategorie A", url: "#" },
				{ id: "4", text: "Podkategorie B", url: "#" },
				{ id: "5", text: "Skupina produktů C", url: "#" },
				{ id: "6", text: "Detail produktu" }
			]
		}, "#breadcrumb5");
	});
	</script>
</body>
</html>
