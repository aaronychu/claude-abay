# A+BAY fork 上游同步指南

本文记录 `aaronychu/claude-abay` 相对上游 `NanmiCoder/cc-haha` 需要长期保留的 fork 定制。下次同步上游时，优先按本文检查，而不是只看冲突文件。

## 仓库关系

- fork 仓库: `https://github.com/aaronychu/claude-abay`
- 上游仓库: `https://github.com/NanmiCoder/cc-haha`
- 当前产品名: `Claude Code A+BAY`
- 当前 CLI 名: `claude-abay`
- 当前桌面品牌视觉: `Lumo Claw`
- 当前应用数据目录: `~/.claude/claude-abay`

常用同步流程:

```bash
git fetch upstream
git fetch origin
git checkout main
git merge upstream/main
```

合并后不要直接发布。先按本文的“同步后检查清单”恢复 A+BAY 定制，再运行验证。

## 一、品牌与包名定制

目标: 所有用户可见的 `Claude Code Haha` / `cc-haha` 品牌改为 A+BAY 体系。

保留内容:

- README、文档、release notes 指向 `aaronychu/claude-abay`。
- CLI 入口为 `bin/claude-abay`，`package.json` 的 bin/script 使用 `claude-abay`。
- 桌面端包信息:
  - `desktop/package.json`:
    - `description`: A+BAY 桌面工作台描述
    - `homepage`: `https://github.com/aaronychu/claude-abay`
    - `build.appId`: `com.claude-code-abay.desktop`
    - `build.productName`: `Claude Code A+BAY`
    - `build.artifactName`: `Claude-Code-ABAY-${version}-${os}-${arch}.${ext}`
    - `build.publish.owner`: `aaronychu`
    - `build.publish.repo`: `claude-abay`
- 服务端持久化目录使用 `claude-abay` 子目录，避免覆盖上游或 Claude Code 原配置。

重点文件:

- `README.md`
- `README.en.md`
- `package.json`
- `package-lock.json`
- `bin/claude-abay`
- `desktop/package.json`
- `src/server/services/providerService.ts`
- `src/utils/managedEnv.ts`
- `src/server/services/abayOAuthService.ts`
- `src/server/api/abay-oauth.ts`
- `release-notes/v*.md`

同步上游后检查:

```bash
rg -n "Claude Code Haha|cc-haha|NanmiCoder/cc-haha|claude-code-haha" README.md README.en.md package.json desktop/package.json src desktop docs release-notes
rg -n "Claude Code A\\+BAY|claude-abay|aaronychu/claude-abay" README.md package.json desktop/package.json src desktop docs release-notes
```

## 二、视觉资产与桌面首页

目标: 使用 A+BAY / Lumo Claw 视觉，不回退到上游默认 logo。

保留内容:

- 侧边栏展开时显示 `desktop/public/app-title.png`。
- 侧边栏折叠时显示 `desktop/public/app-icon.png`。
- 会话空状态/首页 logo 使用 `app-icon.png`，并保持 `w-auto` / `object-contain`，避免图标被压扁。
- 文档图片使用 `docs/images/app-icon*.png/svg`、`docs/images/logo-horizontal.*`、`docs/images/banner.*`。
- Tauri/Electron 包图标在 `desktop/src-tauri/icons/`，如果更换 `app-icon-macos.svg` 或源图，需要重新生成 `icon.icns`、`icon.ico` 和各尺寸 png。

重点文件:

- `desktop/public/app-icon.png`
- `desktop/public/app-icon.svg`
- `desktop/public/app-title.png`
- `desktop/public/LCText.svg`
- `desktop/public/LumoSingle.svg`
- `desktop/src-tauri/icons/*`
- `desktop/src/components/layout/Sidebar.tsx`
- `desktop/src/pages/ActiveSession.tsx`
- `desktop/src/pages/EmptySession.tsx`
- `docs/images/*`

同步上游后检查:

```bash
rg -n "app-title|app-icon|Lumo|Claude Code A\\+BAY" desktop/src desktop/public docs/images
```

## 三、桌面 UI 配色与 Codex 风格

目标: 保留 A+BAY 当前的 light/dark/white 配色，不回退到上游 Lumo 或默认主题。

保留内容:

- `desktop/src/theme/globals.css` 中的 A+BAY/Codex 风格 token。
- `white` 和 `light` 都按浅色应用处理，`dark` 按深色应用处理。
- 聊天窗口、输入框外层、设置页、弹窗、侧边栏底栏要保持统一背景，不要出现局部透明后看不清文字。
- 去掉多余硬线条:
  - 设置页上方/左侧边线
  - 侧边栏与主界面之间的硬分隔线
  - 工作区和聊天输入框上下硬线
  - 侧边栏底栏硬线

