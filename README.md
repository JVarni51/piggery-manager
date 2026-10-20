# Herdkeep

Herdkeep is a herd book for a small show-pig and sow operation. CG Ranch uses it to track pigs, the breeding cycle, litters, feed, shows, and the money that goes with them. It is one Expo codebase: a web app now, and the same project for iOS later.

The demo opens on a fictional ranch day with sows near farrowing, a show string working toward a jackpot weight, a pig on a drug withdrawal, and a feed bin that is ready to reorder. Nothing here is dosing advice. Treatment rows are whatever the ranch typed in.

## Run it on the web

```bash
npm install
npm run web
```

The dev server listens on port 4457. Open [http://127.0.0.1:4457](http://127.0.0.1:4457).

Data stays in the browser through sql.js and IndexedDB. The iOS and Android builds use `expo-sqlite`. Either way the herd book is on that device only.

## Expo Go

This project is Expo SDK 58. Install a matching Expo Go, then:

```bash
npx expo start
```

Scan the QR code from the terminal. If Expo Go asks you to upgrade, the store build is behind SDK 58 and this project will not open until it matches.

## Static hosting (Cloudflare Pages)

```bash
npm run export:web
```

That runs `npx expo export -p web`, then `scripts/clean-export.js`. Expo writes a few assets under `dist/assets/node_modules/` (the wa-sqlite wasm and the expo-router icons). Cloudflare Pages will not upload a path that contains `node_modules`, so the script moves those files to `dist/assets/vendor/` and rewrites the references. Use the same command as the Git build so Pages produces a clean `dist` itself.

Publish the `dist/` folder. The build is a single-page app (`web.output` is `single`). `public/_headers` sends `X-Robots-Tag: noindex` on every path, so a deploy is not indexed unless that header is removed. `public/_redirects` is copied into `dist` so unknown paths fall back to `index.html`:

```
/*    /index.html   200
```

Build command: `npm run export:web`. Output directory: `dist`.

## What the demo includes

- Dashboard with a date range in the URL, income, expenses, net, pigs by stage, and a list of farrowings, return-to-heat checks, open breeding females, low feed, and withdrawal holds.
- Pigs with sex, breed, group, stage, and status filters in the URL. Active pigs are the default, sorted by tag in numeric order. Photos up to 3 MB. Sire and dam lists offer only a valid parent: the right sex, born first, still active, and a sire that is not castrated.
- Stages use US terms: piglet, nursery, grower, finisher, gilt, sow, and boar. Castration is its own flag. A barrow is a castrated male; gilt and sow stay the reproductive stages.
- One event form for breeding, pregnancy check, farrowing, weaning, castration, vaccination, treatment, spray, weight, sale, death, and cull. A pig’s Events tab can add, edit, and filter those. A weight chart sits on the pig page when there are two or more weights.
- Services a few days apart share one heat. A service 17–25 days later closes the earlier open heat as returned. The due date comes from the first service in the heat and the farm gestation (114 days unless you change it). Farrowing rate is counted per heat.
- Litters with foster moves and weaning counts. Pre-wean mortality uses weaned litters only: (born alive − weaned + fostered in − fostered out) / born alive. Parity defaults to the sow’s earlier farrowings plus one, and it stays editable. A piglet with the same litter number and dam is linked to that litter.
- Group events that store both the group and the pigs covered that day, plus an optional cost. A withdrawal on a spray, an “other” event, or a group event counts the same as a treatment.
- Sales require a buyer and a price above zero. Withdrawal is checked against the sale date, not the day you type it in. Day 0 is the treatment day, and the pig is clear the day after the withdrawal end date. Show entries are checked again when the show page opens. Weigh-in and a recorded sale are blocked while that entry is in conflict.
- Treatments can store a lot number, product expiry, an extra-label flag (which requires the veterinarian and a withdrawal), and VFD expiry and document fields. Keep VFD copies for two years.
- Pigs per sow per year uses the average number of breeding females over the trailing year. Non-productive days are labeled as an estimate and use actual lactation when wean dates exist.
- Income, expenses, events, and feed can be filtered by date and pig, and those filters stay in the URL. Lists download CSV. Feed movements and farm-setup rows can be edited. A save shows a short “Saved.” confirmation.
- Reports for money, pigs, events, feed, and breeding. An inverted from–to range is rejected. An unknown range preset says so and falls back to this month. Totals are in tables. CSV download uses the same filters.
- A family tree with ancestors and descendants. Nodes show tag and name, colored by sex, and open that pig.
- Farm setup for breeds, groups, feed types, and categories, plus gestation, weaning age, heat cycle, and farrowing interval.
- Roles on this device only: Owner, Manager, and Data entry. There is no password. Owner can reset the demo.

## Roles

| | Owner | Manager | Data entry |
| --- | --- | --- | --- |
| Add and edit | yes | yes | yes |
| Delete | yes | yes | no |
| Setup lists | yes | yes | no |
| Farm timing | yes | yes | no |
| People and roles | yes | no | no |
| Reset demo | yes | no | no |

The switcher is labeled for this device. It is not an account system.

## Data layer

Rows use client UUIDs, `created_at`, `updated_at`, `deleted_at`, and `sync_status` (`pending` or `synced`). Dollars are integer cents. Weights are pounds. The repository is the only writer, so a sync engine such as WatermelonDB (MIT) or PowerSync (Apache-2.0) can sit behind it later. This project does not vendor GPL or AGPL farm software.

## Tests

```bash
npm test
npm run typecheck
```

## Roadmap

The first pass covers residue checks, the herd-math corrections, and the small list and form fixes. These larger gaps are still open:

- A separate 28–35 day pregnancy-check reminder. The 21-day task is labeled “Return-to-heat check” and still opens the pregnancy-check form.
- A sow card: one row per parity with service date, boar, farrow date, total born, born alive, stillborn, mummified, fostered in and out, weaned, and wean weight. Total born is already derived on the litter page.
- Three-weight or regression average daily gain next to the two-weight figure used for show pace.
- Record-book export mapped to AET, the California 4-H APR, and the Nevada Western Area book, plus a buyer packet (pedigree, notch, weights, treatments with clear dates).
- A semen-lot table (collection date, doses) and piglet-death events with a date, count, and cause.
- Ear-notch validation (litter number–pig number), breed-association fields, and an exhibitor YQCA number.
- Zoom, pan, and image export on the family tree.
- A full permission matrix, invites, passwords, and two-factor sign-in. Roles on this device stay advisory.
- A separate insemination-tracker page.
- PDF or print export, and Excel workbooks. Lists and reports download CSV.
- Receipt photos, recurring expenses, and a choice of kilograms, currency, or timezone.
- Barcode or electronic ID.
- Multi-user sync. The row shape is ready; the server is not.
- A vaccine protocol calendar beyond the optional next-due date.
- Batch archive or batch sale, and audit columns on list rows.
- Unsaved-changes warnings, “Save & add another”, and desktop dropdowns that do not leave a blank gap.
- Dark mode.
- A custom date range on the dashboard. Presets are in the URL today.
