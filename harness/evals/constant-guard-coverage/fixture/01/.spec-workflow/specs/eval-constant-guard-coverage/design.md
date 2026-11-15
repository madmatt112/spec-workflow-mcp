# Design — eval-constant-guard-coverage

## Component 1 — venue config

`src/venues.js` exports one config object per venue.

### Config constants

- **ebay_us** — the eBay US venue. Its `currency` constant is the string `USD`; a
  task that introduces this venue must pin that value so a silent change fails.
