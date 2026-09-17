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
	    <script type="text/javascript" src="/devel/libs/qpx/jquery.qpx.all.js?build=${timeNo}"></script>
		<script type="text/javascript" src="/devel/api/qpx-test.js?build=${timeNo}"></script>
	
	    <style>
        /* Specifické styly jen pro DataGrid */
        .dg-toolbar {
            margin: 12px 24px 4px;
            display: flex;
            flex-wrap: wrap;
            gap: 16px;
            align-items: center;
        }
        .dg-toolbar label {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 13px;
            white-space: nowrap;
        }
        .dg-toolbar select,
        .dg-toolbar input[type="checkbox"] {
            font-size: 13px;
        }
        .dg-note {
            font-size: 12px;
            opacity: 0.7;
            margin: 4px 0 12px;
        }
	    </style>
	</head>
	
	<body class="qpx-view">
		<div class="qpx-test-topbar1">
			<div id="pageTopbar" style="width: 100%"></div>
		</div>
		<div class="qpx-test-content">
			<header class="page-head">
				<h1>qpDataGrid – test</h1>
				<p class="subtitle">
					Adaptivní tabulka s řazením, filtrováním, stránkováním, výběrem řádků a dalšími funkcemi.
				</p>
			</header>
			<!-- Toolbar -->
			<div class="dg-toolbar">
				<label>Téma:
					<select id="ctlTheme">
						<option value="qpx-theme-light">light</option>
						<option value="qpx-theme-dark">dark</option>
					</select>
				</label>
				<label><input type="checkbox" id="ctlBorders" checked> borders</label>
				<label><input type="checkbox" id="ctlRowLines" checked> row lines</label>
				<label><input type="checkbox" id="ctlColumnLines" checked> column lines</label>
				<label><input type="checkbox" id="ctlAlternation"> alternation</label>
				<label><input type="checkbox" id="ctlWordWrap"> word wrap</label>
		
				<label>Selection:
					<select id="ctlSelection">
						<option value="none">none</option>
						<option value="single">single</option>
						<option value="multiple" selected>multiple</option>
					</select>
				</label>
		
				<label>Sorting:
					<select id="ctlSorting">
						<option value="none">none</option>
						<option value="single" selected>single</option>
						<option value="multiple">multiple (shift-klik)</option>
					</select>
				</label>
		
				<label><input type="checkbox" id="ctlPaging" checked> paging</label>
				<label><input type="checkbox" id="ctlSearch" checked> search panel</label>
				<label><input type="checkbox" id="ctlFilterRow"> filter row</label>
				<label><input type="checkbox" id="ctlResizing"> column resizing</label>
				<label><input type="checkbox" id="ctlResponsive" checked> responsive</label>
		
				<label>
					Editing:
					<select id="ctlEditing">
						<option value="off" selected>vypnuto</option>
						<option value="on">add/update/delete</option>
					</select>
				</label>
			</div>
		
			<main>
				<div class="demo-block">
					<h2>qpDataGrid – hlavní demo</h2>
					<p class="dg-note">
						Zúžením okna prohlížeče vyzkoušíte adaptivní chování (skryté sloupce se přesunou do akordeonu).
						Klikem na hlavičku sloupce řadíte, se zapnutým „multiple“ řazením + Shift přidáváte další úroveň.
					</p>
					<div id="grid1"></div>
				</div>
			</main>
		</div>
		
		<script>
    	var widgetName = "qpDataGrid";
        $(function () {

            var employees = [
                { id: 1, firstName: "Jan", lastName: "Novák", position: "Vývojář", department: "IT", hireDate: "2019-03-12", salary: 62000, active: true },
                { id: 2, firstName: "Petra", lastName: "Svobodová", position: "Projektová manažerka", department: "IT", hireDate: "2017-06-01", salary: 78000, active: true },
                { id: 3, firstName: "Tomáš", lastName: "Dvořák", position: "Tester", department: "QA", hireDate: "2021-01-15", salary: 48000, active: true },
                { id: 4, firstName: "Lucie", lastName: "Černá", position: "HR specialistka", department: "HR", hireDate: "2020-09-01", salary: 45000, active: false },
                { id: 5, firstName: "Martin", lastName: "Procházka", position: "DevOps inženýr", department: "IT", hireDate: "2018-11-20", salary: 71000, active: true },
                { id: 6, firstName: "Eva", lastName: "Krejčová", position: "Účetní", department: "Finance", hireDate: "2016-04-04", salary: 52000, active: true },
                { id: 7, firstName: "Pavel", lastName: "Horák", position: "Vývojář", department: "IT", hireDate: "2022-02-28", salary: 58000, active: true },
                { id: 15, firstName: "Vojtěch", lastName: "Sedláček", position: "Vývojář", department: "IT", hireDate: "2023-06-15", salary: 54000, active: true }
            ];

            var grid = qpx.ui({
                view: "qpDataGrid",
                width: "100%",
                height: 250,
                keyExpr: "id",
                dataSource: employees,
                columns: [
                    { dataField: "firstName", caption: "Jméno", width: 120, minWidth: 100 },
                    { dataField: "lastName", caption: "Příjmení", width: 130, minWidth: 100 },
                    { dataField: "position", caption: "Pozice", width: 190, minWidth: 140 },
                    { dataField: "department", caption: "Oddělení", width: 110, minWidth: 90 },
                    { dataField: "hireDate", caption: "Nástup", width: 110, minWidth: 100, dataType: "date" },
                    { dataField: "salary", caption: "Mzda", width: 130, minWidth: 100, dataType: "number", alignment: "right", format: "currency" },
                    { dataField: "active", caption: "Aktivní", width: 90, minWidth: 80, dataType: "boolean", alignment: "center" }
                ],
                selection: { showCheckBoxesMode: "always", mode: "single" },
                sorting: { mode: "single" },
                filterRow: { visible: false },
                editing: { mode: "row", allowUpdating: false, allowAdding: false, allowDeleting: false },
                responsive: true,
                allowColumnResizing: true
            }, "#grid1");

            function applyTheme(themeClass) {
                grid.getContainer()
                    .removeClass("qpx-theme-light qpx-theme-dark")
                    .addClass(themeClass);
                $("body").toggleClass("qpx-page-dark", themeClass === "qpx-theme-dark");
            }

            applyTheme($("#ctlTheme").val());
            $("#ctlTheme").on("change", function () { applyTheme(this.value); });

            $("#ctlBorders").on("change", function () { grid.option("showBorders", this.checked); });
            $("#ctlRowLines").on("change", function () { grid.option("showRowLines", this.checked); });
            $("#ctlColumnLines").on("change", function () { grid.option("showColumnLines", this.checked); });
            $("#ctlAlternation").on("change", function () { grid.option("rowAlternationEnabled", this.checked); });
            $("#ctlWordWrap").on("change", function () { grid.option("wordWrapEnabled", this.checked); });

            $("#ctlSelection").on("change", function () { grid.option("selection.mode", this.value); });
            $("#ctlSorting").on("change", function () { grid.option("sorting.mode", this.value); });

            $("#ctlPaging").on("change", function () { grid.option("paging.enabled", this.checked); });
            $("#ctlSearch").on("change", function () { grid.option("searchPanel.visible", this.checked); });
            $("#ctlFilterRow").on("change", function () { grid.option("filterRow.visible", this.checked); });
            $("#ctlResizing").on("change", function () { grid.option("allowColumnResizing", this.checked); });
            $("#ctlResponsive").on("change", function () { grid.option("responsive", this.checked); });

            $("#ctlEditing").on("change", function () {
                var on = this.value === "on";
                grid.option("editing", {
                    mode: "row",
                    allowUpdating: on,
                    allowAdding: on,
                    allowDeleting: on,
                    confirmDelete: true
                });
            });
        });
		</script>
	</body>
</html>
