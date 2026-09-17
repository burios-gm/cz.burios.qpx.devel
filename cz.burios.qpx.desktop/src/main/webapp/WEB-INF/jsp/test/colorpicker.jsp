<%@ page contentType="text/html;charset=UTF-8" language="java" %>
<!DOCTYPE html>
<html lang="cs">
<head>
    <meta charset="UTF-8">
    <title>QPX UI - ColorPicker Demo</title>
    <!-- Font Awesome 4.7 -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
    <!-- jQuery -->
    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
    
    <!-- QPX Framework Resources -->
    <link rel="stylesheet" href="/devel/libs/app/qpx.widget.demo.css">
    <script src="/devel/libs/app/qpx.core.js"></script>
    <script src="/devel/libs/app/qpx.widget.js"></script>
    <script src="/devel/libs/app/qpx.colorpicker.js"></script>
</head>
<body>
    <div class="demo-container">
        <h1 class="demo-title">
            <i class="fa fa-paint-brush" aria-hidden="true"></i> QPX ColorPicker Component
        </h1>

        <div class="demo-section">
            <h2>Výběr barvy (Paleta i Gradient)</h2>
            <div class="demo-row">
                <div id="colorpicker-demo"></div>
            </div>
        </div>
    </div>

    <script>
        $(document).ready(function() {
            qpx.ui({
                view: "qpColorPicker",
                value: "#337ab7",
                mode: "both",
                showClearButton: true
            }, "#colorpicker-demo");
        });
    </script>
</body>
</html>