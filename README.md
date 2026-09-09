# Durnible

A Matrix client with a discord-like chat experience. Includes a voice call UI with screensharing, emoji reactions, encrypted message search, optional popular embeds (youtube, spotify, etc), the ability to favorite rooms, gif server integration, and many other features. Durnible can be served as a progressive web app, desktop app, and an Android app. Forked from [Cinny](https://github.com/cinnyapp/cinny).

## Download

Desktop and Android builds are on the [releases page](https://github.com/0xTheCrow/durnible/releases):

| Platform | File |
| --- | --- |
| Windows | `.exe` installer |
| macOS | `.dmg` (Intel and Apple Silicon) |
| Linux | `.AppImage`, `.deb`, `.pacman` (x64) |
| Android | `.apk` |

None of these are code-signed yet, so Windows and macOS will warn you before the first launch. Desktop installs update themselves; the Android APK does not.

## Self-hosting

Durnible can be served either through a locally compiled build or by using Docker.

```sh
npm ci
npm run build   # compiles into dist/
```

Serve `dist/` with any webserver. Four non-obvious things to know:

* Serve it over https. Browsers only expose service workers in a secure context, and the service worker is what attaches the auth header to media requests. Over plain http on a lan ip, avatars and images silently fail to load. `localhost` counts as secure, so this looks fine while you're testing and breaks once it's deployed.

* Durnible is a single page app, so `dist/` contains one real page. Reload or bookmark a url like `app.example.com/home/` and an unconfigured webserver returns a 404, because no such file exists. Serve `index.html` for any path that isn't a real file and the app boots and reads the url itself. [`docker-nginx.conf`](docker-nginx.conf) is a working nginx example, and Caddy does this with `try_files {path} /index.html`. To skip webserver config entirely, [enable hash routing](config.json#L35). Urls become `app.example.com/#/home/`, which any static server already handles.

* The default list of Matrix servers and explore pages come from [`config.json`](config.json).

* To serve from a subdirectory, set `base` in [`build.config.ts`](build.config.ts). For `https://example.com/app`, that's `base: '/app'`.

### Docker

Builds from source and serves with nginx on port 80.

```sh
docker build -t durnible:latest .
docker run -p 8080:80 durnible:latest
```

Then visit `http://localhost:8080`.

## Voice calls

Calls need a MatrixRTC backend: a [LiveKit SFU](https://docs.livekit.io/home/self-hosting/deployment/) plus [lk-jwt-service](https://github.com/element-hq/lk-jwt-service). There's nothing to configure in Durnible. It reads the SFU from your Matrix server's `.well-known/matrix/client`, under `org.matrix.msc4143.rtc_foci`.

## GIF server

The GIFs tab is backed by [Zoetrope](https://github.com/0xTheCrow/zoetrope), a self-hosted GIF library. It's optional, and without it the tab isn't there at all.

Put your Zoetrope origin in a `.env.local` at the repo root before building:

```sh
VITE_GIF_SERVER_URL=https://gifs.example.com
```

Zoetrope authenticates against Matrix instead of its own accounts. Durnible posts a Matrix OpenID token to `/auth/matrix` and gets a session token back, so Zoetrope has to reach your Matrix server to verify it, the same way lk-jwt-service does. It also needs to allow your Durnible origin through CORS.

## Local Development

```sh
npm ci
npm start   # dev server
```

Node version is pinned in [`.nvmrc`](.nvmrc). Documentation for LLMs is in [AGENTS.md](AGENTS.md).
