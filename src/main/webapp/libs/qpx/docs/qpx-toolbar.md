# qpx.qpToolBar (`view: "qpToolBar"`)

Panel nástrojů koncipovaný stejně jako DevExtreme `dxToolBar`: položky
rozdělené do zón `before` / `center` / `after`, každá je samostatný
widget (`button`, `buttonGroup`, `dropDownButton`, `template`, ...).
Responzivně se chová jako panel nástrojů v Chrome DevTools — položky,
které se nevejdou do šířky panelu, se automaticky přesunou do
přetékajícího menu (ikona „⋮“ vpravo). Zdroj: `qpx.toolbar.js`. Dědí ze
[`qpx.Widget`](./qpx-widget-base.md).

## Options
<table>
<tr><td> Option </td><td> Typ </td><td> Výchozí </td><td> Popis </td></tr>
<tr><td>---</td><td>---</td><td>---</td><td>---</td></tr>
<tr><td> items </td><td> array </td><td> [] </td><td> Položky panelu (viz níže) </td></tr>
<tr><td> visible </td><td> boolean </td><td> true </td><td> false přidá třídu qpx-hidden </td></tr>
<tr><td> disabled </td><td> boolean </td><td> false </td><td> Přidá třídu qpx-state-disabled na celý panel </td></tr>
<tr><td> theme </td><td> "generic-light" </td><td> "generic-dark" </td><td> "generic-light" </td><td> Přidá třídu qpx-theme-<theme> </td></tr>
<tr><td> overflowMenuIcon </td><td> string </td><td> "⋮" </td><td> Text/glyph tlačítka pro otevření přetékajícího menu </td></tr>
<tr><td> onItemClick </td><td> function(e) </td><td> null </td><td> Zkratka za .on("itemClick", fn) — agregovaně za všechny typy položek </td></tr>
<tr><td> onOptionChanged </td><td> function(e) </td><td> null </td><td> Zkratka za .on("optionChanged", fn) </td></tr>
</table>

### Konfigurace položky (`item`)

<table>
<tr><td> Vlastnost </td><td> Typ </td><td> Výchozí </td><td> Popis </td></tr>
<tr><td>---</td><td>---</td><td>---</td><td>---</td></tr>
<tr><td> location </td><td> "before" </td><td> "center" </td><td> "after" </td><td> "before" </td><td> Do které zóny se položka vykreslí </td></tr>
<tr><td> widget </td><td> "button" </td><td> "buttonGroup" </td><td> "dropDownButton" </td><td> "template" </td><td> jiný registrovaný view <tr><td> "button" (nebo "template", pokud je zadán template) </td><td> Typ vnitřního widgetu položky </td></tr>
<tr><td> locateInMenu </td><td> "auto" </td><td> "always" </td><td> "never" </td><td> "auto" </td><td> auto = přesune se do přetékajícího menu, pokud se nevejde; always = vždy jen v menu; never = nikdy se do menu nepřesune </td></tr>
<tr><td> visible </td><td> boolean </td><td> true </td><td> false = položka se nevykreslí vůbec (ani do menu) </td></tr>
<tr><td> cssClass </td><td> string </td><td> – </td><td> CSS třída na obalující buňku položky </td></tr>
<tr><td> options </td><td> object </td><td> {} </td><td> Konfigurace předaná dovnitř vnitřního widgetu (text, icon, onClick, items, ...) </td></tr>
<tr><td> template / data </td><td> – </td><td> – </td><td> Zkratka pro widget: "template" — pokud jsou zadány přímo na položce (ne v options), promítnou se do options.template / options.data </td></tr>
</table>

## Metody

<table>
</td><td> Metoda </td><td> Popis </td><td>
<tr><td>---</td><td>---</td><td>
<tr><td> option() / option(name) / option(name, value) / option({...}) </td><td> Zápis items kompletně zničí a znovu postaví všechny položky; zápis disabled/visible/theme jen přepne odpovídající CSS třídu </td></tr>
<tr><td> getItemWidget(index) </td><td> Vrátí instanci vnitřního widgetu položky podle jejího indexu v poli items </td></tr>
<tr><td> repaint() </td><td> Vynutí přepočet responzivního rozložení (_doRelayout) </td></tr>
<tr><td> destroy() </td><td> Zruší ResizeObserver/resize handler, zničí všechny vnitřní widgety položek a odstraní přetékající menu z document.body </td></tr>
</table>

## Události

<table>
<tr><td> Event </td><td> Data (e) </td><td> Kdy se vyvolá </td></tr>
<tr><td>---</td><td>---</td><td>---</td></tr>
<tr><td> itemClick </td><td> { itemData, itemIndex, itemElement, component, ...event z vnitřního widgetu } </td><td> Agregovaně při click/itemClick libovolného vnitřního widgetu položky </td></tr>
<tr><td> optionChanged </td><td> { name, value, previousValue } </td><td> Po změně přes option() </td></tr>
<tr><td> layoutChanged </td><td> { overflowing } </td><td> Po každém přepočtu responzivního rozložení (overflowing = zda je aktuálně něco v přetékajícím menu) </td></tr>
</table>

Panel navíc naslouchá vlastním `click`/`itemClick` eventům jednotlivých
vnitřních widgetů a přeposílá je jako toolbar `itemClick` — takže stačí
poslouchat jen na úrovni toolbaru, není nutné se napojovat na každou
položku zvlášť.

## Responzivní chování

Přepočet (`_doRelayout`) proběhne po prvním vykreslení a dále při
změně velikosti panelu (`ResizeObserver`, s fallbackem na `window`
`resize`, pokud `ResizeObserver` není podporován). Položky s
`locateInMenu: "always"` jsou v menu vždy; položky s `"never"` se do
menu nepřesunou nikdy (typicky uživatelské menu vpravo). Ostatní se
"sbírají" od poslední (nejvíc vpravo) položky, dokud se obsah panelu
nevejde do dostupné šířky.

## Příklad

```js
var toolbar = qpx.ui({
    view: "qpToolBar",
    theme: "generic-light",
    items: [
        { location: "before", widget: "button",
          options: { icon: "☰", stylingMode: "text", hint: "Menu" } },
        { location: "before", widget: "button",
          options: { text: "Nový", icon: "➕", type: "default",
                     onClick: function () { console.log("nový záznam"); } } },
        { location: "before", widget: "buttonGroup",
          options: { items: [{ text: "Den", key: "day" }, { text: "Týden", key: "week" }],
                     selectedItemKeys: ["week"] } },
        { location: "before", widget: "dropDownButton",
          options: { text: "Export", splitButton: true,
                     items: [{ text: "PDF", key: "pdf" }, { text: "CSV", key: "csv" }] } },
        { location: "center", widget: "template",
          template: "<span>#count# položek</span>", data: { count: 128 } },
        { location: "after", widget: "dropDownButton", locateInMenu: "never",
          options: { text: "Petr Novák", icon: "👤",
                     items: [{ text: "Profil", key: "profile" }, { text: "Odhlásit se", key: "logout" }] } }
    ],
    onItemClick: function (e) {
        console.log("klik na položku toolbaru:", e.itemData, "index:", e.itemIndex);
    }
}, "#mistoVDom");

toolbar.option("theme", "generic-dark");
toolbar.getItemWidget(1).option("text", "Nový (2)");
```