重点文件:

- `desktop/src/theme/globals.css`
- `desktop/src/components/layout/Sidebar.tsx`
- `desktop/src/components/layout/AppShell.tsx`
- `desktop/src/components/layout/StatusBar.tsx`
- `desktop/src/components/layout/TabBar.tsx`
- `desktop/src/components/chat/ChatInput.tsx`
- `desktop/src/pages/ActiveSession.tsx`
- `desktop/src/pages/EmptySession.tsx`
- `desktop/src/pages/Settings.tsx`

同步上游后检查:

```bash
rg -n "border-r|border-l|border-t|border-b|surface-sidebar|sidebar-material|chat-composer" desktop/src desktop/src/theme/globals.css
```

## 四、系统磨砂 sidebar

目标: 桌面端 sidebar 既有真实系统磨砂，又不因为“系统深色/应用浅色”或“系统浅色/应用深色”而颜色跑偏。

实现方式:

- Electron 窗口使用透明背景和原生材质:
  - macOS: `vibrancy: 'sidebar'`
  - Windows: `backgroundMaterial: 'acrylic'`
  - Linux: 不启用透明材质
- 渲染层切换主题时，通过 IPC 通知 Electron 主进程设置 `nativeTheme.themeSource`:
  - `white` / `light` -> `light`
  - `dark` -> `dark`
- CSS 只负责轻微 tint 和布局，不依赖 CSS-only `backdrop-filter` 去模糊系统桌面。

重点文件:

- `desktop/electron/services/windows.ts`
  - `nativeMaterialWindowOptionsForPlatform()`
- `desktop/electron/main.ts`
  - `BrowserWindow` 创建参数
  - `nativeTheme.themeSource`
- `desktop/electron/ipc/channels.ts`
  - `appSetTheme`
- `desktop/electron/ipc/capabilities.ts`
  - 只允许 `white` / `light` / `dark`
- `desktop/src/lib/desktopHost/electronHost.ts`
  - `host.app.setTheme()`
- `desktop/src/stores/uiStore.ts`
  - `applyTheme()` 同步原生主题

同步上游后检查:

```bash
rg -n "nativeMaterialWindowOptionsForPlatform|vibrancy|backgroundMaterial|nativeTheme|appSetTheme|setTheme\\?" desktop/electron desktop/src
```

## 五、左侧 sidebar 行为

目标: 保留 A+BAY 侧边栏体验。

保留内容:

- sidebar 顶部标题区域可以拖拽窗口。
- 展开状态显示 `app-title.png`，折叠状态显示 `app-icon.png`。
- 移除上游或旧版本中的 GitHub 图标入口。
- 保留右键删除/项目组织等交互，注意不要把 drag region 覆盖到按钮上。
- sidebar 本体不要整块标记为 drag region，只给标题留 drag region，否则右键菜单和按钮可能失效。

重点文件:

- `desktop/src/components/layout/Sidebar.tsx`
- `desktop/src/components/layout/Sidebar.test.tsx`
- `desktop/src/theme/globals.css`

同步上游后检查:

```bash
rg -n "sidebar-title-region|data-desktop-drag-region|data-desktop-no-drag-region|GitHub|github" desktop/src/components/layout/Sidebar.tsx desktop/src/components/layout/Sidebar.test.tsx
```

## 六、顶部 TabBar 改为当前标题栏

目标: 顶部区域不再显示多个 tab，而是显示当前会话/页面标题，并且该区域可拖拽窗口。

实现方式:

- `desktop/src/components/layout/TabBar.tsx` 只渲染当前 active tab 标题。
- 不再渲染:
  - 多个 tab item
  - tab 滚动按钮
  - tab 关闭按钮
  - tab 拖动排序
  - tab 右键关闭菜单
- 标题区域设置 `data-desktop-drag-region`。
- 右侧工具按钮区域使用 `tab-bar-interactive`，保持 no-drag。
- 保留右侧工具:
  - Activity
  - Open project
  - Terminal
  - Workspace
  - Window controls

重点文件:

- `desktop/src/components/layout/TabBar.tsx`
- `desktop/src/components/layout/TabBar.test.tsx`
- `desktop/src/theme/globals.css`

同步上游后检查:

```bash
rg -n "tab-bar-title-region|TabItem|moveTab|closeTab|scrollIntoView|tab-bar-scroll-region" desktop/src/components/layout/TabBar.tsx desktop/src/components/layout/TabBar.test.tsx
```

