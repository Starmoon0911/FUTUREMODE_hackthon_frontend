# 設計系統（Design System）

由 Epic 0「專案設置」的「UI 設計系統」User Story 分五階段（框架 → 風格 → design token → 元件庫 → 版面）逐步填寫。**這份文件是後續所有功能 Epic 做 UI 時的單一事實來源**：任何前端任務開工前都要先讀它，能用既有 token／元件就必須用；缺的元件要照既有風格補做並登記回這裡（見 `ai/skills/project-kickoff.md` 步驟 6 與 `ai/skills/ui-mockup-gate.md`）。

狀態：**MVP v0 已上線**（首次落地：code-editor 與 design-system 任務，2026-09-05）。完整風格定稿（S2 風格 tile）與 S5 介面 mockup 還沒跑完，先以 `app/globals.css` 的實際 token 為準。

## S1 底層框架

- UI 框架：**React 19 + Next.js 15 App Router**（typedRoutes 啟用）
- 元件庫策略：**自建**，以 `app/globals.css` 的 BEM 風格 utility class 為主；外掛僅 `@monaco-editor/react`（編輯器）。
- 樣式方案：**CSS 自訂屬性（CSS variables）** + 純 CSS，沒有 Tailwind / CSS-in-JS / CSS Modules。
- 選定理由：MVP 範圍、無需 SSR 動態主題、token 直接來自 CSS variables 可在 `prefers-color-scheme: dark` 切換。減少依賴、bundle 最小。
- 人工核准：2026-09-05（hackathon MVP 範圍下的「夠用即可」決策）

## S2 風格方向

- 選定的 style tile：**中性灰 + 藍色 accent**（最小可辨識風格）
- 色彩情緒：冷靜、聚焦、教學場景（不喧賓奪主）
- 字體個性：sans-serif 系統字 + monospace（Noto Sans TC / SF Mono 等同族 fallback）
- 圓角／陰影傾向：圓角中等（6–8px），陰影保守（低 opacity）
- 密度：舒適
- 亮／暗模式：**雙模式**（`@media (prefers-color-scheme: dark)` 切換；尚未做手動切換器）
- 參考產品：GitHub / Vercel Dashboard / Linear（簡潔、文件／編輯器導向）
- 人工核准：待補（首版是開發者依 MVP 範圍自訂，非設計師定稿；下次設計師 review 時補登）

## S3 Design Token 清單

所有 token 都在 `app/globals.css` 的 `:root` 區段宣告；暗色模式覆寫在 `@media (prefers-color-scheme: dark)`。**修改 token 必須同步改檔案本身，不要在元件內聯覆寫。**

### Primitive Token

