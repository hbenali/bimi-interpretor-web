# BIMI Checker

A free, single-page BIMI (Brand Indicators for Message Identification) checker — validate a domain's BIMI DNS record, DMARC readiness, logo preview, and VMC certificate details. Live at [bimi.hbenali.ovh](https://bimi.hbenali.ovh).

No backend, no build step, no dependencies — it's one static `index.html` calling public APIs directly from the browser.

## Features

- **Lookup** any domain's BIMI TXT record (`selector._bimi.domain`) via DNS-over-HTTPS
- **DMARC readiness check** — BIMI requires `p=quarantine` or `p=reject`
- **Record validation** — flags missing/invalid `v=`, `l=`, `a=` tags and non-HTTPS URLs
- **Logo preview** — renders the referenced SVG logo directly in the browser
- **SVG upload & analysis** — drag & drop your own logo to check size, format, and Tiny 1.2 profile basics
- **Dark mode** with persisted preference
- **Guide section** — BIMI overview, SVG specs, VMC certificates, and real-world examples
- Fully responsive, accessible (ARIA tabs, WCAG AA contrast), and SEO-tagged (Open Graph, Twitter Card, JSON-LD)

## Running locally

No build step required — just serve the directory:

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

## Data sources

All lookups happen client-side against free public APIs:

- [dns.google](https://developers.google.com/speed/public-dns/docs/doh) — DNS-over-HTTPS for BIMI/DMARC record lookups
- The logo referenced by a BIMI record's `l=` tag is loaded directly as an `<img>` from wherever the domain hosts it

## Deployment

Deployed automatically to GitHub Pages on every push to `main` (see `.github/workflows/`).

## License

MIT — see [LICENSE](LICENSE).
