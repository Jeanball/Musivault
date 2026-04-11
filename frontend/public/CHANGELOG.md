# Public Changelog

Find all the new features and improvements added to the app right here!

## [1.11.0] - 2026-04-11

### BREAKING CHANGE: Discogs Seller Enrollment Required (Administrators Only)

*Note: This setup is only required for the Musivault Administrator. Regular users do not need to take any action.*

To use the new **price synchronization** features, the Musivault administrator must complete the following setup:

**Step 1 — Enroll as a Discogs seller:**
[https://www.discogs.com/settings/seller/](https://www.discogs.com/settings/seller/)

**Step 2 — Generate a Personal Access Token (PAT):**
Go to [https://www.discogs.com/settings/developers](https://www.discogs.com/settings/developers), click **"Generate new token"**, and add the token as `DISCOGS_PAT` in your `.env` or `docker-compose.yml`.

Once configured, you can fetch prices from the **Admin Task Center**.

### What's New
- **Collection Value & Stats Page**: A brand-new Stats page lets you visualize your collection's estimated market value with interactive charts and time series tracking.
- **Price Synchronization**: Sync individual album prices or your entire collection from Discogs marketplace data, with automatic scheduled refreshes.
- **Admin Task Center**: Administrators can now manage and run background tasks on demand, including price fetching and exchange rate refreshes, with localized notifications and scheduling.
- **Format Verification**: The collection page now detects and warns you about format mismatches between your saved format and the Discogs release data, with dismissible alerts and undo support.
- **Currency Preferences**: Choose your preferred display currency in the settings, with automatic conversion using live exchange rates.

### Improvements
- Redesigned collection filter bar with new issue and view toggles.
- Streamlined stats layout with value sync controls directly in the chart header.
- Improved mobile navigation with better back button behavior in the collection.
- Optimized collection page filtering and derived stats for faster performance.
- Reorganized the navigation menu for a cleaner experience.
- Updated Discover page layout with "View Collection" links for better usability.

### Bug Fixes
- Fixed currency formatting to consistently display two decimal places.
- Removed unused code from the currency hook for cleaner performance.

---
## [1.10.0] - 2026-03-20

### What's New
- Public Collections: Shared collections now have a beautiful dedicated layout when accessed by guests.
- Grouped Version Selection: Album versions are now grouped better by common attributes for cleaner reading.
- Collapsible Tracklists: Album pages are cleaner with new collapsible tracklists.
- Artist Album Search: You can now quickly search or filter through an artist's discography on their dedicated page.

### Improvements
- Modern Artist Page: The artist album list has been completely redesigned from a grid into a sleek, interactive list layout.
- Smoother Loading: Images now fade in smoothly with a loading placeholder to prevent layout jumps.
- Better Album Badges: Format and description badges now look much sharper and more dynamic.
- Refined Modals: Cleaned up several popups, providing better layout and an elegant blur background effect.

### Bug Fixes
- Format Text Wrap: Fixed a visual issue where lengthy format names would overflow out of selection buttons and modal windows.

---

## [1.9.0] - 2026-01-17

### What's New
- Multi-language Support: The app now supports English, French, and German! You can set your preference in the settings.
- Wide Screen Mode: Added a toggle to utilize your entire screen width if you have a large monitor.
- Customizable Profiles: You can now set your own Display Name and manage your profile in the new settings tab.
- Advanced Search: You can now directly look up albums by their Discogs ID or Catalog Number.
- Condition Grading: Keep track of the condition of your media and sleeves with our new grading system.
- Manual Album Entry: Can't find an album online? You can now manually type in all details and upload your own cover art.

### Improvements
- UI Makeover: Replaced many older icons with sleek new ones and added a "Made with" footer.
- Mobile Search: The search bar on mobile has been optimized with a new dropdown for switching between Albums and Artists.
- Security: Under-the-hood improvements to how database connections and user permissions are handled.

### Bug Fixes
- Fixed an issue where users could experience a blank white screen due to login redirection loops.

---

## [1.8.0] - 2025-12-31

### What's New
- Single Sign-On (SSO): Support for modern, secure login methods.
- Unified Search: Search for both artists and albums at the same time and view results side-by-side.
- "What's New" Modal: A helpful popup to show you the latest updates (like the one you're reading now!).
- Track-level Search: You can now search your entire collection by individual track names!
- Tracks View: A new toggleable view to browse your collection by individual tracks instead of just full albums.
- Dynamic Greetings: The homepage now warmly greets you based on the time of day.

### Improvements
- Cleaner Layout: Reorganized album detail pages to be significantly easier to read.
- Smarter Filtering: Excluded digital-only releases (CDs, Vinyl, and Cassettes only!).
- Mobile Friendly: The search bar auto-focuses much better, and navigation is more intuitive.

### Bug Fixes
- Fixed a bug to ensure you scroll to the top automatically when opening a new album page.

---
