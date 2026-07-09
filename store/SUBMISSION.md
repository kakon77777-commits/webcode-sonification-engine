# Chrome Web Store 上架指南 — WSE v0.3.0

一步一步照做即可。所有可直接複製的文字都在 `listing-en.md` / `listing-zh.md`；圖片在 `store/assets/`；上傳包是 `store/wse-v0.3.0-store.zip`。

---

## 0. 事前確認

- [x] 開發者帳號已註冊並付費（$5）
- [x] 隱私政策 URL 上線：https://wse.evemisstechnology.com/privacy/
- [x] 上傳 zip：`store/wse-v0.3.0-store.zip`（＝ `dist/` 的內容，manifest v0.3.0）

## 1. 建立項目

1. 開 https://chrome.google.com/webstore/devconsole
2. **+ New item** → 上傳 `wse-v0.3.0-store.zip`

## 2. Store listing 分頁

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

## 3. Privacy 分頁（審核重點，逐字可用）

**Single purpose description:**

> Converts the structure of the webpage in the current tab (DOM statistics, sampled computed styles, layout geometry) into locally synthesized generative music, with an optional visualization of that process. All processing is local; nothing is transmitted.

**Permission justifications:**

- `activeTab`:
  > Grants temporary access to the current tab only when the user clicks the extension action, so the page's structure can be analyzed on demand. The extension requests no persistent host permissions.
- `scripting`:
  > Used together with activeTab to inject the analysis content script into the current tab after an explicit user click. The script computes structural statistics (tag counts, depths, sampled styles, geometry) and never reads form values or editable content.
- `storage`:
  > Stores the user's preferences (style, mode, tuning sliders) and the most recently generated musical score locally, so the visualizer tab can play it. No page content and no browsing history are stored.
- `offscreen`:
  > Creates an offscreen document with the AUDIO_PLAYBACK reason to host Web Audio playback, because MV3 service workers cannot play audio. It plays the generated score and is closed when playback stops.

**Are you using remote code?** → **No**（所有程式碼都打包在擴充內，無 CDN、無 eval）

**Data usage（勾選）:**

- 所有「Does your extension collect or use…」問題 → **一律 No / 不收集**
- 三個 certification checkbox（不販售資料、不用於不相關用途、不用於信用評估）→ 全部勾選

**Privacy policy URL:** `https://wse.evemisstechnology.com/privacy/`

## 4. Distribution 分頁

- Visibility: **Public**
- Distribution: 所有國家/地區（預設全選）
- Pricing: Free（預設）

## 5. 送出

**Submit for review**。首次審核通常數小時到數天。因為權限極少（無 host permissions）、無遠端程式碼、無資料收集，屬於低風險快速通道。

## 6. 審核通過後

1. 把商店連結加到官網（「Get the extension」區）與 README。
2. GitHub repo About 欄位加上商店連結。
3. （告訴 Claude 一聲，我來改。）

## 常見退件原因（我們都已避開）

- ~~權限過寬~~ → 只有 activeTab/scripting/storage/offscreen，無 host permissions
- ~~描述與功能不符~~ → 描述照實寫
- ~~缺隱私政策~~ → 已上線
- ~~遠端程式碼~~ → 無
- ~~截圖尺寸錯誤~~ → 已處理成 1280×800
