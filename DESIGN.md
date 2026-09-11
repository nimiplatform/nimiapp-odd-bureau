---
name: "奇物局 — App composition"
description: "Derived, non-authoritative visual context for the implemented photo mystery App."
colors:
  cabinet: "#5144c8"
  cabinet-dark: "#3b309b"
  panel: "#f0edff"
  ink: "#292045"
  muted: "#64577f"
  mint: "#c7f6a8"
  coral: "#ff947e"
  coral-hover: "#ffab96"
  lavender-hover: "#e4dff7"
  panel-band: "#e6dff9"
typography:
  display:
    fontFamily: "'ZCOOL QingKe HuangYou', sans-serif"
    fontSize: "clamp(38px, 4.8vw, 67px)"
    fontWeight: 400
    lineHeight: 1.12
    letterSpacing: "0.015em"
  headline:
    fontFamily: "'ZCOOL QingKe HuangYou', sans-serif"
    fontSize: "39px"
    fontWeight: 400
    lineHeight: 1.2
  title:
    fontFamily: "'ZCOOL QingKe HuangYou', sans-serif"
    fontSize: "32px"
    fontWeight: 400
    lineHeight: 1.25
  body:
    fontFamily: "'Microsoft YaHei UI', 'PingFang SC', system-ui, sans-serif"
    fontSize: "14px"
    lineHeight: 1.65
  dialogue:
    fontFamily: "'Microsoft YaHei UI', 'PingFang SC', system-ui, sans-serif"
    fontSize: "12px"
    lineHeight: 1.85
rounded:
  cabinet: "20px"
  action: "12px"
  field: "10px"
  object: "8px"
  tag: "6px"
spacing:
  control-gap: "7px"
  compact: "12px"
  panel-inset: "23px"
  wide-page-inset: "40px"
components:
  button-primary:
    backgroundColor: "{colors.coral}"
    textColor: "{colors.ink}"
    rounded: "{rounded.action}"
    padding: "0 18px"
    width: "100%"
  button-primary-hover:
    backgroundColor: "{colors.coral-hover}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "#4f406a"
    rounded: "{rounded.action}"
    width: "100%"
  question-field:
    backgroundColor: "#faf8ff"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "10px 11px"
    height: "42px"
  panel-switch-active:
    backgroundColor: "transparent"
    textColor: "{colors.cabinet-dark}"
    padding: "15px 0 11px"
  photo-source-tag:
    backgroundColor: "#292045d9"
    textColor: "#fff"
    rounded: "{rounded.tag}"
    padding: "6px 11px"
---

# Design System: 奇物局 — App composition

## Overview

**Creative North Star: "Pocket Arcade"**

A photo becomes the board of a pocket arcade. Matte violet encloses the scene; a pale lavender investigation panel carries the controls and dialogue. Mint identifies discoveries and coral gives the main action a physical, toy-like presence.

This is derived development documentation for the App-specific composition in `src/odd-bureau/odd-bureau.css`, `App.tsx` and `Setup.tsx`. The exported values describe that implementation; they are not an independent token or product authority. Shared Nimi contracts remain under `.nimi/spec/**`, and reusable controls remain owned by `@nimiplatform/kit`. `PRODUCT.md` retains the development brief.

The companion `.impeccable/design.json` contains standalone style previews and tooling extensions. Its synthesized tonal ramps are preview metadata, not implemented palette steps. This source review does not certify the running game, Runtime availability, accessibility conformance or product acceptance; journeys not run by this documentation task are NOT-VERIFIED.

**Key Characteristics:**

- The photo retains its own aspect ratio and carries the object markers.
- A continuous cabinet joins the scene, cast strip and investigation panel.
- Chinese display lettering supplies playfulness; system text carries reading and controls.
- Tonal surfaces, small state changes and one cabinet shadow keep the material matte.

## Colors

The cabinet is saturated but matte. Warm coral and fresh mint punctuate a quiet lavender reading surface.

