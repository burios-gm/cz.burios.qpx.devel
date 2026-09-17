$(function () {
	// -------------------------------------------------------------
	// TOPBAR – qpToolBar s breadcrumb + dropdown Styl
	// -------------------------------------------------------------
	qpx.ui({
		view: "qpToolBar",
		items: [{
			location: "before",
			widget: "qpBreadcrumb",
			options: {
			items: [
				{ id: "home", text: "", icon: "qpxicon qpxicon-home qpxicon-md", url: "/devel" },
				{ id: "qpWidget", text: "" + widgetName }
			]}
		}, {
			location: "after",
			widget: "qpDropDownButton",
			options: {
				text: "Styl",
				stylingMode: "text",
				icon: "css:qpxicon qpxicon-colorpalette",
				items: [
					{ key: "light", text: "Light" },
					{ key: "dark", text: "Dark" }
				],
				useSelectMode: true,
				selectedItemKey: "light",
				onItemClick: function (e) {
					var key = e.itemData.key;
					var themeClass = key === "dark"
						? "qpx-theme-dark"
						: "qpx-theme-light";

					$(document.body)
						.removeClass("qpx-theme-light qpx-theme-dark")
						.addClass(themeClass);

					$("body").toggleClass("qpx-page-dark", key === "dark");
				}
			}
		}]
	}, "#pageTopbar");
});

function applyTheme(themeClass) {
	$(".qpx-test-content")
		.removeClass("qpx-theme-light qpx-theme-dark")
		.addClass(themeClass);
	$("body").toggleClass("qpx-page-dark", themeClass === "qpx-theme-dark");
}