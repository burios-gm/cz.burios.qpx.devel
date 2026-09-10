# qpx

Vlastní JavaScript UI framework postavený nad **jQuery**. Základem je
Java-like objektový systém `qpx.Class` s dědičností, nad kterým stojí
báze `qpx.Widget` pro všechny komponenty a tři rovnocenné způsoby, jak
komponenty definovat.

## Instalace / zapojení

```html
<script src="jquery.min.js"></script>
<link rel="stylesheet" href="css/qpx.css">
<script src="qpx.js"></script> <!-- sbalený build ze src/* -->
```

Zdrojové soubory jsou rozdělené v `src/` (kvůli přehlednosti a dalšímu
rozšiřování), `qpx.js` v kořeni je jejich prosté spojení pro nasazení:

- `src/qpx.core.js` – jmenný prostor, `qpx.Class`, utility, pub/sub mixin
- `src/qpx.widget.js` – bázová třída `qpx.Widget`, registr komponent, `qpx.ui()`
- `src/qpx.layout.js` – layout komponenta (rows/cols, responzivita)
- `src/qpx.template.js` – komponenta `template`
- `src/qpx.button.js` – komponenta `button`
- `src/qpx.buttongroup.js` – komponenta `buttonGroup`
- `src/qpx.dropdownbutton.js` – komponenta `dropDownButton`
- `src/qpx.toolbar.js` – komponenta `qpToolBar` (panel nástrojů)
- `src/qpx.parser.js` – parser `data-qpx-*` atributů, `$.fn.qpx()`, `qpx.parse()`

## 1. Class systém (dědičnost jako v Javě)

```js
var Animal = qpx.Class.extend({
    init: function (name) { this.name = name; },      // konstruktor
    speak: function () { return this.name + " vydává zvuk"; }
});

var Dog = Animal.extend({
    speak: function () {
        return this._super() + " (štěká)";             // super.speak()
    }
});

var d = new Dog("Rex");
d.speak();                    // "Rex vydává zvuk (štěká)"
d instanceof Animal;          // true
```

- `Class.extend(protoProps, staticProps)` – vytvoří potomka, podporuje
  `this._super(...)` uvnitř přepsaných metod (obdoba `super.metoda()`).
- Statické členy (a statické metody) se dědí automaticky.
- `MyClass.mixin(obj1, obj2, ...)` – přimíchá další sadu metod do
  prototypu (obdoba implementace rozhraní / traity). Používá se např.
  pro `qpx.EventsMixin` (on/off/trigger) v `qpx.Widget`.

Všechny UI komponenty (`qpx.Widget` a jeho potomci jako `qpx.Layout`,
`qpx.Template`) jsou postavené právě na `qpx.Class`, takže je lze
běžně rozšiřovat:

```js
var Badge = qpx.Template.extend({
    defaults: { template: "<span class='badge'>#text#</span>" }
});
qpx.registerWidget("badge", Badge);
```

## 2. Tři způsoby definice komponent

### a) JSON kompozice (jako webix)

```js
qpx.ui({
    rows: [
        { view: "template", height: 44, template: "Toolbar" },
        {
            cols: [
                { view: "template", width: 200, template: "Menu" },
                { view: "template", gravity: 1, template: "Obsah #x#", data: { x: 1 } }
            ]
        }
    ]
}, "#app");
```

`rows` / `cols` lze libovolně vnořovat. Buňka bez `view/rows/cols` se
chová jako prázdný flexibilní spacer.

### b) Napojení na konkrétní HTML element (jako kendoUI / easyUI)

```js
$("#box").qpx("template", { template: "Ahoj #jmeno#", data: { jmeno: "Petr" } });

// nebo s celým configem:
$("#box").qpx({ view: "template", template: "..." });

// přístup k instanci komponenty:
var w = $("#box").data("qpx-widget");
w.setValues({ jmeno: "Jana" });
```

