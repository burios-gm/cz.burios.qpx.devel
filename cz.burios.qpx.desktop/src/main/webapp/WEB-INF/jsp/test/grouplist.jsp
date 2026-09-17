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

		<style>
		/* Pomocné styly jen pro tuto testovací stránku, ne součást qpGroupList. */
		.demo-badge {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			min-width: 16px;
			padding: 1px 6px;
			margin-left: auto;
			border-radius: 999px;
			font-size: 10px;
			font-weight: 700;
			color: #fff;
		}
		.demo-badge-new { background: #337ab7; }
		.demo-badge-progress { background: #f0ad4e; }
		.demo-badge-done { background: #5cb85c; }
		
		.demo-cols {
			display: flex;
			flex-wrap: wrap;
			gap: 20px;
		}
		.demo-cols > div { flex: 1 1 260px; min-width: 220px; }
		</style>
	</head>
	<body class="qpx-view">
		<div class="qpx-test-topbar1">
			<div id="pageTopbar" style="width: 100%"></div>
		</div>

		<div class="qpx-test-content">
			<header class="page-head">
				<h1>qpGroupList – test</h1>
				<p class="subtitle">
					Seznam s položkami rozdělenými do skupin, inspirovaný Webix GroupList —
					"lepivá" záhlaví skupin při scrollování, boční rychlý index,
					single/multi výběr položek a vestavěné hierarchické procházení
					dat (drill-down).
				</p>
			</header>
			<main>
				<div class="toolbar-wrap">
					<div id="styleToolbar"></div>
				</div>
				<div class="demo-block">
					<h2>1) Základní seznam (kontakty A–Z)</h2>
					<p class="desc">
						data + groupBy: "group", sortGroups: true — záhlaví skupiny zůstává
						při scrollování "přilepené" nahoře (position: sticky, čisté CSS).
					</p>
					<div id="grouplist1" style="height: 260px;"></div>
					<div class="value-out" id="out1"></div>
				</div>
				<div class="demo-block">
					<h2>2) S bočním rychlým indexem</h2>
					<p class="desc">showIndex: true — kliknutím na písmeno se seznam odscrolluje na danou skupinu.</p>
					<div id="grouplist2" style="height: 260px;"></div>
				</div>
				<div class="demo-block">
					<h2>3) Vícenásobný výběr (multiselect)</h2>
					<p class="desc">multiselect: true — klikání jednotlivé položky přidává/odebírá z výběru.</p>
					<div class="demo-cols">
						<div id="grouplist3" style="height: 220px;"></div>
						<div>
							<p class="desc" style="margin-top:0;">Vybráno:</p>
							<div class="value-out" id="out3">—</div>
						</div>
					</div>
				</div>
				<div class="demo-block">
					<h2>4) Vlastní šablona položky (itemTemplate)</h2>
					<p class="desc">Úkoly seskupené podle stavu, každá položka s vlastní barevnou značkou.</p>
					<div id="grouplist4" style="height: 240px;"></div>
				</div>
				<div class="demo-block">
					<h2>5) Hierarchická data (drill-down)</h2>
					<p class="desc">
						drillDown: true — data mají až 4 úrovně, ne ve všech větvích stejně
						hluboko (viz strom níže). Vždy se zobrazuje jen jedna úroveň jedné
						větve — kliknutím na složku (položku s "children") se posunete o
						úroveň níž, nahoře se automaticky objeví klikatelný řádek "Zpět"
						pro návrat o úroveň výš (funguje i klávesa Esc). U koncových položek
						(bez potomků) se zpráva vypíše jen do konzole.
					</p>
					<div id="grouplist6" style="height: 260px;"></div>
					<div class="value-out" id="out6">Konzole: zatím nic nevybráno</div>
				</div>
				<div class="demo-block">
					<h2>6) disabled: true</h2>
					<div id="grouplist5" style="height: 160px;"></div>
				</div>
			</main>
		</div>
		
		<script>
		var widgetName = "qpGroupList"
		$(function () {

            // -----------------------------------------------------------------
            // společná demo data - kontakty seskupené podle prvního písmene
            // -----------------------------------------------------------------
            var contactNames = [
                "Adam Novák", "Alena Dvořáková", "Bedřich Svoboda", "Barbora Nováková",
                "Cyril Beneš", "Dana Procházková", "David Král", "Eva Horáková",
                "Filip Kučera", "Gabriela Marešová", "Hana Veselá", "Ivan Pokorný",
                "Jana Černá", "Jiří Sedláček", "Karel Urban", "Klára Bartošová",
                "Lukáš Doležal", "Magda Kadlecová", "Martin Fiala", "Nikola Šimková",
                "Oldřich Beran", "Petra Vaňková", "Radek Musil", "Šárka Malá",
                "Tomáš Vlček", "Václav König", "Zdeněk Holub", "Žaneta Krejčí"
            ];
            var contacts = contactNames.map(function (name, i) {
                return { id: i + 1, group: name.charAt(0).toUpperCase(), text: name, icon: "fa-user-o" };
            });

            // -----------------------------------------------------------------
            // 1) základní seznam
            // -----------------------------------------------------------------
            var grouplist1 = qpx.ui({
                view: "qpGroupList",
                data: contacts,
                groupBy: "group",
                sortGroups: true,
                onSelectionChanged: function (e) {
                    var item = grouplist1.getSelectedItem();
                    $("#out1").text(item ? ("vybráno: " + item.text) : "nic není vybráno");
                }
            }, "#grouplist1");
            $("#out1").text("nic není vybráno");

            // -----------------------------------------------------------------
            // 2) s bočním indexem
            // -----------------------------------------------------------------
            var grouplist2 = qpx.ui({
                view: "qpGroupList",
                data: contacts,
                groupBy: "group",
                sortGroups: true,
                showIndex: true
            }, "#grouplist2");

            // -----------------------------------------------------------------
            // 3) multiselect
            // -----------------------------------------------------------------
            var groceries = [
                { id: 1, group: "Ovoce", text: "Jablka" },
                { id: 2, group: "Ovoce", text: "Banány" },
                { id: 3, group: "Ovoce", text: "Hrušky" },
                { id: 4, group: "Zelenina", text: "Mrkev" },
                { id: 5, group: "Zelenina", text: "Brambory" },
                { id: 6, group: "Zelenina", text: "Cibule" },
                { id: 7, group: "Pečivo", text: "Chléb" },
                { id: 8, group: "Pečivo", text: "Rohlíky" }
            ];
            var grouplist3 = qpx.ui({
                view: "qpGroupList",
                data: groceries,
                groupBy: "group",
                multiselect: true,
                onSelectionChanged: function () {
                    var items = grouplist3.getSelectedItems();
                    $("#out3").text(items.length ? items.map(function (it) { return it.text; }).join(", ") : "—");
                }
            }, "#grouplist3");

            // -----------------------------------------------------------------
            // 4) vlastní šablona položky
            // -----------------------------------------------------------------
            var badgeClass = { "Nové": "demo-badge-new", "Probíhá": "demo-badge-progress", "Hotovo": "demo-badge-done" };
            var tasks = [
                { id: 1, group: "Nové", text: "Připravit podklady pro schůzku" },
                { id: 2, group: "Nové", text: "Zkontrolovat faktury" },
                { id: 3, group: "Probíhá", text: "Refaktoring modulu objednávek" },
                { id: 4, group: "Probíhá", text: "Testování nové verze API" },
                { id: 5, group: "Hotovo", text: "Aktualizace dokumentace" },
                { id: 6, group: "Hotovo", text: "Nasazení na testovací prostředí" }
            ];
            var grouplist4 = qpx.ui({
                view: "qpGroupList",
                data: tasks,
                groupBy: "group",
                itemTemplate: function (item) {
                    return "<span>" + item.text + "</span><span class='demo-badge " + badgeClass[item.group] + "'>" + item.group + "</span>";
                }
            }, "#grouplist4");

            // -----------------------------------------------------------------
            // 5) hierarchická data (drill-down) - vestavěná funkcionalita
            // qpGroupList (drillDown: true), bez samostatného breadcrumb.
            //
            // Strom má až 4 úrovně, ale ne ve všech větvích stejně hluboko:
            //   Dokumenty > Smlouvy > Rok 2024 > Smlouva_A.pdf   (4 úrovně)
            //   Dokumenty > Faktury > Faktura_2024_01.pdf         (3 úrovně)
            //   Obrázky > Dovolená.jpg                            (2 úrovně)
            //   Ředitel.docx                                      (1 úroveň)
            //
            // group/icon se u každého uzlu určí podle toho, jestli má "children"
            // (je to "složka") nebo ne (je to "soubor" = koncová položka).
            // -----------------------------------------------------------------
            var treeUid = 0;
            function treeNode(text, children) {
                treeUid += 1;
                var hasChildren = !!(children && children.length);
                return {
                    id: "n" + treeUid,
                    text: text,
                    icon: hasChildren ? "fa-folder" : "fa-file-o",
                    group: hasChildren ? "Složky" : "Soubory",
                    children: children || null
                };
            }

            var fileTree = [
                treeNode("Dokumenty", [
                    treeNode("Smlouvy", [
                        treeNode("Rok 2024", [
                            treeNode("Smlouva_A.pdf"),
                            treeNode("Smlouva_B.pdf")
                        ]),
                        treeNode("Rok 2023", [
                            treeNode("Smlouva_C.pdf")
                        ])
                    ]),
                    treeNode("Faktury", [
                        treeNode("Faktura_2024_01.pdf")
                    ])
                ]),
                treeNode("Obrázky", [
                    treeNode("Dovolená.jpg")
                ]),
                treeNode("Ředitel.docx")
            ];

            var grouplist6 = qpx.ui({
                view: "qpGroupList",
                data: fileTree,
                groupBy: "group",
                sortGroups: true, // "Složky" < "Soubory" abecedně -> složky nahoře
                drillDown: true,
                onItemClick: function (e) {
                    var item = e.item;
                    // sem se widget dostane při KAŽDÉM kliknutí - pokud má
                    // položka "children", posun o úroveň níž zajistí sám
                    // qpGroupList (drillDown); zajímá nás jen koncová položka
                    if (!(item.children && item.children.length)) {
                        console.log("qpGroupList - koncová položka:", item.text, item);
                        $("#out6").text("Konzole: koncová položka „" + item.text + "“ (id " + item.id + ")");
                    }
                },
                onDrillChange: function (e) {
                    console.log("qpGroupList - drillChange:", e.direction, "level", e.level, e.node ? e.node.text : "(kořen)");
                }
            }, "#grouplist6");

            // -----------------------------------------------------------------
            // 6) disabled
            // -----------------------------------------------------------------
            var grouplist5 = qpx.ui({
                view: "qpGroupList",
                disabled: true,
                data: contacts.slice(0, 8),
                groupBy: "group",
                sortGroups: true
            }, "#grouplist5");
		});
		</script>
	</body>
</html>
