# Wedding Hall Owner Tycoon

A 3D mobile tycoon game for Android by **Assoum Studios**. You inherit Grandma Rosa's run-down Rose Hall and her
$40,000 debt, beat Victor Crane of the Grand Palace, and grow a wedding empire across six halls.

## Getting the Android App Bundle (.aab)

Every push builds, tests and signs the game automatically on GitHub:

1. Open the repository on GitHub → **Actions** → **Build signed Android App Bundle (.aab)**.
2. Open the latest green run and scroll to **Artifacts**.
3. Download **WeddingHallOwnerTycoon-aab**. Inside is `WeddingHallOwnerTycoon-1.0.N.aab`, ready to upload to Google Play
   (once the signing secrets below are set).

### Your upload key (do this once)

This repository is **public**, so no key is ever stored in it or published by the build. Your private Play
**upload key** (`upload-key.jks`) and its password were handed to you directly, outside GitHub. Keep them in a
password manager: every Play update must be signed with this same key.

To let GitHub sign every build with it, add four repository secrets
(**Settings → Secrets and variables → Actions → New repository secret**):

| Secret | Value |
|---|---|
| `KEYSTORE_BASE64` | the whole content of `upload-key.jks.base64.txt` |
| `KEYSTORE_PASSWORD` | the password you were given |
| `KEY_ALIAS` | `upload` |
| `KEY_PASSWORD` | the same password |

Until those secrets exist, GitHub still builds a working `.aab`, but signs it with a throwaway test key and names it
`...-TEST-KEY-not-for-Play.aab`. Don't upload that one to Play.

When you create the app in Play Console, keep **Play App Signing** on (the default): Google holds the final app
signing key, and a lost upload key can be reset through Play support.

## Playing it in a browser

`cd web && npm install && npm run dev`, then open the printed address. The same game runs in the Android app.

## Changing the numbers (no code needed)

Every price, cost, chance and timer lives in plain JSON files in `web/src/data/`:

| File | What it controls |
|---|---|
| `config.json` | Difficulties, start money, Rosa's debt, menus, music, themes, flowers, lighting, venues, client personalities, happiness formula, night length, problem rate, reputation, upkeep, Victor |
| `demands.json` | The 87 extra wedding demands (cost, price, what they need) |
| `problems.json` | The 37 wedding-night problems (fix cost, timer, which staff/upgrade prevents them) |
| `news.json` | 43 morning news events + Victor's 3 sabotage events, with choices and effects |
| `halls.json` | Hall sizes (6, up to 1,000 guests), the 6 halls, 16 upgrades, research tree, build-mode items |
| `staff.json` | 11 roles, wages, guests per staff member, traits, morale rules |
| `business.json` | Plots, loans, marketing campaigns, cosmetic shop, small-hall event types |
| `progress.json` | 12 chapters with goals and 3-star bonuses, weekly goals, 86 achievements, seasonal events, daily wheel |
| `content.json` | Names, love stories, couple dialogue, reviews, Victor's taunts, story pages |
| `i18n/en.json`, `i18n/ar.json` | Every interface text in English and Arabic |

After editing, push to GitHub: the tests run and a new `.aab` is built.

## Developer cheats (remove before release)

All in `web/src/core/cheats.ts`. Type them in **Office → Settings → Developer code**:
`ROSE-MONEY`, `ROSE-RICH`, `ROSE-REP`, `ROSE-STAFF`, `ROSE-MAX`, `ROSE-DEBT`, `ROSE-DAYS`, `ROSE-FANS`.
Set `CHEATS_ENABLED = false` in that file for the store release.

## Project layout

```
web/                  the game (TypeScript + three.js)
  src/core/           save slots, time/day loop, economy, localization, cheats
  src/world/          halls, neighborhoods, camera & touch controls, build mode, traffic, walking grid
  src/characters/     modular characters on one shared skeleton, animations, crowds
  src/weddings/       clients, invoices & negotiation, planning, the wedding night, reports
  src/staff/          hiring, interviews, morale, managers
  src/business/       plots, small hall, loans, marketing, shop
  src/phone/          Vowly, messages, gallery
  src/progress/       chapters, weekly goals, achievements, news, events, daily gift
  src/ui/             all screens
  src/audio/          original procedural music and sound effects
  src/data/           all editable numbers and text (JSON)
  tests/              30-day playthroughs, save/reload, localization, browser tests
android/              the Android app (full-screen WebView running the bundled game offline)
store/                Play Store icon and feature graphic
.github/workflows/    the automatic test + signed .aab build
```

## Tests

`cd web && npm test` runs: type checks, the English/Arabic tables (no English left in Arabic),
a 30-day automated playthrough on every difficulty (3 seeds each), and a save → reload → continue check
that must match exactly. Browser checks (`tests/e2e.cjs`, `tests/controls.cjs`) play the first wedding,
verify two-finger rotation direction, menus not closing on the opening tap, and Arabic screens.
