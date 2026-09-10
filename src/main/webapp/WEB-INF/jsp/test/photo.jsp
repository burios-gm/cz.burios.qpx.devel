<%@ page contentType="text/html;charset=UTF-8" %>
<html lang="cs">
	<head>
		<meta charset="UTF-8">
		<meta name="viewport" content="width=device-width, initial-scale=1">
	
		<title>Buriosca.cz Buquet</title>

		<link rel="icon" href="/devel/favicon.png">
		<link rel="stylesheet" href="/buquet/libs/jqx/jqx.css" rel="stylesheet" type="text/css">

		<style type="text/css">
		html, body {
			font-family: Segoe UI;
			font-size: 13px;
		}		
		</style>

		<script type="text/javascript" src="/buquet/libs/jquery/jquery-3.7.1.js"></script>
		<script type="text/javascript" src="/buquet/libs/bq/bqPhoto.js?build=${timeNo}"></script>
	</head>
	<body>
		<h2>Buriosca.cz Buquet - Photo</h2>
		
		<div id="photo" data-role="bqPhoto"></div>

		<script>
		$(function(){
			$("#photo").bqPhoto({
				uploadUrl: "/buquet/api/images/upload",
				loadUrl: "/buquet/api/images/download?fileId=FS02-00000000001", 
				onUpload: function(file, resp, data){
					console.log("Nahrán soubor:", file.name);
					console.log("Nová adresa obrázku:", data.url);
				}
			});
		});
		</script>
		<%--
		 
		--%>		
	</body>
</html>