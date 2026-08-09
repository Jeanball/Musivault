# Screenshots

All images here are produced by two scripts, so a refresh is reproducible and every shot
comes out at the same size whatever the window looks like on screen.

| Folder       | Produced by | Size |
|--------------|-------------|------|
| `desktop/`   | `npm run screenshot` | 1600x1000 |
| `mobile/`    | `npm run screenshot:mobile` | 585x1266 (iPhone 14) |
| `composite/` | `./scripts/compose-screenshots.sh` | 1600 wide, transparent background |

## Capturing

```bash
npm run dev              # backend on 5001, frontend on 5173
npm run screenshot       # desktop
npm run screenshot:mobile
```

A Chromium window opens with the viewport locked to the profile. Navigate the app by hand,
then go back to the terminal and type a name:

```
desktop> statPage
  saved docs/screenshots/desktop/statPage.png (1600x1000)
```

| Input     | Effect |
|-----------|--------|
| `<name>`  | capture the current viewport as `<name>.png` |
| *(empty)* | capture again under the previous name |
| `!hide`   | toggle hiding of toasts, focus rings and text carets (on by default) |
| `!ls`     | list what has been captured so far |
| `q`       | quit |

Resizing or maximizing the browser window does not change the output: the viewport is fixed
by the Playwright context, not by the OS window.

To point at another instance: `node scripts/screenshot.mjs desktop http://localhost:8080`.

## Composites

`./scripts/compose-screenshots.sh` builds one image per name that exists in **both**
`desktop/` and `mobile/`: the desktop shot in a browser frame with the mobile shot in a
phone frame overlapping its bottom-right corner. Pass names to rebuild only some of them:

```bash
./scripts/compose-screenshots.sh statPage collectionGrid
```

The background is transparent so the result reads correctly in both GitHub light and dark
themes. Geometry is tunable at the top of the script (`PHONE_RATIO`, `PHONE_OVERLAP`,
`OVERHANG`, bezel and radius values).

## Before committing

```bash
npm run screenshot:optimize
```

Strips metadata and re-encodes at maximum PNG compression, keeping the original file when
re-encoding would make it bigger. Pixels are never altered.

## Naming

Use lowerCamelCase, and give a mobile shot **exactly** the same name as its desktop
counterpart so the composite script pairs them.

Current set:

- Paired (a composite exists): `adminExecutionLogs`, `adminTaskManagement`, `adminUserManagement`, `albumDetailPage`, `collectionGrid`,  `collectionList`, `collectionTable`, `discoverNearYou`, `discoverOnYourRadar`, `discoverPage`, `publicAlbumModal`, `ImportExport`, `searchAlbumByArtist`, `searchArtist`, `searchPage`, `settingsPreference1`, `settingsPreference2`, `searchReleaseByMaster`, `statPage`

 

Whatever is referenced by the root `README.md` must keep its name; the rest of the folder is
a library to pick from.
