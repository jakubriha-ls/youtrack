# Marketing Dashboard

Jednoduchý dashboard nad YouTrack projektem Marketing (MKT) pro rychlý přehled:

- Statistiky podle týmů a statusů
- Gantt Chart (Start Date / Due Date)
- Kanban Board
- All Tasks tabulka s filtrováním a řazením

## Spuštění

```bash
npm install
npm run dev
```

## Konfigurace YouTrack

Při prvním spuštění se zobrazí formulář:

- **YouTrack URL** – např. `https://youtrack.example.com`
- **API Token** – osobní permanent token (Profile → Authentication → Tokens)

Konfigurace se ukládá do `localStorage` pod klíčem `youtrack-config`. Token je uložen v plaintextu v prohlížeči – používej pouze token s omezeným rozsahem a na důvěryhodném zařízení.

## Prostředí a proxy

V dev režimu se volání na `/api` proxy-uje na instanci YouTracku:

- nastav v `.env.local` hodnotu:

```bash
VITE_YOUTRACK_PROXY_TARGET=https://youtrack.tvoje-domena.tld
```

Bez této hodnoty se použije výchozí interní URL (neměla by se používat mimo interní prostředí).

## Hlavní pohledy

- **📊 Statistiky** – počet tasků podle týmů a statusů, sjednocené barvy/statusy.
- **📅 Gantt Chart** – timeline pro issues se `Start Date` a `Due Date`, barva podle progressu subtasks.
- **📋 Kanban Board** – fixní pořadí statusů, řazení v rámci sloupce podle due date, zvýraznění „po termínu“ a „Done“.
- **📋 All Tasks** – tabulka se search, filtrem podle týmu, přepínačem „Jen po termínu“, řazením sloupců a hromadným výběrem (bulk akce jsou v UI zatím pouze naznačené).