`TabItem`、`moveTab`、`closeTab`、`tab-bar-scroll-region` 不应该重新出现在 A+BAY 的 `TabBar.tsx` 里，除非明确决定恢复多 tab。

## 七、右侧 Review 功能已移除

目标: 不保留早期尝试过的右侧 Review/Git Actions sidebar。

同步上游后如果出现右侧 Review 面板，默认移除，除非重新提出需求。

重点检查:

```bash
rg -n "Review|Git Actions|review changes|change review|right sidebar" desktop/src
```

## 八、Skills 上传安装

目标: 设置页 Skills 支持从本机导入 skill。

用户能力:

- 上传单个文件夹。
- 上传多个文件夹。
- 上传单个 zip。
- 上传多个 zip。
- zip 上传后自动解压。
- 安装位置为 `~/.claude/skills` 或 `CLAUDE_CONFIG_DIR/skills`。

实现方式:

- 前端设置页/SkillList 通过桌面文件对话框选择目录或 zip。
- `desktop/src/api/skills.ts` 调用 Electron host command:
  - command: `install_skills_from_paths`
  - args: `{ paths: string[] }`
- Electron 侧 `desktop/electron/services/skills.ts`:
  - 文件夹包含 `SKILL.md` 时按单个 skill 安装。
  - 文件夹不含 `SKILL.md` 时扫描子目录，每个含 `SKILL.md` 的子目录作为 skill。
  - zip 解压到临时目录后按同样规则安装。
  - `__MACOSX` 和隐藏目录跳过。
  - skill 名称做安全字符清洗。

重要: 上游同步后必须确认 Electron main 已接回 command switch:

```ts
case 'install_skills_from_paths':
  return installSkillsFromPaths(args ?? {})
```

并确认顶部有导入:

```ts
import { installSkillsFromPaths } from './services/skills'
```

重点文件:

- `desktop/electron/services/skills.ts`
- `desktop/electron/main.ts`
- `desktop/src/api/skills.ts`
- `desktop/src/components/skills/SkillList.tsx`
- `desktop/src/i18n/locales/*.ts`

同步上游后检查:

```bash
rg -n "install_skills_from_paths|installSkillsFromPaths|Add zip|addZips|chooseZips" desktop/electron desktop/src
```

## 九、Slash command HTML-like 标签显示

目标: 聊天内容中 `<command-message>`、`<command-name>`、`<command-args>` 等控制标签不要按普通 HTML 或裸文本难看显示。

保留内容:

- Assistant/消息渲染中应将 slash command metadata 渲染为可读块。
- 相关变更来自提交 `fix(desktop): render slash command metadata readably`。

重点文件通常在:

- `desktop/src/components/chat/*`
- `desktop/src/theme/globals.css`
- 对应 chat renderer 测试

同步上游后检查:

```bash
rg -n "command-message|command-name|command-args|slash command metadata" desktop/src src
```

## 十、A+BAY OAuth 与 provider 隔离

目标: OAuth/provider 配置写入 A+BAY 自己的目录，避免污染共享 Claude 配置。

保留内容:

- A+BAY OAuth service: `src/server/services/abayOAuthService.ts`
- API: `src/server/api/abay-oauth.ts`
- conversation env 注入应导入 `abayOAuthService`，不要回退到旧 `hahaOAuthService`。
- OpenAI/Grok/provider 配置优先使用 `~/.claude/claude-abay/*`。

重点文件:

- `src/server/services/conversationService.ts`
- `src/server/services/abayOAuthService.ts`
- `src/server/api/abay-oauth.ts`
- `src/server/services/providerService.ts`
- `src/utils/managedEnv.ts`

同步上游后检查:

```bash
rg -n "hahaOAuthService|abayOAuthService|claude-abay/oauth|claude-abay/settings|claude-abay/providers" src desktop
```

## 十一、Electron 发布与 GitHub Release

目标: 通过 GitHub Actions 发布 `aaronychu/claude-abay` 的 Electron 桌面端。

保留内容:

- Release workflow 使用 Electron/electron-builder，不回退到旧 Tauri release action。
- Release tag 格式为 `vX.Y.Z`，版本需和 `desktop/package.json` 对齐。
- Release body 来自 `release-notes/vX.Y.Z.md`。
- `desktop/package.json build.publish` 指向 `aaronychu/claude-abay`。
- macOS 签名/公证支持:
  - `MACOS_CERTIFICATE`
  - `MACOS_CERTIFICATE_PASSWORD`
  - `APPLE_ID`
  - `APPLE_APP_SPECIFIC_PASSWORD`
  - `APPLE_TEAM_ID`
