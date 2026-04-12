# Durnible

A Matrix client focusing primarily on providing a discord-like chat interface with an emphasis on ease-of-use and usability improvements to minimize friction for users new to e2ee chat systems. Forked from [Cinny](https://github.com/cinnyapp/cinny).

- [Contributing](./CONTRIBUTING.md)

## Self-hosting

Build the app with `npm run build` and serve the files from `dist/` using your preferred webserver.

* The default homeservers and explore pages are defined in [`config.json`](config.json).

* You need to set up redirects to serve the assets. Example configurations: [netlify](netlify.toml), [nginx](contrib/nginx/durnible.domain.tld.conf), [caddy](contrib/caddy/caddyfile).
    * If you have trouble configuring redirects you can [enable hash routing](config.json#L35) — the url in the browser will have a `/#/` between the domain and open channel (ie. `app.example.com/#/home/` instead of `app.example.com/home/`) but you won't have to configure your webserver.

* To deploy on a subdirectory, rebuild the app after updating the `base` path in [`build.config.ts`](build.config.ts).
    * For example, if you want to deploy on `https://example.com/app`, then set `base: '/app'`.

## Local development
> [!TIP]
> We recommend using a version manager as versions change very quickly. You will likely need to switch between multiple Node.js versions based on the needs of different projects you're working on. [NVM on windows](https://github.com/coreybutler/nvm-windows#installation--upgrades) on Windows and [nvm](https://github.com/nvm-sh/nvm) on Linux/macOS are pretty good choices. Recommended nodejs version is Iron LTS (v20).

Execute the following commands to start a development server:
```sh
npm ci # Installs all dependencies
npm start # Serve a development version
```

To build the app:
```sh
npm run build # Compiles the app into the dist/ directory
```

### Running with Docker
This repository includes a Dockerfile, which builds the application from source and serves it with Nginx on port 80. To use this locally, you can build the container like so:
```
docker build -t durnible:latest .
```

You can then run the container you've built with a command similar to this:
```
docker run -p 8080:80 durnible:latest
```

This will forward your `localhost` port 8080 to the container's port 80. You can visit the app in your browser by navigating to `http://localhost:8080`.
