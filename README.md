# Marketing Dashboard

Jednoduchý dashboard nad YouTrack projektem Marketing (MKT) pro rychlý přehled:

- Statistiky podle týmů/kategorií + data quality
- Gantt Chart (Start Date / Due Date)
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

Konfigurace se ukládá do `localStorage` pod klíčem `youtrack-config`. Token je v unmanaged režimu uložen v plaintextu v prohlížeči – doporučený je managed režim přes server env (`YOUTRACK_BASE_URL` + `YOUTRACK_TOKEN`) a klient bez tokenu.

## Prostředí a proxy

V dev režimu se volání na `/api` proxy-uje na instanci YouTracku:

- nastav v `.env.local` hodnotu:

```bash
VITE_YOUTRACK_PROXY_TARGET=https://youtrack.tvoje-domena.tld
```

Bez této hodnoty se použije výchozí interní URL (neměla by se používat mimo interní prostředí).

## Hlavní pohledy

- **📊 Statistics** – workload podle `MKT Team` a `Project Category`, zavřené tasky za 7 dní, aktivita lidí a data quality panel.
- **📅 Gantt WC26 / Gantt all tasks** – timeline issues se `Start Date` a `Due Date`, hierarchie parent/subtask/related.
- **📋 All Tasks** – tabulka se search, multiselect filtry, řazením, detailním výpisem relations a quick akcí „Otevřít vybrané v YouTrack“.

