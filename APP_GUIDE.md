# 奇物局 · Odd Bureau

跟随启动时的系统语言：中文系统显示「奇物局」，其他语言显示「Odd Bureau」，界面、AI 创作和朗读一起切换。更改系统语言后请重新启动 App。旧版本的中文进度仍可读取；切换语言后，新玩法使用当前语言，不会悄悄翻译已有故事。

The App follows the system language at launch: Chinese locales use 奇物局 and Simplified Chinese; other locales use Odd Bureau and English for the interface, AI writing, and speech. Relaunch after changing the system language. Existing Chinese progress remains readable; saved fiction is not silently translated.

把照片里的杯子、书和灯变成有性格的角色。你可以调查一桩奇物谜案，把物件连接成音乐机关，或者协商一场物件戏剧的分工。

在 Nimi Home 安装并启动。在「能力设置」为「看见物品」选择已准备的视觉定位模型，为「创作玩法」选择文本模型；「让物品开口」的语音合成是可选项。可使用内置的 AI 试玩照片，也可选择自己的照片。实际定位框决定登场物件，AI 提议需要满足游戏规则，失败时不会用虚构定位或伪成功继续。

照片、规则、线索、对话和进度保存到 App 的 Nimi 托管本地存储。选择云端模型时，这次推理需要的内容会经 Nimi 发往选定服务；App 不持有服务商凭据。关闭并重新打开 App 可继续已保存的一局。

## Development and release

Published dependencies: SDK 0.21.0, Kit/native 0.19.3, App Tools 0.12.1, nimi-coding 0.6.5. Install with `pnpm install --frozen-lockfile`; use `pnpm dev` for the Desktop-supervised Electron Host. Existing data requires the explicit registration shown by `pnpm exec nimi-app dev --list-registrations`.

Run `pnpm typecheck`, `pnpm exec nimi-app test`, and `pnpm exec nimi-app check --production`. Build and pack through `pnpm exec nimi-app build --target macos-aarch64 --production` and `pnpm exec nimi-app pack --target macos-aarch64 --production`; Windows uses the declared `windows-x86_64` target. Annotated version tags invoke the managed GitHub Release workflow. Registry admission and real installed-App acceptance are separate steps.

The App-owned license is MIT, copyright Nimi Network Limited. Template notices remain in `licenses/nimi-app-template.txt`. Public SDK/Kit carriers own Runtime, registration, authorization and AI jobs; this repository owns the game and its local progress.

## Published dependency and Catalog acceptance (2026-10-13)

Current public release: [0.1.1](https://github.com/nimiplatform/nimiapp-odd-bureau/releases/tag/v0.1.1); [Registry admission #87](https://github.com/nimiplatform/nimi-app-registry/pull/87) is merged for macOS arm64 and Windows x64. Frozen locks use published SDK 0.21.0, Kit/native 0.19.3, App Tools 0.12.1 and nimi-coding 0.6.5; no local Nimi archive or source-link resolution is required.

Repository checks and managed production builds, package provenance and immutable Release checks passed for both declared targets. Actual Catalog download, installation and AI acceptance ran on macOS arm64 through source Nimi Home and its matching protected Runtime (Nimi main 35498102b). Runtime identity and App Access checks remain enforced.

Real vision localization found six objects in the bundled trial photo. Real text generation produced the machine rules. Clock → book → plant → cup met the actual six-note target; the completed challenge and stored sounds survived a full Home stop/launch.

**NOT-VERIFIED:** Windows GUI installation and AI use. Mystery, negotiation and optional speech synthesis were not rerun.

## Bilingual development verification (2026-10-13, unreleased changes)

`sync`, `check`, renderer/Electron builds, authority validation and all 31 tests passed for the new bilingual source. Component rendering covers Chinese, English and non-Chinese locale fallback, six AI prompt builders, voice language tags/names, and reading published Chinese saves.

On the Desktop-supervised macOS arm64 development Host, the actual Chinese system locale displayed 奇物局 with `zh-CN` document language. English navigator-language emulation on the same protected Host displayed Odd Bureau with `en` document language; the English home, AI settings, mystery view and 390px layout were inspected. Real vision found six objects; real text generation created “The Great Fruit Fiasco,” and a witness answered in English. Reloading restored the English case and collected testimony. Returning to Chinese restored the original Chinese machine and its existing rules without errors.

**NOT-VERIFIED:** successful Chinese/English speech playback: actual synthesis returned `AI_LOCAL_EXECUTION_LOAD_FAILED` (local execution model load failed). The new Chinese machine generation failed operation validation; no playable success was substituted. Full negotiation/performance acceptance, English machine acceptance, Windows GUI and installed-package localization remain unverified. Registry, installer and managed application-menu names still use the carrier's single canonical 奇物局 display name; App-owned branding and document/window title are localized.
