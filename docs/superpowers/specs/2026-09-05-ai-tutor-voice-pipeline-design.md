# AI Tutor 語音導師 — Hackathon MVP 設計

**日期**：2026-09-05
**狀態**：待人工覆核
**作者**：Brainstorming with user
**目標**：給 CP（Competitive Programming）初學者的 AI 學習平台 MVP，
聚焦於「讀題 → 與 AI Tutor 語音對話 → 學習回饋」核心體驗。

---

## 1. 範圍與非目標

### 在範圍內（In scope）

- 3-5 題硬編碼 CP 經典題（JSON），用 markdown 呈現題目與範例。
- 全雙工語音對話：使用者口頭提問，AI Tutor 口頭回答。
- Tutor 主動關心：閒置 30 秒主動問一句；開場白招呼。
- 中斷（Tutor 講話時使用者插嘴立即停）。
- 重新連線（網路瞬斷自動復原）。
- 匿名使用，sessionStorage 保存 transcript。

### 不在範圍內（Out of scope，**明確排除**）

- **程式碼編輯器**：不做。
- **Judge / 沙箱執行**：不做。
- **真實題目資料庫**：不做。題目硬編碼 JSON。
- **使用者登入 / Supabase Auth**：不做。sessionStorage only。
- **未來後端整合**：Futuremode backend 在 MVP 不被呼叫。
- **跨裝置 resume**：session resume 只在同瀏覽器有效。
- **多人房間 / SFU**：單瀏覽器單 session。
- **多語言介面**：先做繁體中文 UI；Tutor 支援中英文。
- **A/B 測試 / 分析**：不做。

---

## 2. 架構總覽

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser (Next.js Client)                  │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ ProblemView │  │ TutorPanel   │  │ AudioEngine       │  │
│  │ (left50%)   │  │ (right 50%)  │  │ • MediaStream │  │
│  │ • statement  │  │ • transcript │  │ • AudioWorklet    │  │
│  │ • examples   │  │ • tutor state│  │ • playback queue  │  │
│  └──────────────┘  └──────────────┘  └───────────────────┘  │
│                          │                                   │
│                          ▼ │
│              ┌──────────────────────┐                        │
│              │ VoiceClient (WS)     │                        │
│              └──────────────────────┘                        │
└──────────────────────────│──────────────────────────────────┘
                           │ wss://localhost:3000/api/voice
                           ▼
┌─────────────────────────────────────────────────────────────┐
│         Next.js 15 Route Handler (Node runtime)              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ VoiceSession (per WS connection)                       │  │
│  │ • state machine                                       │  │
│  │ • event bus + idle timer (30s)                        │  │
│  └────────────────────────────────────────────────────────┘  │
│ │              │              │                   │
│           ▼              ▼              ▼                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │ ScribeWS │  │ GPTStream │  │ TTSWS │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼ ┌──────────────────────────────┐
            │ External:                    │
            │ • api.elevenlabs.io (STT/TTS)│
            │ • api.openai.com (LLM)       │
            └──────────────────────────────┘
```

### 設計原則

- **單一 session 物件負責一個對話窗口**：`VoiceSession` 封裝全部狀態。
- **in-band control frames**：interruption、proactive trigger、state transitions 共用同一個 WebSocket。
- **server-side 為唯一可信狀態**：client 只渲染，不判斷。
- **fail soft**：外部 API 失敗時 session 進入 error 狀態，UI 顯示重試按鈕。

### 模組邊界

| 模組 | 位置 | 負責 |
|---|---|---|
| `AudioEngine` | `lib/voice/audio-engine.ts` | 麥克風擷取、播放、本地 VAD |
| `VoiceClient` | `lib/voice/voice-client.ts` | WebSocket 生命週期、訊息序列化 |
| `ProblemView` | `components/ProblemView.tsx` | 題目呈現（server component） |
| `TutorPanel` | `components/TutorPanel.tsx` | transcript 與狀態 UI（client component） |
| `VoiceRoot` | `components/VoiceRoot.tsx` | 組合 AudioEngine + VoiceClient + TutorPanel |
| `app/api/voice/route.ts` | server | WebSocket upgrade handler |
| `VoiceSession` | `lib/voice/voice-session.ts` | 編排 session |
| `ScribeWS` | `lib/voice/scribe-ws.ts` | ElevenLabs STT WebSocket client |
| `TTSWS` | `lib/voice/tts-ws.ts` | ElevenLabs TTS WebSocket client |
| `GPTStream` | `lib/voice/gpt-stream.ts` | OpenAI 串流 LLM |
| `ProactiveScheduler` | `lib/voice/proactive-scheduler.ts` | 閒置偵測、主動觸發 |
| `SentenceAccumulator` | `lib/voice/sentence-accumulator.ts` | GPT token 流切句 |

---

## 3. 元件細節

### 3.1 `AudioEngine`（client）

- `navigator.mediaDevices.getUserMedia({audio: {echoCancellation: true, noiseSuppression: true, sampleRate: 16000}})`。
- AudioContext + AudioWorklet processor `pcm-capture-processor` 切 100ms frames。
- 本地 VAD：RMS 能量閾值（環境噪音 baseline + 6dB），靜默 > 700ms 視為句子結束。
- 播放用 Web Audio `AudioBufferSourceNode` queue。
- `stopAllPlayback()` 支援中斷。

### 3.2 `VoiceClient`（client）

- 連線 `wss://<host>/api/voice`。
- Binary frames：100ms PCM Int16LE。
- JSON frames：見 §4.1。
- 自動 reconnect exponential backoff（1s → 2s → 4s → max 30s）。
- sessionId 持久化以支援 server-side resume。