- **Primary — Coral key:** `coral` marks opening, confirming and replaying a case. The App's primary key hover uses `coral-hover`; the inherited Kit primary-hover mapping separately remains `#ffac99` in the App CSS.
- **Secondary — Discovery mint:** `mint` marks discovered objects, the live dot, hints and the playful headline accent. Accusation mode changes object numbers to coral.
- **Tertiary — Cabinet violet:** `cabinet` is the page ground and the color of panel actions; `cabinet-dark` holds the photo surround and provides focus contrast on light surfaces.
- **Neutral — Lavender and plum:** `panel` is the investigation surface, `panel-band` groups its switches and accusation controls, `ink` carries primary reading and `muted` carries supporting text. `lavender-hover` is the shared hover fill used by mood and secondary photo controls.

The named frontmatter colors mirror the App's local custom properties or repeated state colors. The CSS maps selected values into scoped Kit action, text and radius variables under the App root; it does not change the shared Kit token definition.

**The Two Focus Surfaces Rule.** Use mint focus outlines on the violet stage and deep violet outlines inside light panels. Photo markers add a dark outer ring so focus remains distinct from discovery ink.

## Typography

The display face is self-hosted through `@fontsource/zcool-qingke-huangyou/400.css`. Its fallback is sans-serif. The body stack prefers Microsoft YaHei UI, then PingFang SC and the platform system sans-serif.

The frontmatter records the implemented starting values, not a generated mathematical scale. The landing heading uses the fluid display role; the live case title uses the headline role. The start-panel title uses the title role. Other game headings range from 25px for a witness name to 30px for an opening or reveal. The wordmark is 28px, with a small 9px English line and 0.17em tracking.

Body text starts at the body role. Dialogue uses the dialogue role, with asymmetric bubbles and generous leading. Supporting labels are mostly 10–13px. The capability setup heading deliberately returns to the system family at 24px and weight 600. Headings balance their lines; messages and errors wrap long content.

**The Display and Dialogue Rule.** Use the display face for the identity and game headings. Keep dialogue, controls and capability setup in the system stack.

## Layout

The header and main content share a centered 1440px maximum width and a 40px desktop side inset. A compact identity strip precedes the game. The initial heading and short explanation sit above one joined cabinet: a flexible photo column and a 354px investigation panel. The scene has a 48px status strip, an inset photo frame and a short instruction row; a continuous cast strip appears below the photo during a case.

The photo plane takes its aspect ratio from the selected image. The image fills that plane, and object buttons use percentage coordinates on it. The frame has a 270px desktop minimum height and dark spare space when needed. Cast entries divide the strip evenly; names truncate within their own controls. The investigation panel uses a vertical layout, with the action area after its content. Dialogue scrolls within a 258px maximum height; the notebook has a 493px desktop maximum.

| CSS condition | Implemented change |
| --- | --- |
| At least 1500px | Landing heading spacing expands to 15px above and 42px below. |
| 851–1250px | The invitation stamp hides and vertical introduction spacing tightens. |
| At most 1150px | Main/header side insets become 24px; the panel narrows to 325px; the small opening play note hides. |
| At most 850px | The cabinet stacks photo and cast before the panel, its radius becomes 16px, and the photo minimum height clears. The start panel briefly uses two columns with its actions spanning both. Dialogue and its input rise to 14px; dialogue may scroll to 270px while the notebook loses its height cap. The motto and footer sequence hide. |
| At most 500px | Main side insets become 12px; the landing heading is 43px with its explicit line break; the start panel and actions become vertical. Scene strips and cast portraits compact, the source label shrinks, and the Nimi credit hides. |

The setup composition has its own centered 960px maximum width, 30px side padding and a light surface inset by 22px. Its public Kit configuration surface uses regular density; the surrounding game uses expressive density.

**The Photo Plane Rule.** Keep the rendered image and normalized object boxes on the same aspect-ratio plane. The surrounding frame can letterbox; the scene is not a decorative cropped card.

## Elevation & Depth

Depth comes mainly from tonal layers: violet page, darker photo cabinet, near-black photo frame and a pale investigation panel. The cabinet has the single ambient shadow `0 16px 38px #25186638`. Generation and verdict overlays tint the existing scene; they do not replace it with a new card.

