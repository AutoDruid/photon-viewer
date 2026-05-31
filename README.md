# Photon Packet Visualizer

A web UI for inspecting raw [Photon Protocol](https://doc.photonengine.com/) packets
pasted from Wireshark (or any other source). The actual decoding is delegated to
[`AutoDruid/photon-parser`](https://github.com/AutoDruid/photon-parser) — a Go
library — compiled to WebAssembly and called from the browser. This project is
only responsible for the UI, the hex/tree linking, and the small WASM wrapper.

Both Photon protocol revisions are supported: **GpBinary v16** and **GpBinary v18**.

## How it works

```
Pasted hex   ──►   src/lib/hex.ts                (sanitize → Uint8Array)
                       │
                       ▼
                   src/composables/useWasm.ts    (boot + call doParsing)
                       │
                       ▼
                   public/main.wasm              (Go, compiled from src/parser)
                       │       │
                       │       └──► AutoDruid/photon-parser
                       ▼
                   JSON session                  (commands + parameters)
                       │
                       ▼
                   src/lib/tree.ts               (Session → TreeNode tree)
                       │
                       ▼
                   HexView + ParseTree           (linked highlighting)
```

The Go wrapper at `src/parser/main.go` exposes a single global function:

```js
// version: 'v16' | 'v18'
window.doParsing(bytes: Uint8Array, version: string) // → JSON string
```

It dispatches to `ParsePacketV16` or `ParsePacketV18` from `photon-parser`
and returns a JSON-serialized session.

## Project layout

```
app-vue/
├── public/
│   ├── main.wasm            # Built Go WASM binary (output of `mise build-wasm`)
│   └── wasm_exec.js         # Go runtime glue, copied from $GOROOT
├── src/
│   ├── App.vue              # Top-level layout, hex ↔ tree wiring
│   ├── components/
│   │   ├── AppHeader.vue        # Toolbar (version, view, parse, sample, clear)
│   │   ├── InputPane.vue        # Hex input + status + history
│   │   ├── HexView.vue          # Byte grid with hover/click sync
│   │   ├── ParseTree.vue        # Recursive tree of parsed fields
│   │   ├── TreeNode.vue
│   │   ├── FieldBreakdown.vue   # Flat field-by-field view
│   │   └── WasmBadge.vue        # Loading/ready/error indicator
│   ├── composables/
│   │   ├── useWasm.ts           # Boots main.wasm, exposes parse()
│   │   ├── useHistory.ts        # Recent-packet history (localStorage)
│   │   └── useFilters.ts
│   ├── lib/
│   │   ├── hex.ts               # Wireshark dump → Uint8Array
│   │   ├── tree.ts              # Session JSON → TreeNode + position index
│   │   └── labels.ts            # Human-readable names for fields
│   ├── parser/                  # Go WASM wrapper (compiles to main.wasm)
│   │   ├── main.go
│   │   └── go.mod
│   ├── types.ts                 # Shared types (Session, Command, TreeNode, …)
│   ├── main.ts                  # Vue + PrimeVue bootstrap
│   └── style.css                # Tailwind + theme tokens
└── .mise/config.toml            # Pinned toolchain + tasks
```

## Prerequisites

[`mise`](https://mise.jdx.dev/) pins the toolchain so anyone can reproduce the
build:

- **Node 24** and **pnpm 10.28.2** (pinned in `.mise/config.toml`)
- **Go** (any recent version with `GOOS=js GOARCH=wasm` support) — required
  only for rebuilding `public/main.wasm`

Install everything mise can manage:

```bash
mise install
pnpm install
```

## Tasks

The repository defines three mise tasks (see `.mise/config.toml`):

| Task                | What it does                                                                  |
| ------------------- | ----------------------------------------------------------------------------- |
| `mise build`        | `pnpm build` — typecheck + production Vite build into `dist/`.                |
| `mise typecheck`    | `vue-tsc --noEmit` over the whole project.                                    |
| `mise build-wasm`   | Builds `src/parser/main.go` to `public/main.wasm` and copies `wasm_exec.js`.  |

Raw pnpm scripts are also available:

```bash
pnpm dev        # Vite dev server with HMR
pnpm build      # Production build
pnpm preview    # Serve the production build locally
pnpm typecheck
```

## Building the WASM parser

`public/main.wasm` is already committed, so you can run the UI without a Go
toolchain. To rebuild it (e.g. after bumping `photon-parser` in
`src/parser/go.mod`):

```bash
mise build-wasm
```

That task is roughly equivalent to:

```bash
cd src/parser
GOOS=js GOARCH=wasm go build -o ../../public/main.wasm
cp "$(go env GOROOT)/lib/wasm/wasm_exec.js" ../../public/
```

To pin a specific upstream release:

```bash
cd src/parser
go get github.com/AutoDruid/photon-parser@v1.0.0
go mod tidy
cd ../.. && mise build-wasm
```

## Running locally

```bash
pnpm dev
```

Then open the printed URL. Paste a Wireshark hex dump into the left pane, pick
the protocol version in the toolbar, and press **Parse** (or `⌘/Ctrl+Enter`).

- **Split view** — input, hex grid, and parse tree side-by-side. Hovering a
  byte highlights the matching tree node and vice versa; clicking scrolls the
  other pane.
- **Field breakdown** — flat, groupable list of every decoded field, useful
  when reverse-engineering an unknown command.

## Disclaimer

This project is for **inspecting and learning** the Photon wire format. It does
not endorse any specific use; you are responsible for complying with the terms
of any service whose traffic you capture or analyze.
