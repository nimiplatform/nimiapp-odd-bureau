# 奇物局 · Odd Bureau

把照片里的杯子、书和灯变成有性格的角色。你可以调查一桩奇物谜案，把物件连接成音乐机关，或者协商一场物件戏剧的分工。

在 Nimi Home 安装并启动。在「能力设置」为「看见物品」选择已准备的视觉定位模型，为「创作玩法」选择文本模型；「让物品开口」的语音合成是可选项。可使用内置的 AI 试玩照片，也可选择自己的照片。实际定位框决定登场物件，AI 提议需要满足游戏规则，失败时不会用虚构定位或伪成功继续。

照片、规则、线索、对话和进度保存到 App 的 Nimi 托管本地存储。选择云端模型时，这次推理需要的内容会经 Nimi 发往选定服务；App 不持有服务商凭据。关闭并重新打开 App 可继续已保存的一局。

## Development and release

Published dependencies: SDK 0.21.0, Kit/native 0.19.3, App Tools 0.12.1, nimi-coding 0.6.5. Install with `pnpm install --frozen-lockfile`; use `pnpm dev` for the Desktop-supervised Electron Host. Existing data requires the explicit registration shown by `pnpm exec nimi-app dev --list-registrations`.

Run `pnpm typecheck`, `pnpm exec nimi-app test`, and `pnpm exec nimi-app check --production`. Build and pack through `pnpm exec nimi-app build --target macos-aarch64 --production` and `pnpm exec nimi-app pack --target macos-aarch64 --production`; Windows uses the declared `windows-x86_64` target. Annotated version tags invoke the managed GitHub Release workflow. Registry admission and real installed-App acceptance are separate steps.

The App-owned license is MIT, copyright Nimi Network Limited. Template notices remain in `licenses/nimi-app-template.txt`. Public SDK/Kit carriers own Runtime, registration, authorization and AI jobs; this repository owns the game and its local progress.