Object focus adds `0 0 0 7px #292045` behind its mint outline. This is a contrast treatment, not decorative elevation. Hover changes are short color or opacity transitions (180–200ms). The generation mark cycles its clipped window over 3s with ease-in-out; reduced-motion preference disables animation, transitions and smooth scrolling throughout the App.

## Shapes

The outer cabinet uses the broadest corners. Action controls use the App's 12px Kit radius mapping; the typed question field has its explicit 10px radius. Object boxes, portraits and cast controls generally use 8px corners. The photograph stays rectangular within its softly clipped frame.

Mint discovery numbers are circular, 27px across on desktop and 23px on narrow screens. Mood selectors pair an 11px rounded row with a small circular selection check. Conversation bubbles use asymmetric 11px corners to distinguish object and player turns. Compact labels, borders and the active panel underline carry state without adding more floating surfaces.

## Components

- **Primary and secondary keys:** Public Kit buttons receive App-local composition. The coral primary key is full width, at least 51px tall, uses 14px bold text and 18px horizontal padding. Its hover is warmer coral. The secondary photo key is at least 42px tall, transparent with a lavender border, and gains the shared lavender hover fill. Disabled buttons use half opacity and the unavailable cursor.
- **Mood selectors:** Three stacked App buttons use an icon, title, hint and circular check. A selected row uses a violet border and lavender fill; its check becomes solid violet. Selection is exposed with `aria-pressed`.
- **Panel switches:** Two adjacent buttons switch between the witness and notebook. The active button has a 3px violet bottom border, darker text and heavier weight. The clue count sits in a small lavender badge. These are a grouped content switch, not route navigation.
- **Photo markers and cast:** Markers begin visually quiet; hover, focus, hint or discovery reveals their border and number. The active object gains mint fill and its name label. The cast repeats the image-derived portraits beneath the scene and provides named keyboard buttons for investigating the objects.
- **Dialogue and evidence:** Object turns use lavender bubbles; player turns use pale green with a 20px inset. A green evidence action sits above the question controls, then becomes a collected-state label. The notebook uses separated text rows with tabular evidence numbers.
- **Question field and icon controls:** The question field is a Kit text field with an explicit 42px height, pale fill, plum border and violet caret. The violet send control shares its height. Voice and shell-help icon buttons have compact App-local sizing.
- **Photo source label and operation feedback:** A dark translucent label sits within the photo. It distinguishes an AI-created sample from a selected personal photo. Generation feedback overlays the photo with a status message and cancel action; the completed case uses a separate verdict overlay. Errors appear in a warm light alert below the cabinet.
- **Focus:** Buttons and inputs receive a 3px mint outline with 4px offset. Buttons and inputs inside the case panel, plus buttons in setup, help and error surfaces, use deep violet outlines. Photo markers also receive the dark outer ring described above. The source does not define a separate generic active-press animation.
- **Capability setup:** App-owned copy and a light container compose the public `ModelConfigAIConfigSurface`. The setup's internal model-selection controls and behavior remain Kit-owned.

**The App Ownership Rule.** Compose the public Kit controls with App-local styles. This document does not redefine the shared primitives, capability contracts or scaffold-managed setup surface.

## Do's and Don'ts

### Do:

- Do keep the matte violet, lavender, mint and coral roles established by this App.
- Do preserve the photo's geometry, object markers and keyboard-accessible cast controls together.
- Do keep dialogue readable and retain the light-surface focus treatment when composing controls.
- Do retain the source-aware photo label, fictional-story context and visible operation feedback.
- Do derive future documentation updates from the App implementation and preserve shared Kit ownership.

### Don't:

- Don't replace the selected pocket arcade with neon glows, a fake CRT or dashboard tiles.
- Don't put technical capability configuration on the game stage; retain its dedicated setup composition.
- Don't treat preview snippets or synthesized tonal ramps as new product components or canonical tokens.
- Don't use this documentation pass as evidence that an AI journey or product gate passed.