### 3.3 React 結構

- `app/page.tsx`：server component，列出 3-5 題。
- `app/problem/[id]/page.tsx`：server component，讀 JSON。
- `components/ProblemView.tsx`：純呈現。
- `components/TutorPanel.tsx`：client，訂閱 VoiceClient。
- `components/VoiceRoot.tsx`：client，組裝所有語音邏輯，提供 React Context。

### 3.4 `app/api/voice/route.ts`

- `export const runtime = 'nodejs'`、`export const dynamic = 'force-dynamic'`。
- 用 Node.js `ws` 套件掛在 Next.js HTTP server 上（透過自訂 `server.ts`）。
- Path: `/api/voice`，query `?problemId=xxx`，缺則 close 4000。

### 3.5 `VoiceSession`（server）

狀態機：

```
idle ──start──> listening ──vad end──> thinking ──first tts──> speaking ▲ │                  │
                   │                          └──tool err──> error
                   │                                             │
                   └──────────── interrupt ◀───speaking──────────┘
                                          ▲ proactive trigger
```

訊息流（明確呼叫鏈）：

```
[audioChunk] → VoiceSession.onAudio()
                            │
                            ▼
                       ScribeWS.send()
                            │
              [ElevenLabs Scribe → transcript]
                            │ if is_partial === false
                            ▼
                  VoiceSession.onFinalTranscript()
                            │
                            ▼ state = 'thinking'
                  GPTStream.stream(messages)
                            │ each token
                            ▼
                  SentenceAccumulator.push(token)
                            │ complete sentence
                            ▼ state = 'speaking'
                  TTSWS.stream(sentence)
                            │
                            ▼
                  [TTS audio chunks → ws.send(binary)]
```

Interruption：

```
[interrupt frame]
 → state = 'listening'
  → GPTStream.cancel() // AbortController.abort
  → SentenceAccumulator.reset()  // 丟棄累積中的半句
  → TTSWS.reconnect()            // 關閉再開，確保下個 frame 不會送舊音
  → ws.send({type:'tts_clear'})
  → AudioEngine.stopAllPlayback()  // 透過已送出的 ws frame 觸發 client
```

Messages context 管理：
- 完整 transcript 保留為 `messages: ChatMessage[]`。
- 送給 GPTStream 時套用 sliding window：保留 system + 最近 20 條 user/tutor（避免 context overflow）。
- session resume 時保留最近 20 條作為初始 context。

### 3.6 `ScribeWS`（ElevenLabs STT）

- 端點：`wss://api.elevenlabs.io/v1/speech-to-text/stream`
- query: `model_id=scribe_v1&language_code=zh&xi-api-key=...`
- 上行 binary PCM；下行 JSON transcript（`is_partial` flag）。

### 3.7 `TTSWS`（ElevenLabs TTS）

- 端點：`wss://api.elevenlabs.io/v1/text-to-speech/<voice_id>/stream-input`
- 上行 JSON `{text, voice_settings, xi_api_key}`。
- 下行 binary audio + JSON 控制。

### 3.8 `GPTStream`（OpenAI LLM）

- Model：`gpt-4o`。
- 串流 + `AbortController`。
- System prompt：CP 初學者導師、口語化、< 50 字、給提示不給解答。
- 不啟用 tools。

### 3.9 `ProactiveScheduler`（server）

- `IDLE_THRESHOLD_MS = 30_000`。
- `GREETING_DELAY_MS = 5_000`。
- 連續主動觸發上限 2 次，之後靜默。
- 觸發時呼叫 GPTStream 帶特殊 prompt。

### 3.10 `SentenceAccumulator`

- 收到 GPT token 累積。
- 遇到 `。！？.!?\n` 或累積 > 80 字強制切句。
- 完整句子送 TTS。

