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
	</head>
	<body class="qpx-view">
		<div class="qpx-test-topbar1">
			<div id="pageTopbar" style="width: 100%"></div>
		</div>

		<div class="qpx-test-content">
			<header class="page-head">
				<h1>qpForm – test</h1>
				<p class="subtitle">
					Formulář ve stylu Webix Form — deklarativní strom "elements" (řádky/sloupce/fieldset/pole),
					popisky s konfigurovatelnou šířkou/pozicí, validace přes "rules", getValues()/setValues(),
					a skutečný <code>&lt;form&gt;</code> element pod kapotou.
				</p>
			</header>
			<div class="toolbar-wrap">
				<div id="styleToolbar"></div>
			</div>
			<main>
				<!-- ============================================================ -->
				<div class="demo-block">
					<h2>1) Základní použití — labelPosition: "left" (výchozí)</h2>
					<p class="desc">
						elements s různými typy polí (qpTextBox, qpNumberBox, qpCheckBox, qpSwitch, qpSelectBox,
						qpDatePicker), required, rules.email. API: getValues() / setValues() / clear() / validate().
					</p>
					<div id="form1"></div>
					<div class="demo-actions">
						<button type="button" id="btnGetValues1">getValues()</button>
						<button type="button" id="btnSetValues1">setValues({...})</button>
						<button type="button" id="btnValidate1">validate()</button>
						<button type="button" id="btnClear1">clear()</button>
					</div>
					<div class="value-out" id="out1">...</div>
				</div>

				<!-- ============================================================ -->
				<div class="demo-block">
					<h2>2) labelPosition: "top" + cols (pole vedle sebe)</h2>
					<p class="desc">Řádek adresy jako dvojice polí vedle sebe (cols), popisek nad polem.</p>
					<div id="form2"></div>
				</div>

				<!-- ============================================================ -->
				<div class="demo-block">
					<h2>3) fieldset — skupiny polí</h2>
					<p class="desc">elements: [{ view: "fieldset", label: "...", elements: [...] }, ...]</p>
					<div id="form3"></div>
				</div>

				<!-- ============================================================ -->
				<div class="demo-block">
					<h2>4) Validace — required / minLength / pattern / range</h2>
					<p class="desc">
						rules: { pole: pravidlo | [pravidla] } — vestavěná qpx.formRules i vlastní { check, message }.
						Klik na "Validovat" spustí validate() nad celým formulářem a označí neplatná pole.
					</p>
					<div id="form4"></div>
					<div class="demo-actions">
						<button type="button" id="btnValidate4">validate()</button>
						<button type="button" id="btnClearValidation4">clearValidation()</button>
					</div>
					<div class="value-out" id="out4">...</div>
				</div>

				<!-- ============================================================ -->
				<div class="demo-block">
					<h2>5) Skutečný submit na server (Java controller)</h2>
					<p class="desc">
						Tlačítko "Odeslat" zavolá form.submit() → interní validate() → event onSubmit.
						Pokud je formulář platný, hodnoty (getValues()) se pošlou AJAX POST na
						<code>/devel/api/form/submit</code> (Spring MVC <code>FormController</code>), který
						je vrátí zpět jako JSON — vidíte tedy skutečný round-trip na server.
					</p>
					<div id="form5"></div>
					<div class="value-out" id="out5">Zatím neodesláno...</div>
				</div>

				<!-- ============================================================ -->
				<div class="demo-block">
					<h2>6) disabled / readOnly celý formulář</h2>
					<p class="desc">option("disabled", true) / option("readOnly", true) se propíše na všechna vnořená pole.</p>
					<div class="demo-actions">
						<button type="button" id="btnToggleDisabled6">Přepnout disabled</button>
						<button type="button" id="btnToggleReadOnly6">Přepnout readOnly</button>
					</div>
					<div id="form6" style="margin-top: 10px;"></div>
				</div>
			</main>
		</div>

		<script>
		var widgetName = "qpForm";
		$(function () {

			var roles = [
				{ id: "admin", text: "Administrátor" },
				{ id: "user", text: "Uživatel" },
				{ id: "guest", text: "Host" }
			];

			// -----------------------------------------------------------------
			// 1) základní demo
			// -----------------------------------------------------------------
			var form1 = qpx.ui({
				view: "qpForm",
				labelWidth: 130,
				elements: [
					{ view: "qpTextBox", name: "firstName", label: "Jméno", required: true, placeholder: "Zadejte jméno" },
					{ view: "qpTextBox", name: "lastName", label: "Příjmení", required: true, placeholder: "Zadejte příjmení" },
					{ view: "qpTextBox", name: "email", label: "E-mail", placeholder: "vas@email.cz", hint: "Použije se pro zaslání potvrzení." },
					{ view: "qpNumberBox", name: "age", label: "Věk", value: 30, min: 0, max: 120 },
					{ view: "qpSelectBox", name: "role", label: "Role", dataSource: roles, valueExpr: "id", displayExpr: "text", value: "user" },
					{ view: "qpDatePicker", name: "birthDate", label: "Datum narození", formatString: "dd.MM.yyyy" },
					{ view: "qpCheckBox", name: "subscribe", label: "", text: "Přihlásit k odběru novinek", value: true },
					{ view: "qpSwitch", name: "active", label: "Aktivní účet", value: true }
				],
				rules: {
					email: qpx.formRules.email
				},
				onChange: function (e) {
					console.log("form1 change:", e.name, "->", e.value);
				},
				onValidated: function (e) {
					console.log("form1 validated:", e.isValid, e.results);
				}
			}, "#form1");

			$("#out1").text("values: " + JSON.stringify(form1.getValues()));

			$("#btnGetValues1").on("click", function () {
				$("#out1").text("values: " + JSON.stringify(form1.getValues()));
			});
			$("#btnSetValues1").on("click", function () {
				form1.setValues({ firstName: "Jana", lastName: "Nováková", email: "jana.novakova@example.cz", age: 27 });
				$("#out1").text("hodnoty nastaveny přes setValues()");
			});
			$("#btnValidate1").on("click", function () {
				var isValid = form1.validate();
				$("#out1").text("validate() -> " + isValid);
			});
			$("#btnClear1").on("click", function () {
				form1.clear();
				$("#out1").text("formulář vyčištěn (clear())");
			});

			// -----------------------------------------------------------------
			// 2) labelPosition: top + cols
			// -----------------------------------------------------------------
			var form2 = qpx.ui({
				view: "qpForm",
				labelPosition: "top",
				colGap: 16,
				elements: [
					{ view: "qpTextBox", name: "street", label: "Ulice a číslo popisné", placeholder: "Hlavní 123" },
					{
						cols: [
							{ view: "qpTextBox", name: "city", label: "Město", placeholder: "Praha" },
							{ view: "qpTextBox", name: "zip", label: "PSČ", placeholder: "100 00", width: 120 }
						]
					},
					{ view: "qpSelectBox", name: "country", label: "Země", dataSource: ["Česko", "Slovensko", "Rakousko", "Německo"], value: "Česko" }
				]
			}, "#form2");

			// -----------------------------------------------------------------
			// 3) fieldset skupiny
			// -----------------------------------------------------------------
			var form3 = qpx.ui({
				view: "qpForm",
				labelWidth: 130,
				elements: [
					{
						view: "fieldset", label: "Osobní údaje",
						elements: [
							{ view: "qpTextBox", name: "f3_name", label: "Jméno", required: true },
							{ view: "qpTextBox", name: "f3_surname", label: "Příjmení", required: true }
						]
					},
					{
						view: "fieldset", label: "Kontakt",
						elements: [
							{ view: "qpTextBox", name: "f3_email", label: "E-mail" },
							{ view: "qpTextBox", name: "f3_phone", label: "Telefon" }
						]
					}
				]
			}, "#form3");

			// -----------------------------------------------------------------
			// 4) validace - required / minLength / pattern / range
			// -----------------------------------------------------------------
			var form4 = qpx.ui({
				view: "qpForm",
				labelWidth: 150,
				elements: [
					{ view: "qpTextBox", name: "username", label: "Uživatelské jméno", required: true, hint: "Min. 4 znaky." },
					{ view: "qpTextBox", name: "pin", label: "PIN (4 číslice)", hint: "Přesně 4 číslice." },
					{ view: "qpNumberBox", name: "quantity", label: "Množství (1–10)", value: 5 }
				],
				rules: {
					username: [qpx.formRules.required, qpx.formRules.minLength(4)],
					pin: qpx.formRules.pattern(/^\d{4}$/),
					quantity: qpx.formRules.range(1, 10)
				},
				onValidated: function (e) {
					$("#out4").text("isValid: " + e.isValid + "\n" + JSON.stringify(e.results, null, 2));
				}
			}, "#form4");

			$("#btnValidate4").on("click", function () { form4.validate(); });
			$("#btnClearValidation4").on("click", function () {
				form4.clearValidation();
				$("#out4").text("validace zrušena (clearValidation())");
			});

			// -----------------------------------------------------------------
			// 5) skutečný submit na server (Java controller)
			// -----------------------------------------------------------------
			var form5 = qpx.ui({
				view: "qpForm",
				labelWidth: 120,
				elements: [
					{ view: "qpTextBox", name: "name", label: "Jméno", required: true, placeholder: "Vaše jméno" },
					{ view: "qpTextBox", name: "email", label: "E-mail", required: true, placeholder: "vas@email.cz" },
					{ view: "qpTextBox", name: "message", label: "Zpráva", placeholder: "Text zprávy..." },
					{ view: "qpButton", text: "Odeslat na server", type: "default", onClick: function () { form5.submit(); } }
				],
				rules: {
					email: qpx.formRules.email
				},
				onSubmit: function (e) {
					if (!e.isValid) {
						$("#out5").text("Formulář obsahuje chyby — odeslání zrušeno.");
						return;
					}
					$("#out5").text("Odesílám na server...");
					$.ajax({
						url: "/devel/api/form/submit",
						method: "POST",
						data: e.values
					}).done(function (resp) {
						$("#out5").text("Odpověď serveru (FormController):\n" + JSON.stringify(resp, null, 2));
					}).fail(function (xhr) {
						$("#out5").text("Chyba požadavku: HTTP " + xhr.status);
					});
				}
			}, "#form5");

			// -----------------------------------------------------------------
			// 6) disabled / readOnly
			// -----------------------------------------------------------------
			var form6 = qpx.ui({
				view: "qpForm",
				labelWidth: 130,
				elements: [
					{ view: "qpTextBox", name: "f6_a", label: "Pole A", value: "Ukázková hodnota" },
					{ view: "qpSelectBox", name: "f6_b", label: "Pole B", dataSource: ["Volba 1", "Volba 2"], value: "Volba 1" },
					{ view: "qpCheckBox", name: "f6_c", label: "", text: "Zaškrtávací pole", value: true }
				]
			}, "#form6");

			$("#btnToggleDisabled6").on("click", function () {
				form6.option("disabled", !form6.option("disabled"));
			});
			$("#btnToggleReadOnly6").on("click", function () {
				form6.option("readOnly", !form6.option("readOnly"));
			});
		});
		</script>
	</body>
</html>