| 類別 | Token | 值（亮） | 暗色 | 備註 |
|---|---|---|---|---|
| 色彩 / 背景 | `--color-bg` | `#fafafa` | `#09090b` | 頁面底色 |
| 色彩 / 表面 | `--color-surface` | `#ffffff` | `#18181b` | 卡片、面板、header |
| 色彩 / 表面 muted | `--color-surface-muted` | `#f4f4f5` | `#27272a` | toolbar、panel header |
| 色彩 / 邊框 | `--color-border` | `#e5e5e5` | `#27272a` | 預設分隔線 |
| 色彩 / 邊框粗 | `--color-border-strong` | `#d4d4d8` | `#3f3f46` | 輸入框、卡片懸停態 |
| 色彩 / 文字 | `--color-text` | `#18181b` | `#fafafa` | 標題、內文 |
| 色彩 / 文字 muted | `--color-text-muted` | `#71717a` | `#a1a1aa` | 副標、metadata |
| 色彩 / 文字 subtle | `--color-text-subtle` | `#a1a1aa` | `#71717a` | 提示、placeholder |
| 色彩 / accent | `--color-accent` | `#2563eb` | `#3b82f6` | 主要動作、連結 |
| 色彩 / accent hover | `--color-accent-hover` | `#1d4ed8` | `#60a5fa` | 互動態 |
| 色彩 / accent fg | `--color-accent-fg` | `#ffffff` | `#ffffff` | accent 上的文字 |
| 色彩 / danger | `--color-danger` | `#dc2626` | — | 錯誤訊息（未做暗色覆寫） |
| 色彩 / success | `--color-success` | `#16a34a` | — | 成功訊息 |
| 色彩 / warning | `--color-warning` | `#d97706` | — | 警告 |
| 色彩 / badge easy | (n/a) | `#dcfce7` / `#166534` | — | 直接寫死於 `.badge--easy` |
| 色彩 / badge medium | (n/a) | `#fef3c7` / `#92400e` | — | 直接寫死於 `.badge--medium` |
| 色彩 / badge hard | (n/a) | `#fee2e2` / `#991b1b` | — | 直接寫死於 `.badge--hard` |
| 字級 | `--text-xs` | `12px` | — | 註腳、badge |
| 字級 | `--text-sm` | `14px` | — | toolbar、副標 |
| 字級 | `--text-base` | `16px` | — | 內文 |
| 字級 | `--text-lg` | `18px` | — | 卡片標題 |
| 字級 | `--text-xl` | `20px` | — | h3 |
| 字級 | `--text-2xl` | `24px` | — | h2 |
| 字級 | `--text-3xl` | `30px` | — | h1 |
| 字重／行高 | `--leading-tight` | `1.25` | — | 標題 |
| 字重／行高 | `--leading-normal` | `1.5` | — | 內文 |
| 字重／行高 | `--leading-relaxed` | `1.7` | — | 散文（prose） |
| 間距 | `--space-1` | `4px` | — | 4px base scale |
| 間距 | `--space-2` | `8px` | — | |
| 間距 | `--space-3` | `12px` | — | |
| 間距 | `--space-4` | `16px` | — | |
| 間距 | `--space-5` | `20px` | — | |
| 間距 | `--space-6` | `24px` | — | |
| 間距 | `--space-8` | `32px` | — | |
| 間距 | `--space-10` | `40px` | — | |
| 間距 | `--space-12` | `48px` | — | |
| 間距 | `--space-16` | `64px` | — | |
| 圓角 | `--radius-sm` | `4px` | — | badge、tag |
| 圓角 | `--radius-md` | `6px` | — | button、input |
| 圓角 | `--radius-lg` | `8px` | — | card、panel |
| 圓角 | `--radius-xl` | `12px` | — | 大型容器（保留，尚未使用） |
| 陰影 | `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.04)` | — | 細微浮起 |
| 陰影 | `--shadow-md` | `0 4px 12px rgba(0,0,0,0.06)` | — | 卡片 hover |
| 陰影 | `--shadow-lg` | `0 12px 32px rgba(0,0,0,0.08)` | — | modal（保留，尚未使用） |
| 佈局 | `--max-content-width` | `1280px` | — | home 容器 |
| 佈局 | `--header-height` | `56px` | — | app-header |
| 佈局 | `--editor-min-height` | `320px` | — | CodeEditor panel |
| 動效 | `--transition-fast` | `120ms ease` | — | hover、focus |
| 動效 | `--transition-base` | `200ms ease` | — | 較大轉場（保留，尚未使用） |

z-index scale：尚未建立。請勿在元件內聯寫死 `z-index` 數值；新需求先在這裡登記。

### Semantic Token

| Token | 對應 primitive | 用途 |
|---|---|---|
| 主動作 | `--color-accent` + `--color-accent-fg` | 連結、主要按鈕 |
| 次要動作 | `--color-surface` + `--color-border-strong` | 次要按鈕、輸入框 |
| 錯誤 | `--color-danger` | 錯誤訊息、錯誤邊框 |
| 頁面 padding | `--space-6` (水平), `--space-8` (垂直) | home |
| 面板 padding | `--space-5` | problem-grid__panel-body |
| Header padding | `--space-6` 水平 | app-header |

### 實際 token 檔位置

- 專案內真實 token 檔路徑：`app/globals.css`（CSS 自訂屬性，無需 build step）
- 人工核准：2026-09-05（first-pass MVP）

## S4 元件庫 Inventory