### 3.11 靜態題目（`lib/problems/index.ts`）

```ts
export type Problem = {
  id: string
  title: string
  difficulty: 'easy' | 'medium' | 'hard'
  statement: string         // markdown
  examples: { input: string, output: string, explanation?: string }[]
  hints: string[]           // Tutor 可參考的提示層級
}

export const problems: Problem[] = [
  { id: 'two-sum', title: 'Two Sum', difficulty: 'easy', ... },
  { id: 'binary-search', ... },
  { id: 'valid-parentheses', ... },
]
```

### 3.12 環境變數

```
ELEVENLABS_API_KEY=...     # server-side only
OPENAI_API_KEY=...         # server-side only
NEXT_PUBLIC_WS_URL=ws://localhost:3000/api/voice
```

金鑰**不得**進 `NEXT_PUBLIC_*`，不得回傳到 client API response。

---

## 4. 資料流與訊息協定

### 4.1 WebSocket 訊息協定

單一連線，binary 與 JSON 共存。

**Binary frames**：

| 方向 | 內容 | 大小 | 頻率 |
|---|---|---|---|
| Client → Server | PCM Int16LE, 16kHz, mono | 100ms = 3200 bytes | 每 100ms |
| Server → Client | PCM Int16LE, 24kHz, mono（TTS） | ~200ms | 串流 |

**JSON frames**：

```ts
// Client → Server
| { type: 'session_start', problemId: string, sessionId?: string }
| { type: 'interrupt' }
| { type: 'mic_toggle', enabled: boolean }
| { type: 'session_end' }

// Server → Client
| { type: 'session_ready', sessionId: string }
| { type: 'state', state: 'idle'|'listening'|'thinking'|'speaking'|'error' }
| { type: 'transcript', role: 'user'|'tutor', text: string, partial: boolean }
| { type: 'tts_text', text: string }
| { type: 'tts_clear' }
| { type: 'proactive', reason: 'idle'|'greeting'|'user_stuck' }
| { type: 'error', code: string, message: string, recoverable: boolean }
| { type: 'session_resumed' }
```

### 4.2 Session 生命週期

```
Client                          Server
 │                                   │
 │──── session_start(problemId) ────>│
 │                                   │── 開 ScribeWS
 │<──── session_ready(sessionId) ────│── 開 TTSWS
 │<──── state: listening ────────────│
 │──── binary PCM chunks ──────────>│── ScribeWS.send
 │<──── transcript(user, partial) ──│
 │<──── transcript(user, final) ────│   ── 偵測 VAD end
 │<──── state: thinking ────────────│── GPTStream.stream
 │<──── transcript(tutor, partial) ─│── TTS streaming
 │<──── tts_text ───────────────────│
 │<──── binary TTS audio ──────────│
 │<──── state: speaking ───────────│
 │──── interrupt ────────────────>│── state: listening
 │                                   │   cancel GPT + TTS
 │<──── tts_clear ──────────────────│
 │── loop ──│
 │──── session_end ───────────────>│── 清理
```

### 4.3 Interruption 詳細時間軸

| t (ms) | Client | Server |
|---|---|---|
| 0 | AudioWorklet 偵測 RMS > 門檻 | (Tutor 正在輸出) |
| 10 | 發送 `interrupt` | |
| 20 | 收到 frame | 取消 GPTStream（AbortController.abort） |
| 25 | | 關閉 TTSWS，重開 |
| 30 | | 廣播 `tts_clear` + `state: listening` |
| 35 | 收到 `tts_clear` | |
| 40 | `AudioEngine.stopAllPlayback()` | |
| 50 | UI 清空，回 listening | |

**目標**：從偵測到完全靜音 < 100ms。

### 4.4 Proactive 觸發

事件來源：
1. **閒置**：listening > 30 秒 → 主動一句。
2. **開場白**：session_ready 後 5 秒 → 招呼。
3. **多次中斷**：最近 3 次都是中斷 → 換方式問。

實作：`ProactiveScheduler` 維護 `idleTimer` 與連續觸發計數。
最多連續 2 次主動觸發，之後靜默直到使用者重新說話。

### 4.5 Reconnection / Session Resume

- Client 偵測 WS close（非主動）→ reconnect with backoff。
- Reconnect 帶 `sessionId`（sessionStorage）。
- Server 嘗試 resume：保留最近 20 條訊息，重開 ScribeWS / TTSWS。
- Resume 失敗則建新 session，UI 顯示「對話已重置」。
- 不支援跨裝置 resume。

### 4.6 錯誤處理矩陣

