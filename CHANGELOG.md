# Changelog

All notable changes to Musivault will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.8.0-beta.3] - 2025-12-30

### Added
- feat: Exclude digital-only releases/versions, add cassette and country filtering, and remove digital format options.
- feat: enhance album detail display with badges and add a back button to the public collection header.
- feat: replace static home link with dynamic back navigation using `useNavigate`
- feat: add track artist data to models, Discogs import, UI display, and collection search by track name
- feat: Introduce a toggleable 'Tracks' view in the collection alongside the existing 'Albums' view, utilizing a new track aggregation hook.

### Changed
- refactor: improve public collection header layout by replacing absolute positioning with flexbox and adding a spacer.

---

## [1.8.0-beta.2] - 2025-12-24

### Added
- OIDC/SSO single sign-on support
- Unified search for albums and artists with side-by-side results
- "What's New" modal showing release notes on version updates
- Success modal after adding album with "View Album" / "Continue Searching" options
- Format details display on album detail page (vinyl color, LP, Album, Limited Edition)
- Migration script for backfilling format details from Discogs
- Dynamic greeting on home page based on time of day
- Artist name cleanup script to remove Discogs numbering suffixes
- Collection data centralized via React Context

### Changed
- Admin dashboard: "Last Login" replaced with "Last Added" (album)
- Album detail page: Record Label moved below artist name
- Album detail page: Genres and Format Details displayed side by side
- Removed landing page, defaulting to login route
- Persist collection layout and artist album sort preferences
- Auto-focus search bar and improved responsive styling

### Fixed
- Scroll to top when navigating to album detail page
- Placeholder image path for Freshly Added section (now uses SVG)
- VERSION file served correctly by Vite dev server

---

## [1.7.2] - 2025-12-21

### Added
- feat: add album tracklist and label fields, including migration script and UI support
- feat: Introduce Discover page and API to list users with public collections.

### Fixed
- fix: add Discover page placeholder, consolidate migration scripts

---

## [1.7.1] - 2025-12-21

### Added
- feat: add album tracklist and label fields, including migration script and UI support
- feat: Introduce Discover page and API to list users with public collections.

### Fixed
- fix: add Discover page placeholder, consolidate migration scripts

---

## [1.7.0] - 2025-12-20

### Added
- Support for Release ID and Catalog Number in CSV imports
- Direct Discogs lookup via `fetchByReleaseId()`
- Catalog number search via `searchByCatalogNumber()`
- Auto-detect format (Vinyl/CD) from Discogs data

### Changed
- Updated CSV template and UI for new import options

---


## [1.6.2] - 2025-12-19

### Fixed
- Make backend proxy host configurable for different deployment environments

---

## [1.6.1] - 2025-12-12

### Fixed
- Implement Discogs API rate limit error handling on frontend and backend
- Improve barcode search error responses

---

## [1.6.0] - 2025-12-12

### Added
- Barcode scanning functionality to search and add releases to collection

---

## [1.5.5] - 2025-12-12

### Added
- Enhanced admin page with user search
- Updated admin statistics
- Public collection link copying functionality
- Project screenshots and icon
- Updated README documentation

---

## [1.5.4] - 2025-12-12

### Changed
- Update Docker publish workflow triggers (release, PR, manual dispatch)
- Update Browserlist-db package in frontend

---

## [1.5.3] - 2025-12-12

### Added
- Style statistics to collection overview

### Changed
- Refactored stats display layout

---

## [1.5.2] - 2025-12-11

### Fixed
- Duplicate key error handling for rematch
- Rate limit error handling for rematch

### Added
- Discogs API rate limit handling
- Optimized frontend search in rematch modal
- Backend dev script

---

## [1.5.0] - 2025-12-11

### Added
- Style filter for collection
- Session persistence
- DRY collection refactoring

---

## [1.4.0] - 2025-12-11

### Added
- Rematch feature to re-match albums with different Discogs releases
- Robust rematch search with Vitest tests (9 test cases)
- Test:run and test scripts to package.json

### Fixed
- Unsafe master fallback in RematchModal (prevents 404 errors)

### Changed
- Reorganized album detail page buttons for better UX
- Configured Vitest with jsdom environment

---

## [1.3.0] - 2025-12-10

### Added
- Share collection with other users (public collections)
- Last login tracking for users
- Admin ability to change user passwords

### Fixed
- Mobile: Filters (Format, Decade, Added) now display vertically
- Mobile: Reset password design improvements
- Mobile: Easier album version selection

### Changed
- Ability to change format in album detail view

---

## [1.2.0] - 2025-12-09

### Added
- Progress bar for CSV import
- Manual trigger for CI workflow
- Dockerignore optimization

### Fixed
- Timeout issue on large imports

---

## [1.1.1] - 2025-12-08

### Fixed
- User permission issue with logs file
- Docker-compose.dev.yml for local environment testing
- Created logs folder with proper access permissions

---

## [1.1.0] - 2025-12-08

### Added
- CSV import matching rules for accurate Discogs album matching
- Import log files saved locally and downloadable
- Volume mount for backend Docker logs

### Fixed
- Footer display on mobile
- Modal behavior when clicking on an album

---

## [1.0.0] - 2025-12-08

### Added
- Initial release of Musivault
- Music collection management
- Discogs API integration
- User authentication and authorization
- Admin dashboard
- CSV import functionality
- PWA support with offline capabilities
- Docker deployment with GitHub Container Registry
- Theme customization (dark/light modes)
- Album search and browsing
- Collection statistics and filtering

---

[Unreleased]: https://github.com/Jeanball/Musivault/compare/v1.7.2...HEAD
[1.7.2]: https://github.com/Jeanball/Musivault/compare/v1.7.1...v1.7.2
[1.7.1]: https://github.com/Jeanball/Musivault/compare/v1.7.0...v1.7.1
[1.7.0]: https://github.com/Jeanball/Musivault/compare/v1.6.2...v1.7.0
[1.6.2]: https://github.com/Jeanball/Musivault/compare/v1.6.1...v1.6.2
[1.6.1]: https://github.com/Jeanball/Musivault/compare/v1.6.0...v1.6.1
[1.6.0]: https://github.com/Jeanball/Musivault/compare/v1.5.5...v1.6.0
[1.5.5]: https://github.com/Jeanball/Musivault/compare/v1.5.4...v1.5.5
[1.5.4]: https://github.com/Jeanball/Musivault/compare/v1.5.3...v1.5.4
[1.5.3]: https://github.com/Jeanball/Musivault/compare/v1.5.2...v1.5.3
[1.5.2]: https://github.com/Jeanball/Musivault/compare/v1.5.0...v1.5.2
[1.5.0]: https://github.com/Jeanball/Musivault/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/Jeanball/Musivault/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/Jeanball/Musivault/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/Jeanball/Musivault/compare/v1.1.1...v1.2.0
[1.1.1]: https://github.com/Jeanball/Musivault/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/Jeanball/Musivault/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/Jeanball/Musivault/releases/tag/v1.0.0
