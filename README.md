Current development dependencies are SDK 0.22.2, Kit/native 0.22.1, App Tools 0.14.0 and Nimi Coding 0.7.0. The checked-in pnpm lock resolves these packages from the public registry. Run `pnpm install --frozen-lockfile`, `pnpm exec nimi-app check`, then `pnpm dev` with a matching source-built Nimi Runtime and Home. App versions and published App releases are unchanged. Earlier versioned notes retain their original acceptance scope. Home uses the App-owned root `NIMI_APP.md`; this README remains developer documentation.

Upgrade verification: public-registry installation, frozen-lockfile installation, App Tools checks and the applicable type/Host build checks passed. Desktop-supervised macOS development opened the saved playground and AI configuration. New model-output journeys and packaged installation were not rerun; earlier evidence below retains its stated versions and scope.

[App introduction and usage](NIMI_APP.md)

# Odd Bureau (奇物局)

> Transform everyday objects in your photos into lively characters with quirks, personalities, and voices.

Odd Bureau turns mundane tabletop objects—cups, books, desk lamps, houseplants—into quirky suspects, musical gears, and dramatic actors. Powered by vision localization, conversational AI, and optional voice synthesis, Odd Bureau runs through protected Nimi calls using the Local or Cloud routes you select.

---

## Game Modes & Experience

Bring a photo of your desk or choose one of the built-in trial photos. Odd Bureau identifies real objects and brings them to life across three distinct gameplay scenarios:

1. **Object Mystery (奇物谜案)**
   A dramatic tabletop crime has taken place. The spilled coffee cup looks guilty, but the reading lamp claims to have witnessed everything from above. Interview the objects, collect conflicting testimonies, piece together physical clues, and solve the riddle.
2. **Musical Contraptions (声音机关)**
   Wire objects together into an acoustic mechanism. Chain a clock, a textbook, a potted succulent, and a ceramic mug to trigger synchronized notes and rhythms following the fixed rules shown for each object.
3. **Strike Negotiation (罢工谈判)**
   The objects have demands before they will perform. Allocate one leave slot and one credit, then agree on who will write, read, and stage the tale. Choose carefully: confirmed promises lock in constraints for later choices, and the final story strictly honors the deal without quietly undoing your commitments.

### Bilingual Experience
Odd Bureau automatically follows your system language at launch:
- **Chinese System**: Launches as **奇物局** with Simplified Chinese dialogue, interface, and prompts.
- **Other Systems**: Launches as **Odd Bureau** with full English narration, dialogue, and UI.
- Existing saved games remain intact and are never silently overwritten when switching languages.

---

## AI Capabilities Required

In Nimi Home's **Capability Settings** for Odd Bureau, configure:
- **Vision Localization (`vision.locate`)**: Required to identify and locate physical objects in photos.
- **Creative Writing (`text.generate`)**: Required to generate character dialogue, clues, and story events.
- **Voice Synthesis (`audio.synthesize`)** *(Optional)*: Gives characters audible voices to read their dialogue aloud.

Saved photos and game progress live in local Nimi App storage. Starting new object analysis, dialogue generation, or speech synthesis requires the corresponding capabilities to be active; when using a Cloud route, only the text and image inputs needed for that request are sent to your selected provider.

---

## Development & Packaging

The current source uses SDK 0.21, Kit 0.21 and the standard App navigation/chrome contract. One window-local controller owns the playground, saved round, settings and mystery destinations; business saves and photo data remain unchanged. Navigation retains mounted drafts and stops media when its view is hidden.

App Tools 0.13.2 and the compatible Kit 0.21.1 chrome teardown patch are selected through explicit local tarball overrides in `pnpm-workspace.yaml`. Kit 0.21.1 backports canonical fix `6b3ef1116` onto the complete published 0.21.0 package; its public declarations, SDK 0.21 and native carrier dependencies are unchanged. The complete archives are under `.nimi/local/platform-icons/`; these are development packages, not public releases. A clean checkout must receive the same complete archives before installation, or switch to their published registry versions when available. Production release preflight requires registry resolutions.

`metadata.icon` remains the portable artwork shown in Nimi Home. `build:electron` derives the macOS Dock PNG/ICNS and Windows multi-resolution ICO separately; packaged builds embed their platform icon. Home must not receive the padded macOS export.

### Prerequisites
- [Nimi Desktop](https://nimi.ai/download) or local development environment.
- Ready vision and text capabilities, using supported Local or Cloud resources.

### Running Locally
```bash
# Install dependencies
pnpm install

# Start development in Desktop-supervised Electron shell
pnpm dev
```

To inspect or resume an existing registration session:
```bash
pnpm dev -- --list-registrations
pnpm dev -- --resume <selector>
```

### Building & Packaging
```bash
# Typecheck and test
pnpm typecheck
pnpm exec nimi-app test
pnpm exec nimi-app check --production

# Build and package for your platform
# macOS
pnpm exec nimi-app build --target macos-aarch64 --production
pnpm exec nimi-app pack --target macos-aarch64 --production

# Windows
pnpm exec nimi-app build --target windows-x86_64 --production
pnpm exec nimi-app pack --target windows-x86_64 --production
```

---

## Release & Verification Status

- **Verified Publisher Release**: [v0.1.1](https://github.com/nimiplatform/nimiapp-odd-bureau/releases/tag/v0.1.1)
- **Registry Admission**: [#87](https://github.com/nimiplatform/nimi-app-registry/pull/87) (macOS arm64 and Windows x64)
- **Recorded Toolchain Combination**: SDK 0.21.0, Kit/native 0.19.3, App Tools 0.12.1, Nimi Coding 0.6.5
- **Previously Recorded Platform Checks**: macOS arm64 Catalog install, trial photo object localization (6 objects detected), text rule generation, local storage persistence, and bilingual locale switching verified. (Windows GUI execution and optional speech playback marked as `NOT-VERIFIED`).
