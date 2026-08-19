# YourSH — Your Shell

Open a browser link and get a real Linux terminal. YourSH streams a shell
(tmux-optional) from a device you control to anyone you share the link with.

- **Browser terminal** built on [wterm](https://www.npmjs.com/package/@wterm/vue)
  (DOM-rendered, Zig/WASM core). Multiple, draggable, resizable terminal
  windows — like a real desktop.
- **One service, one URL.** The Node backend serves the built frontend and
  relays a WebSocket, so there is nothing else to host.
- **Three ways to connect:**
  - **Local** — runs a shell on the *same device* the server runs on (great for
    a phone running Termux). tmux is **opt-in**.
  - **Phone** — for when the server is remote (e.g. Render) but the shell lives
    on your phone: the phone dials *out* to the server (beats NAT/CGNAT), the
    server relays to the browser.
  - **SSH** — connect straight to any reachable SSH host.
- **Free to self-host.** Runs on a phone in Termux or on Render's free tier.
  Works fully offline — the terminal core is inlined, no CDN.

## How it works

```
 browser  ──WebSocket(/ssh)──►  Node relay  ──┬── Local: script → shell/tmux
 (wterm)                           (ws)       ├── Phone: relays to /agent (phone outbound)
                                            └── SSH: ssh2 → host
```

The browser and the target never need to see each other directly. The phone's
agent connects *outbound*, so no port forwarding is required.

## Quick start (phone / Termux)

The built frontend is committed to `dist/`, so the phone needs **no build
step** — just install, clone, run.

```bash
pkg install -y nodejs tmux util-linux
git clone https://github.com/SodiqovSardor/yoursh.git && cd yoursh
npm install && npm run server
```

Find your phone's LAN IP (`ip addr` on `wlan0`), then from a laptop on the same
network open (incognito):

```
http://<phone-ip>:3000
```

A terminal window opens immediately. Use the floating **`+`** to spawn more,
drag windows around, resize from the corner.

## Modes

| Mode   | What it does                                                        |
|--------|---------------------------------------------------------------------|
| Local  | Shell on the server's own device. Tick *Launch inside tmux* for a persistent session. |
| Phone  | Shows a command to paste into Termux; the phone connects out to the server and is relayed to your browser. |
| SSH    | Direct SSH to `host:port` with username/password.                   |

## Deploy to Render (free tier)

`render.yaml` is included. Push this repo to GitHub, create a new Web Service
from it on Render, and it builds + serves automatically. The phone/SSH/agent
flows work the same over `wss://`.

> Render free instances sleep after 15 min idle; the first load may take ~30s.

## Develop

```bash
npm install
npm run dev          # vite dev server (frontend) on :5173, talks to a running server
npm run server       # backend on :3000 serving the built dist/
npm run build        # type-check + build frontend into dist/
```

Frontend env (dev only): `VITE_WS_URL=ws://localhost:3000/ssh`.

## Project layout

```
server/
  index.ts     HTTP + single WebSocketServer; routes /ssh (browser) and /agent (phone)
  ssh.ts       ssh2 connect / resize / input
  agent.js     phone-side relay (runs in Termux, connects outbound)
src/
  App.vue                  desktop shell (windows, launcher, modal)
  components/
    ConnectForm.vue        Local / Phone / SSH picker
    TerminalWindow.vue     one draggable/resizable wterm window + WS wiring
  composables/             (none — logic lives in the components)
```

## License

Apache License 2.0 — see [LICENSE](./LICENSE).