| 錯誤 | 偵測點 | 處理 |
|---|---|---|
| 麥克風權限拒絕 | `getUserMedia` reject | UI 顯示訊息，不進入 session |
| Scribe WS 斷線 | close event | 重連 3 次，失敗 → session error |
| TTS WS 斷線 | close event | 重連 1 次（靜默），斷在 speaking 中則 tts_clear |
| OpenAI 429/500 | stream error | exponential backoff 1 次，UI 顯示轉圈 |
| OpenAI 401 | auth error | session error，不可恢復 |
| 音訊裝置失效 | MediaStream `ended` | UI 提示「麥克風被拔除」 |
| Server crash | WS close 1011 | client reconnect + resume |

Session state `error` 顯示重試按鈕，按下後 `session_end` + 重新 `session_start`。

---

## 5. 測試策略

### 5.1 層次化測試

| 層級 | 範圍 | 工具 | 投入 |
|---|---|---|---|
| 單元 | state machine、scheduler、protocol、prompt builder、sentence accumulator | Vitest | 高 |
| 整合 | WS handler + mock 外部 API | Vitest + mock ws | 中 |
| E2E | **不做**，全手動驗證 | — | — |
| 手動 | 語音延遲、interruption 感、reconnect | 瀏覽器 + 錄影 | 高 |

### 5.2 單元測試必做清單

- `state-machine.test.ts`：合法 / 非法轉換
- `proactive-scheduler.test.ts`：計時器、上限
- `message-protocol.test.ts`：JSON round-trip、binary/JSON 分類
- `prompt-builder.test.ts`：system prompt 組裝、主動 vs 一般
- `sentence-accumulator.test.ts`：中英文標點、80 字上限

### 5.3 整合測試

`tests/integration/voice-session.test.ts`，mock 三個外部 client：

- happy path：chunk → transcript → thinking → speaking
- interruption：speaking → interrupt → listening
- proactive：fake timer 觸發主動
- error：OpenAI 401 → session error

### 5.4 手動驗證清單（demo 前必跑）

- [ ] 首頁顯示 3 題
- [ ] 進題目頁，按麥克風，瀏覽器詢問權限
- [ ] 允許後 state: listening
- [ ] 說一句話 transcript 顯示（partial → final）
- [ ] Tutor 回應（first-audio < 1500ms）
- [ ] Tutor 說話時插嘴，立即停（< 200ms）
- [ ] 30 秒沒說話，Tutor 主動問
- [ ] 切換 WiFi，WS 自動 reconnect
- [ ] 切換題目，session 重置

### 5.5 驗證證據（`definition-of-done.md`）

每張任務卡完成需附：
- `pnpm typecheck`、`pnpm lint`、`pnpm test`、`pnpm build` 結果
- `pnpm test --coverage` 摘要（核心 >80%）
- 手動 demo 螢幕錄影或截圖
- 殘留風險清單

### 5.6 已知取捨

- **不寫 E2E**：Playwright 設定成本過高。
- **不寫真實外部 API 整合測試**：需 API key 與花費；mock 即可。
- **僅 Chrome 最新版**：Firefox/Safari 列為已知限制。

---

## 6. 部署

MVP **僅本地 Docker 開發**（依使用者決定）。production 部署方案留待後續決定，
不在本 spec 範圍。

本地 docker-compose 規劃（於實作計畫階段最終定案）：

- `web` 服務：Next.js production build，port 3000。
- volumes：`.env.local` 注入金鑰（**不入 image**）。
- 不需 database 服務（sessionStorage only）。

部署目標決策延後：見 §8 開放問題第 4 點。

---

## 7. 高風險區與審查

依 `ai/process/review-gates.md`，本專案為高風險（涉及外部付費 API、瀏覽器麥克風權限、即時音訊處理），需觸發：

- **架構審查**（architect 子代理）：確認模組邊界、狀態機正確性。
- **安全性審查**（security-reviewer 子代理）：API 金鑰保護、麥克風權限、CORS。
- **測試審查**（test-engineer 子代理）：覆蓋率、手動清單完整性。

---

## 8. 開放問題（移交實作計畫前需決定）

1. **ElevenLabs TTS 語音**：先用預設 `Rachel`（英文）或中文 `Bella`，需 demo 前實測選定。
2. **GPT-4o vs GPT-4o-mini**：成本差 30x。預設 GPT-4o，demo 視成本壓力決定是否降級。
3. **`first-audio < 1500ms`**：是否需要嚴格到 < 1000ms（取決於 ElevenLabs TTS streaming chunk 行為，需 demo 前實測）。
4. **部署目標**：本地 Docker 已定，**production 部署**（Vercel / Railway / Fly.io）待 demo 後決定。spec 僅涵蓋本地 dev 環境。

---

## 9. 變更紀錄

| 日期 | 變更 | 原因 |
|---|---|---|
| 2026-09-05 | 初版 | Brainstorming 結果 |