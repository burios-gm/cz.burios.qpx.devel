<%@ page contentType="text/html;charset=UTF-8" %>
<%@ taglib prefix="c" uri="jakarta.tags.core" %>
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
				<h1>qpSwitch</h1>
				<p class="subtitle"></p>
			</header>
			<main>
				<div id="styleToolbar"></div>
				
				<div class="demo-row">
				    <span>Výchozí přepínač:</span>
				    <div id="switchDefault"></div>
				</div>
				
				<div class="demo-row">
				    <span>Outlined styl:</span>
				    <div id="switchOutlined"></div>
				</div>
				
				<div class="demo-row">
				    <span>Flat styl (disabled):</span>
				    <div id="switchFlat"></div>
				</div>
			</main>
		</div>
		
		<script>
		var widgetName = "qpSwitch";
		    $(function () {
		        // inicializace switchů
		        var swDefault = qpx.ui({
		            view: "qpSwitch",
		            value: true,
		            onText: "Zapnuto",
		            offText: "Vypnuto",
		            stylingMode: "default",
		            onValueChanged: function (e) {
		                console.log("Default switch valueChanged:", e.value);
		            }
		        }, "#switchDefault");
		
		        var swOutlined = qpx.ui({
		            view: "qpSwitch",
		            value: false,
		            onText: "Ano",
		            offText: "Ne",
		            stylingMode: "outlined"
		        }, "#switchOutlined");
		
		        var swFlat = qpx.ui({
		            view: "qpSwitch",
		            value: true,
		            onText: "On",
		            offText: "Off",
		            stylingMode: "flat",
		            disabled: true
		        }, "#switchFlat");
		
		        // toolbar pro přepínání stylu prvního switch
		        var toolbar = qpx.ui({
		            view: "qpToolBar",
		            items: [
		                {
		                    location: "before",
		                    widget: "buttonGroup",
		                    options: {
		                        items: [
		                            { text: "Default", key: "default" },
		                            { text: "Outlined", key: "outlined" },
		                            { text: "Flat", key: "flat" }
		                        ],
		                        selectionMode: "single",
		                        selectedItemKeys: ["default"],
		                        onSelectionChanged: function (e) {
		                            var mode = e.addedItemKeys[0] || "default";
		                            swDefault.option("stylingMode", mode);
		                        }
		                    }
		                }
		            ]
		        }, "#styleToolbar");
		    });
		</script>
	</body>
</html>
