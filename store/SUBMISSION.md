# Chrome Web Store 上架指南 — WSE

v0.3.0 已經送審通過、上架。這份指南現在涵蓋兩種情境：**(A) 更新既有上架項目到 v0.4.0**（你現在要做的），以及下面保留的 **(B) 全新建立項目**流程（供未來參考，例如換帳號或重新提交）。

所有可直接複製的文字都在 `listing-en.md` / `listing-zh.md`；圖片在 `store/assets/`；上傳包會由 build 產生，檔名帶版本號（例如 `wse-v0.4.0-store.zip`，需重新壓縮 `dist/`）。

---

## A. 更新到 v0.4.0（既有項目）

v0.4.0 新增 Scroll Mode、Live Mode、WAV 匯出——**權限完全沒變**（還是 activeTab/scripting/storage/offscreen），所以審核風險跟第一次一樣低，通常會走加速通道。

1. 確認 `dist/` 是最新的：`npm run build`
2. 打包：把 `dist/` 內容壓成 zip（例如 `store/wse-v0.4.0-store.zip`）
3. 開 https://chrome.google.com/webstore/devconsole
4. 點進既有的 WebCode Sonification Engine 項目
5. 左側 **Package** 分頁 → 上傳新 zip（manifest 內 version 已是 0.4.0，Chrome 會自動辨識版本遞增）
6. （選配但建議）**Store listing** 分頁 → Description 換成更新後的 `listing-en.md`（已加入 Scroll/Live/WAV 段落），中文版同步換 `listing-zh.md`
7. Privacy 分頁：**不需要改**，因為權限沒變，逐字答案跟下面 §B.3 完全一樣，Chrome 通常不會重新要求填寫
8. **Submit for review**

## 6. 審核通過後

1. 把商店連結加到官網（「Get the extension」區）與 README（若還沒加）。
2. GitHub repo About 欄位加上商店連結。
3. （告訴 Claude 一聲，我來改。）

---

## B. 全新建立項目（第一次上架時的完整流程，保留供未來參考）

### B.0 事前確認

- [x] 開發者帳號已註冊並付費（$5）
- [x] 隱私政策 URL 上線：https://wse.evemisstechnology.com/privacy/
- [x] 上傳 zip：`dist/` 的內容重新壓縮（manifest version 以當時為準）

### B.1 建立項目

1. 開 https://chrome.google.com/webstore/devconsole
2. **+ New item** → 上傳打包好的 zip

### B.2 Store listing 分頁

| 欄位 | 填入 |
| --- | --- |
| Language | English (預設) |
| Title | `WebCode Sonification Engine`（自動帶入 manifest） |
| Summary | 自動帶入 manifest description；可改成 listing-en.md 的 Summary |
| Description | 貼 `listing-en.md` 的 Detailed description 全文 |
| Category | **Fun** |
| Store icon (128×128) | 上傳 `assets/store-icon-128.png`（符合指南：圖案 96×96 + 四周 16px 透明邊距） |
| Screenshots | 依序上傳 `assets/screenshot-1-visualizer-1280x800.png`、`assets/screenshot-2-popup-1280x800.png` |
| Small promo tile (440×280) | `assets/promo-tile-440x280.png` |
| Marquee (1400×560) | `assets/marquee-1400x560.png`（選填，有就放） |
| Official URL | 選 `evemisstechnology.com`（需先在 dashboard 驗證網域）或留空 |
| Homepage URL | `https://wse.evemisstechnology.com/` |
| Support URL | `https://github.com/kakon77777-commits/webcode-sonification-engine/issues` |

（選配）左側 **Add language → Chinese (Traditional)**，貼 `listing-zh.md` 內容。

### B.3 Privacy 分頁（審核重點，逐字可用）

**Single purpose description:**

> Converts the structure of the webpage in the current tab (DOM statistics, sampled computed styles, layout geometry) into locally synthesized generative music. Playback can optionally be driven by the page's scroll position or by its live DOM mutations instead of a fixed clock, and the result can be visualized or exported as a WAV file. All processing is local; nothing is transmitted.

**Permission justifications:**

- `activeTab`:
  > Grants temporary access to the current tab only when the user clicks the extension action, so the page's structure can be analyzed on demand. The extension requests no persistent host permissions.
- `scripting`:
  > Used together with activeTab to inject the analysis content script into the current tab after an explicit user click, and (only when the user selects Scroll or Live playback mode) a small script that reports scroll position or DOM-mutation tag names — never element content, attribute values, or form data.
- `storage`:
  > Stores the user's preferences (style, mode, tuning sliders) and the most recently generated musical score locally, so the visualizer tab can play it. No page content and no browsing history are stored.
- `offscreen`:
  > Creates an offscreen document with the AUDIO_PLAYBACK reason to host Web Audio playback, because MV3 service workers cannot play audio. It plays the generated score and is closed when playback stops.

**Are you using remote code?** → **No**（所有程式碼都打包在擴充內，無 CDN、無 eval）

**Data usage（勾選）:**

- 所有「Does your extension collect or use…」問題 → **一律 No / 不收集**
- 三個 certification checkbox（不販售資料、不用於不相關用途、不用於信用評估）→ 全部勾選

**Privacy policy URL:** `https://wse.evemisstechnology.com/privacy/`

### B.4 Distribution 分頁

- Visibility: **Public**
- Distribution: 所有國家/地區（預設全選）
- Pricing: Free（預設）

### B.5 送出

**Submit for review**。首次審核通常數小時到數天。因為權限極少（無 host permissions）、無遠端程式碼、無資料收集，屬於低風險快速通道。

### 常見退件原因（我們都已避開）

- ~~權限過寬~~ → 只有 activeTab/scripting/storage/offscreen，無 host permissions
- ~~描述與功能不符~~ → 描述照實寫
- ~~缺隱私政策~~ → 已上線
- ~~遠端程式碼~~ → 無
- ~~截圖尺寸錯誤~~ → 已處理成 1280×800
