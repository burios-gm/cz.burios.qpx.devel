<%@ page language="java" contentType="text/html; charset=UTF-8" %>
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
				<h1>qpTreeView – test</h1>
				<p class="subtitle">Jednořádkové textové pole — analogie DevExtreme dxTextBox.</p>
			</header>
			<main>
				<div class="toolbar-wrap">
					<label><input type="checkbox" id="themeToggle"> tmavé téma (generic-dark)</label>
				</div>
				<div class="demo-block">
					<div id="tree"></div>
				</div>
			</main>
		</div>
		<script>
		var widgetName = "qpTreeView";
		$(function () {
			/*
			$("#tree").qpx("qpTreeView", {
				items: [
					{ id: 1, parentId: null, text: "Root A", expanded: true },
					{ id: 2, parentId: 1, text: "Child A1" },
					{ id: 3, parentId: 1, text: "Child A2", expanded: true },
					{ id: 4, parentId: 3, text: "Child A2.1" },
					
					{ id: 10, parentId: null, text: "Root B" },
					{ id: 11, parentId: 10, text: "Child B1" },
					{ id: 12, parentId: 10, text: "Child B2" }
				],
				selectionMode: "single",
				showCheckBoxesMode: "normal",
				dragEnabled: true,
				// cascadeCheck: true,
				useIndeterminate: true,				
				onItemClick: function (e) {
					console.log("Item clicked:", e.key, e.itemData && e.itemData.text);
				},
				onSelectionChanged: function (e) {
					console.log("Selected keys:", e.selectedItemKeys);
				},
				onMove: function (e) {
					console.log("Moved:", e.sourceKey, "to parent", e.newParent, "(from", e.oldParent, ")");
				},
				onReorder: function (e) {
					console.log("Reordered:", e.sourceKey, e.dropType, "relative to", e.targetKey);
				},
				onDrop: function (e) {
					console.log("Drop:", e.sourceKey, "->", e.targetKey, "type:", e.dropType);
				}
			});
			*/
			var treeview = qpx.ui({
				view: "qpTreeView",
				items: [
					{ id: 1, parentId: null, text: "Root A", expanded: true },
					{ id: 2, parentId: 1, text: "Child A1" },
					{ id: 3, parentId: 1, text: "Child A2", expanded: true },
					{ id: 4, parentId: 3, text: "Child A2.1" },
					
					{ id: 10, parentId: null, text: "Root B" },
					{ id: 11, parentId: 10, text: "Child B1" },
					{ id: 12, parentId: 10, text: "Child B2" }
				],
				selectionMode: "single",
				showCheckBoxesMode: "normal",
				dragEnabled: true,
				// cascadeCheck: true,
				useIndeterminate: true,				
				onItemClick: function (e) {
					console.log("Item clicked:", e.key, e.itemData && e.itemData.text);
				},
				onSelectionChanged: function (e) {
					console.log("Selected keys:", e.selectedItemKeys);
				},
				onMove: function (e) {
					console.log("Moved:", e.sourceKey, "to parent", e.newParent, "(from", e.oldParent, ")");
				},
				onReorder: function (e) {
					console.log("Reordered:", e.sourceKey, e.dropType, "relative to", e.targetKey);
				},
				onDrop: function (e) {
					console.log("Drop:", e.sourceKey, "->", e.targetKey, "type:", e.dropType);
				}
			}, "#tree");

			$("#themeToggle").on("change", function () {
				treeview.option("theme", this.checked ? "dark" : "light");
			});
		});
		</script>
	</body>
</html>
