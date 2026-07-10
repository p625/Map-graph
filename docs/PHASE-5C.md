# Phase 5C — Organizační mapové režimy

> Schváleno s upřesněním barev (vedoucí + okresy). Implementace před plným 5B CRUD.

## Architektonické pravidla

- **Mapová jednotka** = okresní polygon (pevné ID a název z geometrie).
- **Organizační jednotka** = pracoviště OPŽL (vlastní ID a název).
- Vazba District → Workplace určuje, pod které pracoviště polygon patří.
- Workplace / region polygon = pouze vizualizační union.
- Mapa **nepřejmenovává** okresní polygony.
- Žádný Alias Manager ani učící se matching.

## Rozhodnutí (schváleno)

| Bod | Rozhodnutí |
|-----|------------|
| Mimo region při focusu | neutrální šedá |
| Barvy vedoucích | ručně editovatelné, sync jako výchozí |
| Plugin `by-org-unit` | zatím ne; SXXXXX v legendě vedoucího |
| Pořadí | 5C před 5B CRUD |
| Export při region focusu | pouze vybraný region, maximalizovaný (5C.2) |

## Barvy vedoucích

```ts
interface Leader {
  id: string
  name: string
  orgUnitId: string
  color: string  // editovatelná, zdroj pravdy pro mapu
}
```

- Načtení ze sync; ruční změna v UI přepíše a přežije reload.
- Merge při sync **zachová** ručně nastavené barvy (`leaderColorById`).
- Všechna pracoviště stejného vedoucího = stejná barva.
- Validace: platný hex, ne prázdná, ne bílá (`#fff`, `#ffffff`).
- Fallback: paleta při sync / index vedoucího.

**UI:** `Konfigurace → Pracoviště → Vedoucí` — jméno, org. složka, color picker, hex, náhled, počet pracovišť.

## Barvy okresů

```ts
interface DistrictDisplayStyle {
  districtId: string
  color: string
}
```

Uloženo v config store (`districtDisplayColors: Record<districtId, color>`).

- Použití **jen** v režimu `Podle okresů` (`by-district`).
- Neovlivňuje pracoviště / regiony / vedoucí / choropleth / kategorickou mapu.
- Fallback paleta pro okresy bez vlastní barvy.
- Reset jednotlivého okresu i všech.

**UI:** `Konfigurace → Barvy okresů` — 77 okresů, vyhledávání, picker, hex, náhled.

## Mapové režimy

| ID | Název | Interakce | Barvení |
|----|-------|-----------|---------|
| `by-district` | Podle okresů | okres | `districtDisplayColors` + fallback |
| `by-workplace` | Podle pracoviště | pracoviště | workplace palette |
| `by-regional-office` | Podle regionů | pracoviště | regional palette |
| `by-leader` | Podle vedoucích | pracoviště | `Leader.color` |
| `choropleth` | Barevná škála | pracoviště | data |
| `categorical` | Kategorická | pracoviště | data |

### Podle okresů

- Každý polygon samostatně, vlastní barva okresu.
- Vnitřní hranice okresů viditelné.
- Popisek = název okresu.
- Hover a klik na **okres**, ne na union pracoviště.

### Podle vedoucích

- Vyžaduje synchronizovanou organizaci.
- Legenda: jméno vedoucího + `subtitle` = SXXXXX.

## Persistence

- Vedoucí + barvy + vazby: `map-graph-org-v1` (organizationStore).
- Barvy okresů: `map-graph-config-v4` (configStore).
- Bez nové DB / repository vrstvy.

## Šablony a export

Template Manager ukládá `pluginId` (včetně `by-leader`, `by-district`), theme, popisky, hranice.
Barvy vedoucích/okresů se v šabloně **neukládají** — čtou se z store při renderu.
Export = stejné barvy jako interaktivní mapa.

## Dílčí dodávky

| Fáze | Obsah |
|------|-------|
| **5C.1** | Org kontext, `by-leader`, `by-district`, editovatelné barvy, legendy, UI stránky |
| **5C.2** | Region focus + zoom, export jen regionu |
| **5C.3** | Sjednocení editace vazeb se snapshotem |
| **5C.4** | Šablony org. režimů, `validate-phase-5c` |

## Editace vazeb (5C.3)

- **Zdroj pravdy:** `organizationSnapshot.workplaces[]` — `regionId`, `leaderId`, `orgUnitId`.
- **Odvozený pohled:** `configStore.workplaceRegionalAssignments` synchronizován přes `AssignmentConfigBridge` a `sync-derived-regional-assignments`.
- **Stránky:** `/config/regional` (region), `/config/leaders` (vedoucí + barvy).
- **Undo/Redo:** historie v `organizationStore` (max 50 kroků) — region, vedoucí, barva vedoucího.
- **Hromadná editace:** výběr více pracovišť, jeden atomický krok historie.
- **Sync konflikty:** ruční změny označeny `manualEdits`; při sync preview volba „zachovat lokální / použít Excel“ per pracoviště a pole.
- **Validace:** `npm run validate-phase-5c-assignments`.

## Region focus (5C.2)

- `mapStore`: `focusedRegionId`, `regionViewMode` (`overview` | `focused`), persistováno v localStorage.
- UI: `RegionFocusControls` — dostupné jen po synchronizaci organizace.
- Viewport: `getRegionViewport()` — bounding box okresů pracovišť regionu, cache podle `assignmentHash + regionId + rozměry`.
- Interaktivní mapa: okresy mimo region jsou neutrálně šedé (`#e2e8f0`), bez popisků, bez hover/kliku.
- Export: `exportScope: 'country' | 'focused-region'` — při focusu výchozí `focused-region`, bez šedého kontextu ČR.
- Legenda filtrovaná podle regionu (vedoucí, pracoviště, okresy, kategorie).
- **Choropleth škála:** varianta **B** — min/max a barevná škála pouze z hodnot okresů ve vybraném regionu (lepší kontrast uvnitř regionu). Později lze přidat přepínač „škála ČR / škála regionu“.
- Šablony ukládají `regionFocusEnabled`, `focusedRegionId`, `exportScope`; neplatný region při aplikaci resetuje na celou ČR s varováním.

## Akceptační kritéria 5C.1

1. Vedoucí má editovatelnou barvu s validací hex.
2. Změna barvy vedoucího se projeví na mapě, v legendě a exportu.
3. Režim Podle okresů barví každý okres zvlášť; hover/klik na okres.
4. Barvy okresů neovlivní ostatní režimy.
5. `npm run validate-phase-5c` PASS.

## Akceptační kritéria 5C.2

1. Výběr jednoho ze 7 regionů zvětší mapu na bounding box jeho pracovišť.
2. Prvky mimo region jsou šedé, bez popisků a bez aktivní interakce.
3. Export při focusu obsahuje pouze vybraný region, legenda filtrovaná.
4. Choropleth používá lokální škálu regionu.
5. Neplatný `focusedRegionId` po změně organizace se automaticky resetuje.
6. `npm run validate-phase-5c-region` PASS.

## Akceptační kritéria 5C.3

1. Změna regionu/vedoucího zapisuje do organization snapshotu a promítne se do mapy, legendy, region focusu a exportu.
2. Neplatné ID nebo absentFromSync blokují uložení.
3. Undo/redo obnoví snapshot i odvozené assignmenty.
4. Hromadná změna je atomická (jeden krok historie).
5. Sync zobrazí konflikty ručních změn a umožní rozhodnutí per pracoviště.
6. `npm run validate-phase-5c-assignments` PASS.