### c) Deklarativně přes `data-qpx-*` atributy (jako Metro UI CSS)

```html
<div data-qpx-view="template"
     data-qpx-template="<b>#title#</b>: #text#"
     data-qpx-data='{"title":"Ahoj","text":"svět"}'>
</div>
```

Po načtení DOM se automaticky zavolá `qpx.parse(document)`, který
proskenuje celý dokument a všechny takto označené elementy inicializuje.
Hodnoty atributů se zkusí naparsovat jako JSON (čísla, pole, objekty),
jinak se použijí jako řetězec. Automatické zpracování lze vypnout
nastavením `qpx.autoParse = false;` a spustit ručně později přes
`qpx.parse(nejakyKorenovyElement)`.

Všechny tři přístupy vedou na stejné jádro — `qpx.ui(config, container)`
— takže je lze libovolně kombinovat v rámci jedné aplikace.

## 3. Layout (responzivní rows/cols)

```js
qpx.ui({
    cols: [
        { view: "template", width: 220, template: "Sidebar" },
        { view: "template", gravity: 1, template: "Content" }
    ],
    responsive: true   // pod 760px se cols přeskládají na rows
}, "#app");
```

Podporované vlastnosti buněk: `width`, `height`, `gravity` (flex-grow),
`hidden`, `css`. Typ layoutu (`type: "space" | "line"`) řídí mezery /
oddělovací čáry mezi buňkami.

## 4. Komponenta `template`

Obdoba webix `template`:

```js
var t = qpx.ui({
    view: "template",
    template: "<b>#name#</b> — {meta.role}",
    data: { name: "Petr", meta: { role: "admin" } }
}, "#app");

t.setValues({ name: "Jana", meta: { role: "user" } }); // překreslí
t.setTemplate("Nový obsah: #name#");                    // změní šablonu
t.define({ css: "card" });                               // změní config
```

- Šablona podporuje zápis `#promenna#` i `{promenna}`, včetně vnořených
  cest (`{a.b.c}`).
- Šablona může být i funkce `function(data){ return html; }` pro
  složitější vykreslování.
- API: `setValues(data)`, `getValues()`, `parse(data)`, `setHTML(html)`,
  `define(prop, value)`, `refresh()`.

## 5. Button / ButtonGroup / DropDownButton

Koncipovány stejně jako odpovídající widgety v **DevExtreme** (`dxButton`,
`dxButtonGroup`, `dxDropDownButton`) — stejná filozofie `option()`,
`enable()`/`disable()`, i pojmenování událostí.

```js
qpx.ui({ view: "button", text: "Uložit", type: "success", stylingMode: "contained",
    onClick: function (e) { console.log("kliknuto", e.component); } }, "#btn");

qpx.ui({ view: "buttonGroup", selectionMode: "single",
    items: [{ text: "Den", key: "d" }, { text: "Týden", key: "w" }],
    onItemClick: function (e) { console.log(e.itemData); } }, "#bg");

qpx.ui({ view: "dropDownButton", text: "Export", splitButton: true,
    items: [{ text: "PDF", key: "pdf" }, { text: "XLSX", key: "xlsx" }],
    onButtonClick: function (e) { /* klik na hlavní tlačítko */ },
    onItemClick: function (e) { /* výběr položky z menu */ } }, "#ddb");
```

Typ tlačítka (`type`): `normal | default | success | danger | warning`.
Styl (`stylingMode`): `contained | outlined | text`. Ikona (`icon`) může
být krátký text/emoji glyf, nebo `"css:trida-ikony"` pro napojení na
vlastní ikonový font/CSS třídu.

## 6. qpToolBar — panel nástrojů

Widget `qpToolBar` je koncipovaný stejně jako **DevExtreme dxToolBar**:

```js
qpx.ui({
    view: "qpToolBar",
    theme: "generic-light",              // nebo "generic-dark"
    items: [
        { location: "before", widget: "button", options: { text: "Nový", onClick: fn } },
        { location: "before", widget: "buttonGroup", options: { items: [...] } },
        { location: "before", widget: "dropDownButton", options: { text: "Export", items: [...] } },
        { location: "center", widget: "template", template: "#count# položek", data: { count: 10 } },
        { location: "after", widget: "button", options: { icon: "🔔" } }
    ],
    onItemClick: function (e) {
        // agregovaná událost za všechny typy položek (button/buttonGroup/dropDownButton)
        console.log(e.itemData, e.itemIndex);
    }
}, "#toolbar");
```

Vlastnosti položky (`items[i]`):

| pole | popis |
|---|---|
| `location` | `before` \| `center` \| `after` (výchozí `before`) |
| `widget` | `button` \| `buttonGroup` \| `dropDownButton` \| `template` (nebo libovolný jiný registrovaný widget) |
| `locateInMenu` | `auto` (výchozí, přesune se do menu při nedostatku místa) \| `always` (vždy jen v menu) \| `never` (nikdy se do menu nepřesune) |
| `options` | konfigurace vloženého widgetu (vč. `onClick`/`onItemClick` apod.) |
| `template` / `data` | zkratka pro `widget: "template"` |
| `visible`, `cssClass` | viditelnost a vlastní CSS třída buňky |

**Responzivní přetékání:** toolbar sleduje svou šířku (přes
`ResizeObserver`, s fallbackem na `resize` okna) a jakmile se položky
nevejdou do řádku, začne je — od poslední (nejvíce vpravo) směrem
doleva — přesouvat do vysouvacího menu s ikonou „⋮“, stejně jako to
dělá panel nástrojů v **Google Chrome DevTools**. Položky přesunuté do
menu jsou to úplně stejné widgety (fyzicky se jen přesune jejich DOM
uzel), takže si zachovávají všechny své vlastnosti i navázané události.

Veřejné API: `option()`, `getItemWidget(index)`, `repaint()`.

**Témata:** `generic-light` a `generic-dark` jsou realizované přes CSS
proměnné (`--qpx-*`) definované na třídách `qpx-theme-generic-light` /
`qpx-theme-generic-dark`. Přepnutí za běhu: `toolbar.option("theme", "generic-dark")`.

## Rozšiřování o vlastní komponenty

```js
var MyWidget = qpx.Widget.extend({
    defaults: { text: "" },
    render: function () {
        this.$container.addClass("my-widget").text(this.config.text);
    }
});
qpx.registerWidget("mywidget", MyWidget);
```

Poté je `mywidget` použitelný ve všech třech zápisech (JSON, `$.fn.qpx`,
`data-qpx-view="mywidget"`).

## Poznámky k budoucímu nasazení (Java / Tomcat / Spring)

Framework je čistě klientská (view) vrstva bez závislosti na
konkrétním backendu, takže sedne na obě zvažované varianty:

- **JSP na Tomcat 11** — `qpx.js`/`qpx.css` se servírují jako statické
  zdroje, JSP stránka vygeneruje buď HTML s `data-qpx-*` atributy
  (deklarativní varianta se hodí, když server rovnou generuje značení),
  nebo předá počáteční JSON konfiguraci do `<script>` bloku pro
  `qpx.ui(...)`.
- **Spring 6+ (Spring MVC / Boot)** — stejný princip; komponenty typu
  `template` lze snadno napojit na REST endpointy (`@RestController`
  vracející JSON) a data doplňovat přes `setValues()` po AJAX volání,
  případně přímo posílat celé JSON konfigurace komponent ze serveru.

Do budoucna se počítá s doplněním dalších komponent (formuláře, seznamy/
datatable, okna) — všechny půjdou postavit stejným způsobem: potomek
`qpx.Widget`, registrace přes `qpx.registerWidget`, a automaticky získají
podporu všech tří způsobů zápisu.
