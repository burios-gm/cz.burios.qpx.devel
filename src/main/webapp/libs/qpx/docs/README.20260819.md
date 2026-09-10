# QPX

Vlastní JavaScript UI framework postavený nad **jQuery** (dříve pracovní
název „uqp“, nyní přejmenováno na **QPX**). Základem je Java-like
objektový systém `Class` (dostupný globálně i jako `QPX.Class`) s
dědičností, nad kterým stojí báze `QPX.Widget` pro všechny komponenty a
tři rovnocenné způsoby, jak komponenty definovat.

## Instalace / zapojení

```html
<script src="jquery.min.js"></script>

<!-- obě témata jsou samostatné soubory, lze zapojit jedno, nebo obě
     (přepínání pak řeší CSS třída na widgetu, viz níže) -->
<link rel="stylesheet" href="css/qpx-light.css">
<link rel="stylesheet" href="css/qpx-dark.css">

<script src="qpx.js"></script> <!-- sbalený build ze src/* -->
```

## Struktura souborů

Každá část frameworku má vlastní soubor pojmenovaný ve tvaru `qpXxx.js`
(dle zadání — `qpClass.js`, `qpWidget.js`, `qpButton.js` atd.). `qpx.js`
v kořeni je jejich prosté spojení pro nasazení, v pořadí, ve kterém je
potřeba je načíst:

| soubor | obsah |
|---|---|
| `src/qpClass.js` | OOP jádro — globální `Class` s `.extend()`/`.mixin()`, `qpConfig`, bootstrap jmenného prostoru `QPX` |
| `src/qpUtils.js` | pomocné utility (`QPX.extend`, `QPX.uid`, `QPX.resolve`, ...) + `QPX.EventsMixin` (on/off/trigger) |
| `src/qpWidget.js` | bázová třída `QPX.Widget`, registr komponent, tovární metoda `QPX.ui()` |
| `src/qpLayout.js` | komponenta `layout` (rows/cols, responzivita) |
| `src/qpTemplate.js` | komponenta `template` |
| `src/qpButton.js` | komponenta `button` |
| `src/qpButtonGroup.js` | komponenta `buttonGroup` |
| `src/qpDropDownButton.js` | komponenta `dropDownButton` |
| `src/qpToolBar.js` | komponenta `qpToolBar` (panel nástrojů) |
| `src/qpParser.js` | parser `data-qpx-*` atributů, `$.fn.qpx()`, `QPX.parse()` |

## 1. Class systém (dědičnost jako v Javě)

`src/qpClass.js` obsahuje jednoduché, čitelné OOP jádro: `Class.extend()`
vytvoří potomka a uvnitř přepsaných metod lze zavolat rodičovskou
implementaci přes `this._super(...)` (obdoba `super.metoda()` v Javě).
Třída je dostupná jak jako globální `Class`, tak jako `QPX.Class`
(je to jedna a tatáž reference — `Class === QPX.Class`).

