# Herdkeep

Herdkeep is a herd book for a small show-pig and sow operation. CG Ranch uses it to track pigs, the breeding cycle, litters, feed, shows, and the money that goes with them. It is one Expo codebase: a web app now, and the same project for iOS later.

The demo opens on a fictional ranch day with sows near farrowing, a show string working toward a jackpot weight, a pig on a drug withdrawal, and a feed bin that is ready to reorder. Nothing here is dosing advice. Treatment rows are whatever the ranch typed in.

## Run it on the web

```bash
npm install
npm run web
```

The dev server listens on port 4457. Open [http://127.0.0.1:4457](http://127.0.0.1:4457).

Data stays in the browser. When the page is cross-origin isolated, Herdkeep uses `expo-sqlite`. Otherwise it uses sql.js and IndexedDB. Either way the herd book is on that device only.

## Expo Go

This project is Expo SDK 58. Install a matching Expo Go, then:

```bash
npx expo start
```

Scan the QR code from the terminal. If Expo Go asks you to upgrade, the store build is behind SDK 58 and this project will not open until it matches.

## Static hosting (Cloudflare Pages)

```bash
npx expo export -p web
```

Publish the `dist/` folder. The build is a single-page app (`web.output` is `single`). `public/_redirects` is copied into `dist` so unknown paths fall back to `index.html`:

```
/*    /index.html   200
```

Build command: `npx expo export -p web`. Output directory: `dist`.

## What the demo includes

- Dashboard with a date range, income, expenses, net, pigs by stage, and a list of farrowings, heat checks, open breeding females, low feed, and withdrawal holds.
- Pigs with sex, breed, group, stage, and status filters, photos up to 3 MB, and sire and dam checks (not self, not a descendant, sex and birth order).
- One event form for breeding, pregnancy check, farrowing, weaning, castration, vaccination, treatment, weight, sale, death, and cull. A pig’s Events tab can add, edit, and filter those.
- Breeding stores a due date from the farm gestation (114 days unless you change it). Open breedings recompute the expected date from the current setting.
- Litters with foster moves and weaning counts. Pre-wean mortality is (born alive − weaned + fostered in − fostered out) / born alive.
- Group events that store both the group and the pigs covered that day, plus an optional cost.
- Sales that require a buyer and a price above zero, and that refuse a pig still inside a withdrawal. Show entry is blocked when withdrawal ends on or after the show date.
- Income and expenses. The type can be changed after save. A feed purchase is one expense and one stock addition.
- Feed on hand in pounds, with reductions that cannot go negative.
- Reports for money, pigs, events, feed, and breeding. Ranges include a custom from–to, all time, and last year. Totals are in tables. CSV download uses the same filters. The filters are query parameters on `/reports`, so the URL can be shared.
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

These were called out as high-value gaps and are not in this version:

- Zoom, pan, and image export on the family tree. The tree itself is in the app.
- A full permission matrix, invites, passwords, and two-factor sign-in. The app has three roles on the device.
- A separate insemination-tracker page. Breeding and pregnancy checks are events, and the breeding report covers the summary.
- PDF or print export, and Excel workbooks. Reports download CSV.
- Receipt photos, recurring expenses, and a choice of kilograms, currency, or timezone.
- Barcode or electronic ID.
- Multi-user sync. The row shape is ready; the server is not.
- A vaccine protocol calendar beyond the optional next-due date on a vaccination.
- Batch archive or batch sale. You can select pigs, move their group, and start a group event.
- Dark mode.
