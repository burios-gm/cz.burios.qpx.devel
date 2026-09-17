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
		
		<style>
        /* Pomocné styly jen pro tuto testovací stránku (obsah demo karet
           a volně scrollovatelného "plátna"), ne součást qpScrollView. */
        .demo-card {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100%;
            font-size: 20px;
            font-weight: 600;
            color: var(--qpx-accent, #337ab7);
        }
        .demo-card-wide {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            justify-content: center;
            height: 100%;
            padding: 0 4px;
        }
        .demo-card-wide b { color: var(--qpx-accent, #337ab7); }
        .demo-card-wide span { font-size: 12px; color: var(--qpx-text-muted, #767676); margin-top: 4px; }

        .demo-canvas {
            position: relative;
            width: 1600px;
            height: 700px;
            background-image:
                linear-gradient(var(--qpx-border, #d3d9df) 1px, transparent 1px),
                linear-gradient(90deg, var(--qpx-border, #d3d9df) 1px, transparent 1px);
            background-size: 40px 40px;
            background-color: var(--qpx-surface, #f8f9fb);
        }
        .demo-pin {
            position: absolute;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 34px;
            height: 34px;
            border-radius: 50%;
            background: var(--qpx-accent, #337ab7);
            color: var(--qpx-accent-contrast, #fff);
            font-weight: 600;
            box-shadow: 0 2px 6px var(--qpx-shadow, rgba(0,0,0,.2));
        }

        .demo-btnbar {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-bottom: 10px;
        }
        .demo-btnbar button {
            padding: 5px 12px;
            font-size: 12px;
            border: 1px solid var(--qpx-border, #d3d9df);
            border-radius: 4px;
            background: var(--qpx-surface, #f8f9fb);
            color: var(--qpx-text, #333);
            cursor: pointer;
        }
        .demo-btnbar button:hover {
            background: var(--qpx-hover, #eceff1);
            color: var(--qpx-accent, #337ab7);
        }
		</style>
	</head>

	<body class="qpx-view">
		<div class="qpx-test-topbar1">
			<div id="pageTopbar" style="width: 100%"></div>
		</div>

		<div class="qpx-test-content">
			<header class="page-head">
				<h1>qpScrollView – test</h1>
				<p class="subtitle">
					Kontejner pro scrollovatelný obsah inspirovaný Webix ScrollView —
					karty vedle sebe/pod sebou nebo libovolně velké volné plátno,
					tažení myší, přichytávání na položky a šipky prev/next.
				</p>
			</header>
	        <div class="toolbar-wrap">
	            <div id="styleToolbar"></div>
	        </div>
			<main>
				<div class="demo-block">
					<h2>1) Vodorovný carousel karet</h2>
					<p class="desc">items, direction: "x", snap: true, showNav: true.</p>
					<div style="height: 110px;" id="scrollview1"></div>
				</div>
	
				<div class="demo-block">
					<h2>2) Svislý seznam</h2>
					<p class="desc">direction: "y", pevná výška kontejneru, obsah je vyšší než viewport.</p>
					<div style="height: 220px; max-width: 360px;" id="scrollview2"></div>
				</div>
	
				<div class="demo-block">
					<h2>3) Volné 2D plátno (pan)</h2>
					<p class="desc">
						content: libovolně velký HTML obsah, direction: "xy" — tažením myší (nebo
						šipkami po kliknutí do plochy) lze plátnem posouvat oběma směry.
					</p>
					<div style="height: 320px;" id="scrollview3"></div>
				</div>
	
				<div class="demo-block">
					<h2>4) API — scrollTo / scrollBy / next / prev</h2>
					<p class="desc">Ovládání zvenčí + odezva přes onScroll / onScrollEnd.</p>
					<div class="demo-btnbar">
						<button type="button" id="btnApiStart">Na začátek</button>
						<button type="button" id="btnApiPrev">◀ Předchozí</button>
						<button type="button" id="btnApiNext">Další ▶</button>
						<button type="button" id="btnApiEnd">Na konec</button>
					</div>
					<div style="height: 90px;" id="scrollview4"></div>
					<div class="value-out" id="out4"></div>
				</div>
	
				<div class="demo-block">
					<h2>5) disabled: true</h2>
					<div style="height: 90px;" id="scrollview5"></div>
				</div>
			</main>
		</div>

		<script>
		var widgetName = "qpScrollView";
        $(function () {
			
            function cardsHtml(count, wide) {
                var items = [];
                for (var i = 1; i <= count; i++) {
                    items.push(wide
                        ? "<div class='demo-card-wide'><b>Karta " + i + "</b><span>Popisek položky č. " + i + "</span></div>"
                        : "<div class='demo-card'>" + i + "</div>");
                }
                return items;
            }

            // -----------------------------------------------------------------
            // 1) vodorovný carousel karet - snap + navigační šipky
            // -----------------------------------------------------------------
            var scrollview1 = qpx.ui({
                view: "qpScrollView",
                direction: "x",
                items: cardsHtml(10, false),
                itemWidth: 90,
                gap: 10,
                snap: true,
                showNav: true
            }, "#scrollview1");

            // -----------------------------------------------------------------
            // 2) svislý seznam
            // -----------------------------------------------------------------
            var scrollview2 = qpx.ui({
                view: "qpScrollView",
                direction: "y",
                items: cardsHtml(8, true),
                itemHeight: 56,
                gap: 8
            }, "#scrollview2");

            // -----------------------------------------------------------------
            // 3) volné 2D plátno - tažení myší, klávesová navigace
            // -----------------------------------------------------------------
            var scrollview3 = qpx.ui({
                view: "qpScrollView",
                direction: "xy",
                content:
                    "<div class='demo-canvas'>" +
                    "<div class='demo-pin' style='left:60px;top:40px;'>A</div>" +
                    "<div class='demo-pin' style='left:520px;top:180px;'>B</div>" +
                    "<div class='demo-pin' style='left:940px;top:60px;'>C</div>" +
                    "<div class='demo-pin' style='left:280px;top:420px;'>D</div>" +
                    "<div class='demo-pin' style='left:1180px;top:520px;'>E</div>" +
                    "</div>"
            }, "#scrollview3");

            // -----------------------------------------------------------------
            // 4) API demo
            // -----------------------------------------------------------------
            var scrollview4 = qpx.ui({
                view: "qpScrollView",
                direction: "x",
                items: cardsHtml(14, false),
                itemWidth: 70,
                gap: 8,
                onScroll: function (e) {
                    $("#out4").text("x: " + Math.round(e.x) + " / maxX: " + Math.round(e.maxX));
                },
                onScrollEnd: function (e) {
                    console.log("scrollview4 scrollEnd:", e);
                }
            }, "#scrollview4");
            $("#out4").text("x: 0 / maxX: " + Math.round(scrollview4.getScrollState().maxX));

            $("#btnApiStart").on("click", function () { scrollview4.scrollTo(0, null); });
            $("#btnApiEnd").on("click", function () { scrollview4.scrollTo(999999, null); });
            $("#btnApiPrev").on("click", function () { scrollview4.prev(); });
            $("#btnApiNext").on("click", function () { scrollview4.next(); });

            // -----------------------------------------------------------------
            // 5) disabled
            // -----------------------------------------------------------------
            var scrollview5 = qpx.ui({
                view: "qpScrollView",
                direction: "x",
                disabled: true,
                items: cardsHtml(8, false),
                itemWidth: 90,
                gap: 10
            }, "#scrollview5");

		});
		</script>
	</body>
</html>
