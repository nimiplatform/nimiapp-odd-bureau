# 奇物局

把一张普通照片变成一局可点击、可盘问的荒诞推理游戏。

照片中的物品由 Nimi `vision.locate` 实时定位，成为故事里的角色。玩家点击照片收集证词，也能自由盘问；收集至少两份证词后，在照片里指认嫌疑物并揭晓真相。同一张照片可以重新生成不同的案件。

提供离奇失窃、集体罢工、秘密派对三种故事风格。声音播放通过 Nimi 语音合成；没有语音配置也能阅读和调查。所有故事均为虚构。

## 运行

本 App 已通过 app-tools 的正式 `create → install → init → sync → check` 流程创建。SDK、Kit 和 app-tools 均使用公开 npm 版本，无 workspace 依赖替换。

先打开 Nimi 并启用本地 App 开发，然后在本目录执行：

```powershell
pnpm install --frozen-lockfile
pnpm dev
```

这是独立仓库，使用自己的 pnpm workspace 和锁文件。App 由 Desktop 监督的 Electron Host 启动，不能直接打开 Vite 页面代替真实运行。

第一次打开，在「能力设置」为「看见物品」和「编故事」配置能力；可以使用 Kit 提供的「使用本机当前模型」按钮。定位能力使用本机环境。请同时确保 Nimi 的 Runtime → 环境中，定位所需组件已安装。模型已选择不代表运行环境已经准备好。

## 怎么玩

1. 直接使用「早餐之后」试玩照片，或上传 JPG、PNG、WebP 照片。建议有至少三件分开摆放的物品。
2. 选择故事风格，开案。
3. 点击照片里的物品。也可用照片下方的物品按钮通过键盘探索。
4. 问关键证词、自由盘问，在「线索本」比较不同角色的说法。
5. 点击「我知道是谁了」，在照片中指认并确认，揭晓本案。
6. 选择同一张照片再来一案，或使用新照片。

照片在处理后最长边不超过 1600 像素。当前照片、案件和调查进度通过 SDK 的 App storage 保存；不使用浏览器 localStorage 保存案卷。一次保留一桩案件。照片会交给 Nimi 中配置的能力处理；App 不连接第三方 AI REST 接口，不内置提供商或模型选择。

## 代码与检查

- `src/odd-bureau/App.tsx`：照片现场、探索、角色对话、线索本、指认与结局。
- `src/odd-bureau/nimi.ts`：公开 SDK/Kit 的定位、文本、语音与 App storage。
- `src/odd-bureau/game.ts`：真实坐标命中、角色与案件约束、生成提示。
- `src/odd-bureau/Setup.tsx`：Kit 的 App AIConfig 配置界面。
- `src/shell/routes/product-area.tsx`：接入 scaffold 的产品入口。

```powershell
pnpm check
pnpm test
pnpm build
```

规则测试只验证坐标命中、重复定位处理、案件角色与证据引用约束；不将合成测试数据当作真实 AI 验收。App 无预写谜案或硬编码热点作为失败时的替代。

## 本次移交

2026-09-12 起以本独立仓库为开发入口。app-tools 的正式初始化状态已保留，目录记录已对齐新仓库，并重新执行了 `sync` 和 `check`。旧 Nimi 仓库的活动 App 目录已移至其 `.nimi/local/odd-bureau-source-archive` 本地归档。

本仓库已完成冻结依赖安装、`check`、规则测试、构建与 Desktop 监督的真实 Electron 启动。实际使用试玩照片生成了「下午茶失踪案」，定位六件物品、收集六份证词、重开恢复进度、指认杯子并揭晓结局均已运行。图片导入后的来源标签和替代文本也已检查。迁移前还验证了自由盘问、键盘选择和通过 Runtime 目录选择中文声音后的语音播放；这些产品代码完整保留。

当前已验证的是 Windows 本地开发体验；生产安装包、上架与发布为 `NOT-VERIFIED`。后续可在此仓库继续打磨不同照片的故事质量、难度与节奏。

## 素材来源

`public/breakfast-scene.png` 是使用内置 Imagegen 生成的虚构试玩场景，界面明确标注。它只是一张输入照片，没有预计算的角色、热点或答案。生成提示已嵌入 PNG 元数据。

字体：ZCOOL QingKe HuangYou，通过 `@fontsource/zcool-qingke-huangyou` 自托管；许可随该 npm 包提供。图标来自 Lucide；常规控件与宿主桥接来自 Nimi Kit。