```js
var Animal = Class.extend({
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

`MyClass.mixin(obj1, obj2, ...)` přimíchá další sadu metod do prototypu
(obdoba implementace rozhraní / traity). Používá se např. pro
`QPX.EventsMixin` (on/off/trigger) v `QPX.Widget`.

Všechny UI komponenty (`QPX.Widget` a jeho potomci jako `QPX.Layout`,
`QPX.Template`, `QPX.Button`, `QPX.qpToolBar`...) jsou postavené právě
na `Class`, takže je lze běžně rozšiřovat:

```js
var Badge = QPX.Template.extend({
    defaults: { template: "<span class='badge'>#text#</span>" }
});
QPX.registerWidget("badge", Badge);
```

## 2. Tři způsoby definice komponent

### a) JSON kompozice (jako webix)

```js
QPX.ui({
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

Po načtení DOM se automaticky zavolá `QPX.parse(document)`. Automatické
zpracování lze vypnout nastavením `QPX.autoParse = false;` a spustit
ručně později přes `QPX.parse(nejakyKorenovyElement)`.

Všechny tři přístupy vedou na stejné jádro — `QPX.ui(config, container)`
— takže je lze libovolně kombinovat v rámci jedné aplikace.

## 3. Layout (responzivní rows/cols)

```js
QPX.ui({
    cols: [
        { view: "template", width: 220, template: "Sidebar" },
        { view: "template", gravity: 1, template: "Content" }
    ],
    responsive: true   // pod 760px se cols přeskládají na rows
}, "#app");
```

## 4. Komponenta `template`

```js
var t = QPX.ui({
    view: "template",
    template: "<b>#name#</b> — {meta.role}",
    data: { name: "Petr", meta: { role: "admin" } }
}, "#app");

t.setValues({ name: "Jana", meta: { role: "user" } });
```

## 5. Button / ButtonGroup / DropDownButton

Koncipovány stejně jako odpovídající widgety v **DevExtreme** (`dxButton`,
`dxButtonGroup`, `dxDropDownButton`).

```js
QPX.ui({ view: "button", text: "Uložit", type: "success", stylingMode: "contained",
    onClick: function (e) { console.log("kliknuto", e.component); } }, "#btn");

QPX.ui({ view: "buttonGroup", selectionMode: "single",
    items: [{ text: "Den", key: "d" }, { text: "Týden", key: "w" }],
    onItemClick: function (e) { console.log(e.itemData); } }, "#bg");

QPX.ui({ view: "dropDownButton", text: "Export", splitButton: true,
    items: [{ text: "PDF", key: "pdf" }, { text: "XLSX", key: "xlsx" }],
    onButtonClick: function (e) { /* klik na hlavní tlačítko */ },
    onItemClick: function (e) { /* výběr položky z menu */ } }, "#ddb");
```

## 6. qpToolBar — panel nástrojů

```js
QPX.ui({
    view: "qpToolBar",
    theme: "generic-light",              // nebo "generic-dark"
    items: [
        { location: "before", widget: "button", options: { text: "Nový", onClick: fn } },
        { location: "before", widget: "buttonGroup", options: { items: [...] } },
        { location: "before", widget: "dropDownButton", options: { text: "Export", items: [...] } },
        { location: "center", widget: "template", template: "#count# položek", data: { count: 10 } },
        { location: "after", widget: "button", options: { icon: "🔔" } }
    ],
    onItemClick: function (e) { console.log(e.itemData, e.itemIndex); }
}, "#toolbar");
```

| pole položky | popis |
|---|---|
| `location` | `before` \| `center` \| `after` (výchozí `before`) |
| `widget` | `button` \| `buttonGroup` \| `dropDownButton` \| `template` (nebo libovolný jiný registrovaný widget) |
| `locateInMenu` | `auto` (výchozí) \| `always` \| `never` |
| `options` | konfigurace vloženého widgetu (vč. `onClick`/`onItemClick` apod.) |

**Responzivní přetékání:** toolbar sleduje svou šířku (`ResizeObserver`,
fallback na `resize` okna) a jakmile se položky nevejdou do řádku,
přesouvá je — od poslední (nejvíce vpravo) směrem doleva — do
vysouvacího menu s ikonou „⋮“, stejně jako panel nástrojů v **Google
Chrome DevTools**. Přesunuté položky jsou fyzicky přemístěné DOM uzly
téhož widgetu, takže si drží všechny vlastnosti i navázané události.

Veřejné API: `option()`, `getItemWidget(index)`, `repaint()`. Přepnutí
tématu za běhu: `toolbar.option("theme", "generic-dark")`.

## 7. Stylování — SCSS a samostatná témata

Styly jsou napsané v **SCSS** a rozdělené tak, aby každé téma mělo svůj
vlastní vstupní `.scss` soubor i svůj vlastní výsledný `.css`:

```
css/
  scss/
    _base.scss         partial se strukturálními styly (bez barev — čerpá
                        je z CSS custom properties --qpx-*), sdílený oběma tématy
    _theme-light.scss   partial s barevnou paletou tématu "generic light"
    _theme-dark.scss    partial s barevnou paletou tématu "generic dark"
    qpx-light.scss      vstupní soubor: @import 'theme-light'; @import 'base';
    qpx-dark.scss       vstupní soubor: @import 'theme-dark';  @import 'base';
  qpx-light.css         zkompilovaný, samostatně použitelný výstup pro světlé téma
  qpx-dark.css          zkompilovaný, samostatně použitelný výstup pro tmavé téma
```

Díky tomu je každý výsledný `.css` soubor soběstačný — obsahuje jak
barevné proměnné, tak všechny strukturální styly komponent — a lze podle
potřeby zapojit jen jeden z nich, nebo oba najednou (pak přepínání
tématu za běhu řeší jen přehození CSS třídy `qpx-theme-generic-light` /
`qpx-theme-generic-dark` na widgetu, což dělá `qpToolBar.option("theme", ...)`
automaticky).

Přeložení SCSS (pokud máte lokálně Dart Sass):

```
sass css/scss/qpx-light.scss css/qpx-light.css
sass css/scss/qpx-dark.scss  css/qpx-dark.css
```

V tomto prostředí nebyl při generování k dispozici Sass kompilátor, takže
`qpx-light.css` a `qpx-dark.css` jsou ručně přeložený, ale obsahově
identický ekvivalent toho, co by výše uvedený příkaz vygeneroval — po
instalaci Sassu je lze bez úprav znovu vygenerovat ze zdrojových `.scss`.

## Rozšiřování o vlastní komponenty

```js
var MyWidget = QPX.Widget.extend({
    defaults: { text: "" },
    render: function () {
        this.$container.addClass("my-widget").text(this.config.text);
    }
});
QPX.registerWidget("mywidget", MyWidget);
```

Poté je `mywidget` použitelný ve všech třech zápisech (JSON, `$.fn.qpx`,
`data-qpx-view="mywidget"`).

## Poznámky k budoucímu nasazení (Java / Tomcat / Spring)

Framework je čistě klientská (view) vrstva bez závislosti na
konkrétním backendu:

- **JSP na Tomcat 11** — `qpx.js`/`qpx-*.css` se servírují jako statické
  zdroje; JSP stránka vygeneruje buď HTML s `data-qpx-*` atributy, nebo
  předá počáteční JSON konfiguraci do `<script>` bloku pro `QPX.ui(...)`.
- **Spring 6+ (Spring MVC / Boot)** — stejný princip; komponenty typu
  `template` lze snadno napojit na REST endpointy (`@RestController`
  vracející JSON) a data doplňovat přes `setValues()` po AJAX volání.