| 元件 | 狀態 | 涵蓋狀態 | 用到的 token | 檔案位置 | 來源階段 |
|---|---|---|---|---|---|
| AppHeader | ✅ 上線 | 預設（標題 + 返回連結） | `--color-surface`, `--color-border`, `--color-text`, `--space-6`, `--header-height` | `app/problem/[id]/page.tsx`（內聯 className） | code-editor 任務 |
| AppShell | ✅ 上線 | flex column 滿版 | `--color-bg` | 同上 | code-editor 任務 |
| ProblemCard | ✅ 上線 | 預設、hover | `--color-surface`, `--color-border`, `--color-accent`, `--shadow-md`, `--radius-lg`, `--space-5` | `app/page.tsx` + `app/globals.css` | code-editor 任務 |
| ProblemList | ✅ 上線 | grid auto-fill | `--space-4` | 同上 | code-editor 任務 |
| ProblemGrid (3-zone) | ✅ 上線 | 桌面 3 欄、行動單欄 | `--color-surface`, `--color-border`, `--header-height` | `app/globals.css` | code-editor 任務 |
| PanelHeader | ✅ 上線 | 預設（uppercase、muted） | `--color-surface-muted`, `--color-text-muted`, `--space-3`, `--space-5` | `app/globals.css` | code-editor 任務 |
| ProblemView | ✅ 上線 | 預設（prose 樣式） | `--leading-relaxed`, `--color-text`, `--color-border` | `components/ProblemView.tsx` | Task 3 + code-editor 任務 |
| Badge | ✅ 上線 | easy / medium / hard | `--radius-sm`, `--space-2`, badge 專屬色票 | `app/globals.css` | code-editor 任務 |
| Button (.btn, .btn--primary, .btn--secondary) | 🟡 預留 | 預設、hover | `--color-accent`, `--color-surface`, `--radius-md` | `app/globals.css` | code-editor 任務（尚未在任何頁面使用） |
| CodeEditor | ✅ 上線 | 預設、語言切換、theme 自動、reset on problem change | `--color-surface-muted`, `--color-border`, `--color-text`, `--font-mono` | `components/CodeEditor.tsx` + `app/globals.css` | code-editor 任務 |
| TutorPanel | ⏳ 待做 | 規劃中 | — | `app/problem/[id]/page.tsx` 第 35 行 `id="tutor-slot"` 為 Task 18 預留 | Task 18 |
| Input | ⏳ 待做 | 預設、focus、disabled、error | `--color-border-strong`, `--color-accent`, `--radius-md` | — | 後續需求 |
| Toast/Alert | ⏳ 待做 | info / success / warning / error | `--color-accent` / `--color-success` / `--color-warning` / `--color-danger` | — | 後續需求 |
| Modal/Dialog | ⏳ 待做 | 預設、open、close | `--color-bg` (overlay), `--shadow-lg`, `--radius-xl` | — | 後續需求 |

### CodeEditor 細節

- 包裝 `@monaco-editor/react` 4.7，dynamic import + `ssr: false`。
- 支援 `language`、`allowedLanguages`、`defaultLanguage`、`starters`、`resetKey`、`onChange`、`onLanguageChange` props。
- 主題自動偵測 `prefers-color-scheme: dark`，可由 `theme` prop 覆寫。
- 工具列顯示語言 label / 切換器（picker 僅在 `allowedLanguages.length > 1` 時顯示）+ 字元數。
- 切換語言時自動載入該語言對應的 starter（避免在 Python 編輯器看到 Java boilerplate）。
- 切換問題時（`resetKey` 改變）自動重置為新問題的 starter。

### 設計系統債務（待辦）

- z-index scale 尚未定義
- 暗色模式覆寫不完整（`--color-danger/success/warning` 與 badge 色票未做暗色變體）
- Typography 還沒有 font-display swap 或 web font 設定（目前全用系統字）
- 沒有 icon system（目前用 emoji 作 placeholder）
- 沒有 breakpoint design rationale（960px 是經驗值，需要設計師覆核）

## S5 各介面版面

| 介面／使用者端 | 選定版型 | Mockup 決策紀錄 | 人工核准 |
|---|---|---|---|
| `/`（首頁） | Hero + 3-card grid | 待補（需要 mockup 決策文件） | 待補 |
| `/problem/[id]` | 3-zone 桌面 grid（題目｜編輯器｜導師）；行動單欄 | 待補 | 待補 |

Mockup 決策文件（`ai/artifacts/<Epic>/mockup-decision-*.md`）目前尚未建立；S5 為骨架，待後續補做。
