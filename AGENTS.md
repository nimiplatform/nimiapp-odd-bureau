# AGENTS.md

## Scope
- Treat `.nimi/app-scaffold/{intent,lock}.json` as app-scaffold intent and lock state.
- Treat `.nimi/{config,contracts,methodology}/**` as `@nimiplatform/nimi-coding` managed projections created by `pnpm run init`.
- Keep auth, Runtime, App Access declaration, manifest, and Tauri shell glue in scaffold-managed files.
- App-owned product code is `src/workbench-core/**`, selected `src/capabilities/**`, `src/shell/routes/product-area.tsx`, and App-authored product screens, state, tests, styles, and bounded native helpers.
- Scaffold-managed code is the carrier/auth wiring, identity, manifests, project tooling, bounded native integration, and `src/scaffold/generated/**` composition glue.
- Treat this template as the identity-neutral, Lab-derived base. The generator composes it positively with only the dependency closure of explicitly selected admitted features under `src/capabilities/**`.
- The scaffold contains developer build/release inputs and one managed GitHub workflow, but it must not generate public admission, listing, registry-main, installed, running, or Runtime-access truth.

## Hard Boundaries
- Follow `Runtime / Realm truth -> @nimiplatform/sdk interface -> app consumer`.
- Runtime owns local execution, capability, readiness, routing, model, and memory truth; Realm owns canonical cloud identity, relationships, entities, and shared persistence.
- Use SDK typed projections for Runtime and Realm; do not call private endpoints or mirror their canonical truth locally.
- Use `@nimiplatform/kit` for reusable controls, layout, accessibility, tokens, and interaction patterns; keep app CSS and composition product-specific.
- Keep the base free of Lab-only product behavior. Feature implementations enter generated output only through the app-tools module registry and public admitted `--features` selection. Internal modules such as `ai-studio-core` enter only through dependency closure and are never selected directly.
- Keep Lab-only Settings/account, App Access diagnostics, Realm/Agent probes, World Tour, and native or diagnostic surfaces outside generated product composition.
- Preserve ownership: `sync` may refresh scaffold-managed files but must not overwrite app-owned workbench or module code; `check` is non-mutating. Identity and direct feature selection are immutable; create a fresh scaffold to change them.
- Preserve lifecycle order: `create -> dependency install -> init -> sync -> check -> dev/test/build -> pack`. Never run lifecycle commands after `create` before dependencies are installed. Local publish remains unavailable; production publication is owned by the managed protected-tag GitHub workflow, while registry admission and installation remain separate later owners.
- This third-party scaffold uses public registry versions only; do not substitute workspace paths, local overrides, tarballs, or downgrades. A private workspace-validation result is not standalone evidence.
- Use the scaffold-managed Kit Electron app-host bridge for supervised local development. Treat `nimi-shell-tauri` glue, where present, as bounded independent OS integration only, never a second local-development carrier, authority, App registration, admission, model-routing, or token-custody surface.
- Do not add provider/model hardcoding, compatibility dual-writes, pseudo-success, Runtime internals, generated private clients, or Desktop product source.
- Before durable storage, native commands, private calls, or registries, inspect the nearest contract and current consumer; ask only if multiple semantic owners remain plausible.

## Retrieval Defaults
- Start with the requested product route, its direct SDK/Kit surface, and the relevant scaffold-managed glue.
- Read platform authority only when ownership or semantics remain ambiguous; skip unrelated platform packages and generated files.

## Verification Commands
- After `pnpm install` and `pnpm run init`, run `pnpm run sync`, `pnpm run check`, the directly affected tests, and the affected build.
- Run the official Desktop-supervised App journey when product interaction is in scope; shell or native checks alone do not replace it.
- Mark every product path not actually run as `NOT-VERIFIED`. Help text, focused tests, and CDP visibility do not establish implementation or release acceptance.

<!-- nimicoding:managed:agents:start -->
# Nimi Coding Managed Block

- From the repository root, invoke the pinned project-local CLI as `pnpm exec nimicoding`; do not probe or rely on a global `nimicoding` binary in `PATH`.
- Product authority lives under `.nimi/spec/**`.
- Choose authority and code queries when their declared scope can resolve an uncertainty that affects the current task; reuse sufficient current evidence. Query scope is not the limit of host reasoning or authorized work, and hypotheses are not product authority.
- For canonical authority authoring, read only `.nimi/methodology/authority-authoring.yaml`, the affected authority files or bounded task context, and CLI diagnostics.
- Use `pnpm exec nimicoding authority context <path> <id> --max-units <n> --max-bytes <n> --json` only for the complete declared outgoing interpretation closure; it is not complete task context, and failure never permits guessed or partial context.
- Use `pnpm exec nimicoding authority diff` and `pnpm exec nimicoding authority impact` with explicit `--max-bytes`; impact reports declared review obligations and does not prove implementation, consumers, or tests are synchronized.
- Use `pnpm exec nimicoding authority change-candidates` only with explicit channels and budgets; its complete union is recall input, never conflict, retirement, absence, authority, or conformance judgment.
- When explicit authority links are needed, use `pnpm exec nimicoding code authority --repo <root> --authority <id> --max-files <n> --max-bytes <n>` to locate annotated code, and use `--source <path>` for code-to-authority lookup. Results cover only explicit markers and authority lifecycle; they do not prove implementation conformance or evaluate unannotated code.
- For a new or changed authority-governed feature, add the reserved standalone physical line `// @nimi-authority: <exact-id>` in TypeScript/TSX, Go, or Rust, and `# @nimi-authority: <exact-id>` in Python. The scanner does not prove language comment context, so use this reserved form only for intentional links at a few key semantic owners.
- Use `// @nimi-deprecated: <exact-id>`, or `# @nimi-deprecated: <exact-id>` in Python, only after direct authority evidence or a real product failure confirms obsolete semantics; find it with `pnpm exec nimicoding code authority --repo <root> --audit --max-files <n> --max-bytes <n>` and remove it with the hard cut.
- When a selected TypeScript or TSX consumer still has a static-dependency question, use `pnpm exec nimicoding code context <path> --repo <root> --symbol <identifier> --tsconfig <path> --max-bytes <n>` for bounded root-direct static dependencies; it is not inbound impact, runtime dispatch, or complete task context.
- Use `pnpm exec nimicoding sync --check` to diagnose drift in package-owned managed projections, `pnpm exec nimicoding sync --apply` to restore them, and `pnpm exec nimicoding doctor` to diagnose package/managed compatibility. These commands do not validate product authority, implementation conformance, or task readiness.
- Under `.nimi/spec/**`, author only closed multi-unit `*.authority.yaml` containers or single-unit `*.authority.md`; historical document formats are unsupported and never inferred.
- Run `pnpm exec nimicoding authority fmt` on each changed file, then `pnpm exec nimicoding authority check` on the complete authority input set.
- A failed project-local `pnpm exec nimicoding ...` invocation supplies no usable result. Pause decisions that require refused, missing, or incomplete results; continue independent authorized work. Never substitute guessed, corpus-wide, or fallback context, or treat diagnostics or partial output as complete context; choose repair values only from product/task authority.
- Keep derived and local verification output under `.nimi/local/**`; it is never product authority.
<!-- nimicoding:managed:agents:end -->
