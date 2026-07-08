# Raw data — Map Graph

## Soubor `workplaces.xlsx`

Jeden Excel soubor se dvěma listy (pořadí listů rozhoduje, názvy nejsou závazné):

| Pořadí | Obsah | Povinný |
|--------|-------|---------|
| List 0 | OPŽL / pracoviště | ano |
| List 1 | Regionální odbory (RO) | ne (zatím může chybět) |

## List 0 — Pracoviště OPŽL

| Sloupec | Povinný | Příklad |
|---------|---------|---------|
| `code` / `kód` | ne* | `42` |
| `name` / `název` / `Číslo supervize:` | ano | `Benešov` |
| `shortName` / `zkratka` | ne | `Benešov` |

\* Pokud `code` chybí, generuje se automaticky z pořadí řádku (1–65).

## List 1 — Regionální odbory

| Sloupec | Povinný | Příklad |
|---------|---------|---------|
| `code` / `kód` | ano | `RO-01` |
| `name` / `název` | ano | `Regionální odbor Jih` |
| `nuts2Code` | ne | `CZ03` |
| `nuts2Name` | ne | `Jihozápad` |

## Import

```bash
npm run import-seed
```

Vygeneruje soubory v `src/data/seed/`.
