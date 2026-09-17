# qpx.DropDownButton (`view: "dropDownButton"`)

Tlačítko s rozbalovacím seznamem položek, koncepčně jako DevExtreme
`dxDropDownButton` (volitelně "split" tlačítko se samostatnou šipkou).
Zdroj: `qpx.dropdownbutton.js`. Dědí ze
[`qpx.Widget`](./qpx-widget-base.md).

V jednu chvíli může být otevřená vždy jen jedna instance dropdownu na
stránce — otevření jedné automaticky zavře libovolnou jinou otevřenou.

## Options

| Option | Typ | Výchozí | Popis |
|---|---|---|---|
| `text` | string | `""` | Text hlavního tlačítka (pokud `useSelectMode` nenahradí text vybranou položkou) |
| `icon` | string | `""` | Ikona hlavního tlačítka — glyph, nebo `"css:trida"` |
| `items` | `Array<{ text, icon, key, disabled }>` | `[]` | Položky rozbalovacího seznamu |
| `keyExpr` | string | `"key"` | Pole položky použité jako klíč (jinak se použije index) |
| `displayExpr` | string | `"text"` | Pole položky použité jako popisek v menu |
| `splitButton` | boolean | `false` | `true` = hlavní část tlačítka a šipka jsou samostatně klikatelné (klik na hlavní část vyvolá `buttonClick`, klik na šipku otevře/zavře menu). `false` = celé tlačítko jen otevírá/zavírá menu a zároveň vyvolá `buttonClick` |
| `useSelectMode` | boolean | `false` | `true` = vybraná položka nahradí text tlačítka a v menu se zvýrazní (`qpx-state-selected`) |
| `selectedItemKey` | any | `null` | Klíč aktuálně vybrané položky (relevantní jen s `useSelectMode`) |
| `disabled` | boolean | `false` | Zakáže tlačítko |
| `visible` | boolean | `true` | `false` přidá třídu `qpx-hidden` |
| `stylingMode` | `"contained"` \| `"outlined"` \| `"text"` | `"contained"` | Vizuální styl tlačítka |
| `dropDownOptions` | `{ width }` | `{}` | Nastavení rozbalovacího panelu — zatím jen šířka |
| `onButtonClick` | `function(e)` | `null` | Zkratka za `.on("buttonClick", fn)` |
| `onItemClick` | `function(e)` | `null` | Zkratka za `.on("itemClick", fn)` |
| `onSelectionChanged` | `function(e)` | `null` | Zkratka za `.on("selectionChanged", fn)` |
| `onOptionChanged` | `function(e)` | `null` | Zkratka za `.on("optionChanged", fn)` |

## Metody

| Metoda | Popis |
|---|---|
| `option()` / `option(name)` / `option(name, value)` / `option({...})` | Po zápisu se komponenta kompletně přestaví (`_buildDom` + `_bindEvents`) |
| `enable()` | `option("disabled", false)` |
| `disable()` | `option("disabled", true)` |
| `destroy()` | Kromě standardního úklidu odstraní i plovoucí `$menu` element z `document.body` |

## Události

| Event | Data (`e`) | Kdy se vyvolá |
|---|---|---|
| `buttonClick` | `{ event, component, element }` | Klik na hlavní část tlačítka (u `splitButton: true`), nebo kdekoliv na tlačítko (u `splitButton: false`, kde zároveň otevře/zavře menu) |
| `itemClick` | `{ event, itemData, itemIndex, component }` | Klik na (ne-disabled) položku v menu — menu se před vyvoláním eventu zavře |
| `selectionChanged` | `{ item, key, previousKey, component }` | Jen s `useSelectMode: true`, při výběru nové položky |
| `opened` | `{ component }` | Menu bylo otevřeno |
| `closed` | `{ component }` | Menu bylo zavřeno |
| `optionChanged` | `{ name, value, previousValue }` | Po změně přes `option()` |

Menu se automaticky zavírá i při kliku mimo tlačítko/menu (`mousedown`
na `document`).

## Příklad

```js
var ddb = qpx.ui({
    view: "dropDownButton",
    text: "Export",
    icon: "⭳",
    splitButton: true,
    items: [
        { text: "Export do PDF", key: "pdf" },
        { text: "Export do Excelu", key: "xlsx" },
        { text: "Export do CSV", key: "csv" }
    ],
    onButtonClick: function () { console.log("hlavní tlačítko"); },
    onItemClick: function (e) { console.log("vybráno:", e.itemData.text); }
}, "#mistoVDom");

// select mode — text tlačítka se mění podle výběru
var user = qpx.ui({
    view: "dropDownButton",
    useSelectMode: true,
    selectedItemKey: "cs",
    keyExpr: "key",
    displayExpr: "text",
    items: [
        { text: "Čeština", key: "cs" },
        { text: "English", key: "en" }
    ]
}, "#lang");
```
