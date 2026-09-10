const gulp = require('gulp');
const concat = require('gulp-concat');

// Definice úkolu pro sestavení JS
gulp.task('build-js', function() {
	return gulp.src([
		// Zde definujte soubory v PŘESNÉM pořadí, jak mají jít za sebou
		"src/main/webapp/libs/qpx/src/qpx.core.js",
		"src/main/webapp/libs/qpx/src/qpx.widget.js",
		"src/main/webapp/libs/qpx/src/qpx.layout.js",
		"src/main/webapp/libs/qpx/src/qpx.template.js",
		"src/main/webapp/libs/qpx/src/qpx.button.js",
		"src/main/webapp/libs/qpx/src/qpx.buttongroup.js",
		"src/main/webapp/libs/qpx/src/qpx.dropdownbutton.js",
		"src/main/webapp/libs/qpx/src/qpx.switch.js",
		"src/main/webapp/libs/qpx/src/qpx.checkbox.js",
		"src/main/webapp/libs/qpx/src/qpx.numberbox.js",
		"src/main/webapp/libs/qpx/src/qpx.textbox.js",
		"src/main/webapp/libs/qpx/src/qpx.colorpicker.js",
		"src/main/webapp/libs/qpx/src/qpx.datepicker.js",
		"src/main/webapp/libs/qpx/src/qpx.tagbox.js",
		"src/main/webapp/libs/qpx/src/qpx.autocomplete.js",
		"src/main/webapp/libs/qpx/src/qpx.selectbox.js",
		"src/main/webapp/libs/qpx/src/qpx.dropdownbox.js",
		"src/main/webapp/libs/qpx/src/qpx.lookup.js",
		"src/main/webapp/libs/qpx/src/qpx.breadcrumb.js",
		"src/main/webapp/libs/qpx/src/qpx.scrollview.js",
		"src/main/webapp/libs/qpx/src/qpx.grouplist.js",
		"src/main/webapp/libs/qpx/src/qpx.flexlayout.js",
		"src/main/webapp/libs/qpx/src/qpx.gridlayout.js",
		"src/main/webapp/libs/qpx/src/qpx.toolbar.js",
		"src/main/webapp/libs/qpx/src/qpx.tabview.js",
		"src/main/webapp/libs/qpx/src/qpx.ribbon.js",
		"src/main/webapp/libs/qpx/src/qpx.ribbonbutton.js",
		"src/main/webapp/libs/qpx/src/qpx.ribbondropdownbutton.js",
		"src/main/webapp/libs/qpx/src/qpx.treeview.js",
		"src/main/webapp/libs/qpx/src/qpx.propertygrid.js",
		"src/main/webapp/libs/qpx/src/qpx.datagrid.js",
		"src/main/webapp/libs/qpx/src/qpx.syntaxeditor.js",
		
		/*
		*/
		"src/main/webapp/libs/qpx/src/qpx.parser.js"

	])
	.pipe(concat('jquery.qpx.all.js')) // Název výsledného souboru
	.pipe(gulp.dest('src/main/webapp/libs/qpx/')); // Cílová složka
});