- Windows 签名可选:
  - `WINDOWS_CERTIFICATE`
  - `WINDOWS_CERTIFICATE_PASSWORD`
- 没有签名密钥时允许 unsigned fallback，但 macOS 自动更新/Gatekeeper 体验会受影响。

重点文件:

- `.github/workflows/release-desktop.yml`
- `desktop/package.json`
- `scripts/release.ts`
- `scripts/pr/release-workflow.test.ts`
- `scripts/quality-gate/package-smoke/index.test.ts`
- `release-notes/v*.md`

发布流程:

```bash
bun run scripts/release.ts <version> --dry
bun run verify
bun run scripts/release.ts <version>
git push origin main --tags
```

如果只是本地 macOS 测试包:

```bash
cd desktop
SKIP_INSTALL=1 ./scripts/build-macos-arm64.sh
```

同步上游后检查:

```bash
rg -n "tauri-action|releaseAssetNamePattern|electron-builder|aaronychu|claude-abay|notarize_macos" .github desktop/package.json scripts/pr/release-workflow.test.ts
```

## 十二、构建与 sidecar 注意事项

目标: 桌面端 build 不因 adapter 可选依赖或 sidecar 扫描失败。

历史问题:

- `adapters/telegram` 依赖 `grammy`。
- `adapters/feishu` 依赖 `@larksuiteoapi/node-sdk`。
- 构建 sidecar 时如果 adapter 依赖没安装，会出现 `Could not resolve`。

处理方式:

- 触发 adapter 相关构建前确认对应依赖已安装。
- fresh checkout 后如改到 adapters，先执行:

```bash
cd adapters
bun install
```

重点文件:

- `desktop/scripts/build-sidecars.ts`
- `adapters/package.json`
- `adapters/*/index.ts`

## 十三、验证命令

小范围 UI 改动:

```bash
cd desktop
bun run test -- --run src/components/layout/Sidebar.test.tsx src/components/layout/TabBar.test.tsx src/stores/uiStore.test.ts
bun run lint
```

Electron/窗口/IPC 改动:

```bash
bun test desktop/electron/services/windows.test.ts desktop/electron/ipc/capabilities.test.ts
cd desktop
bun run test -- --run src/lib/desktopHost/electronHost.test.ts
bun run lint
```

Skills 上传安装改动:

```bash
bun test desktop/electron
cd desktop
bun run test -- --run src/components/skills/SkillList.test.tsx src/__tests__/skillsSettings.test.tsx
bun run lint
```

发布前:

```bash
bun run scripts/release.ts <version> --dry
bun run verify
```

## 十四、同步后人工检查清单

每次同步上游后按顺序检查:

1. `git status --short` 看冲突和被覆盖文件。
2. 检查品牌名没有回退到 `Claude Code Haha`。
3. 检查 `desktop/package.json` 的 `productName`、`appId`、`publish`。
4. 检查 `Sidebar.tsx` 使用 `app-title.png` / `app-icon.png`。
5. 检查 sidebar 顶部 drag region 不影响按钮和右键菜单。
6. 检查 `TabBar.tsx` 仍是单标题栏，不是多 tab 列表。
7. 检查 Electron 原生材质和主题同步 IPC 仍在。
8. 检查 `install_skills_from_paths` 从前端到 Electron main 全链路接通。
9. 检查右侧 Review/Git Actions 面板没有被上游重新带回。
10. 检查 `conversationService.ts` 使用 `abayOAuthService`。
11. 运行对应测试和 `cd desktop && bun run lint`。
12. 需要发布时再运行 release dry-run 和完整 verify。

## 十五、不要随手覆盖的文件

这些文件经常同时包含上游功能和 A+BAY 定制，同步时要手工合并:

- `desktop/src/theme/globals.css`
- `desktop/src/components/layout/Sidebar.tsx`
- `desktop/src/components/layout/TabBar.tsx`
- `desktop/src/pages/Settings.tsx`
- `desktop/src/components/chat/ChatInput.tsx`
- `desktop/electron/main.ts`
- `desktop/electron/services/windows.ts`
- `desktop/package.json`
- `.github/workflows/release-desktop.yml`
- `src/server/services/conversationService.ts`
- `src/server/services/providerService.ts`
- `src/utils/managedEnv.ts`

原则: 上游新功能可以合入，但 A+BAY 的品牌、数据隔离、桌面 UI、发布目标、native material 和 skill 上传链路默认保留。
