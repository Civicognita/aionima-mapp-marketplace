# Aionima MApp Marketplace

Official MagicApp (MApp) definitions for the Aionima platform.

## Structure

```
mapps/
  {author}/
    {slug}.json          MApp definition (mapp/1.0 schema)
```

MApps are JSON-defined applications — NOT plugins. They are:
- **Declarative** (JSON only, no executable code)
- **Scannable** (security scanner validates before install)
- **Portable** (single JSON file, copy to install)
- **Attributable** (author field, COA-tracked as $MA resources)
- **Eventually on-chain** (deterministic, compilable, signed)

## Install Path

MApps are installed to `~/.agi/mapps/{author}/{slug}.json` on the target system. The AGI gateway discovers them at boot via `mapp-discovery.ts`.

## COA<>COI

Every MApp lifecycle event (MINT, PUBLISH, INSTALL, UPDATE) is tracked via the Impactinomics COA<>COI chain:

```
#E0.#O0.$A1.MINT(~fancy-ide)<>$MA1
```

- **COA** (Chain of Accountability): who created/published it
- **COI** (Chain of Impact): what registration was created

## Categories

| Category | Purpose |
|----------|---------|
| `viewer` | Content consumption & display |
| `production` | Asset creation & editing |
| `tool` | Stateless input/output utilities |
| `game` | Interactive games & simulations |
| `custom` | Catch-all |

## Project Categories

MApps declare which project categories they're compatible with:

`literature`, `app`, `web`, `media`, `administration`, `ops`, `monorepo`
