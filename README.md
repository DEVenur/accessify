# Accessify

> **Credit:** This project is based on [devoxin/anonify](https://github.com/devoxin/anonify) with refactoring and adaptation for LavaSrc and general Spotify access token needs.

A simple REST API to generate and cache anonymous Spotify access tokens using Playwright. This project is primarily designed for use as a custom anonymous token endpoint for [LavaSrc](https://github.com/topi314/LavaSrc) on Lavalink, but can be used in any application or service that needs a fresh Spotify access token.

> **Alternative:** For a compiled/binary version, you can use [accessify-rs](https://github.com/idMJA/accessify-rs) — a Rust port of this project.

## Features
- Generate anonymous Spotify access tokens (browser automation, Playwright)
- Designed for seamless integration with LavaSrc/Lavalink (`customTokenEndpoint`)
- Can be used by any service needing a Spotify access token
- Token caching with force refresh support
- Concurrency-safe (Semaphore)
- Fast REST API (Hono framework)
- TypeScript, modular and maintainable structure

## Requirements
- Node.js 18+
- Chromium browser (see below for installation instructions)

## Install dependencies

```bash
npm install
```

## Chromium Installation

### For most environments (not Pterodactyl):
Install Playwright's bundled Chromium automatically:

```bash
npx playwright install chromium
```

### For Pterodactyl (or restricted environments):
1. **Download Chromium**
   - Download a compatible Chromium build from [https://commondatastorage.googleapis.com/chromium-browser-snapshots/index.html](https://commondatastorage.googleapis.com/chromium-browser-snapshots/index.html) (choose your OS/arch, e.g. Linux x64).
2. **Extract the archive** and upload the `chrome`/`chromium` binary (and its folder) to your Pterodactyl server, e.g. `/home/container/chrome-linux/chrome`.
3. **Set the path in `.env`**:
   ```properties
   CHROME_PATH=/home/container/chrome-linux/chrome
   ```
4. **Restart your server/container**.

If `CHROME_PATH` is not set, Playwright will use its default browser (if installed).

## Build & Run

```bash
npm start
```

## API Usage

- **GET /spotifytoken**
  - Returns a cached Spotify access token (auto-refresh if expired)

Example:
```bash
curl http://localhost:3000/spotifytoken
```

## Integration: LavaSrc Custom Anonymous Token Endpoint

This API can be used as a custom anonymous token endpoint for [LavaSrc](https://github.com/topi314/LavaSrc) and Lavalink (see [LavaSrc PR #286](https://github.com/topi314/LavaSrc/pull/286)).

**Example LavaSrc on Lavalink config:**
```yaml
spotify:
  preferAnonymousToken: true
  customTokenEndpoint: "http://localhost:3000/spotifytoken"
```

## Notes
- For deployment on server/CI, make sure Chromium is available:
  - Use `npx playwright install chromium` for most environments.
  - For Pterodactyl, upload Chromium manually and set `CHROME_PATH` in `.env`.
- Request logs include IP and user-agent.

---
