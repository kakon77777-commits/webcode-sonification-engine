# Chrome Web Store 上架文案 — 中文（繁體）(後台「新增語言 → 中文 (繁體)」時貼上)

## 名稱

WebCode Sonification Engine 網頁代碼音樂化引擎

（若超過 45 字元限制，改用：WebCode Sonification Engine）

## 簡短說明（132 字元內）

聽見任何網頁。把網頁結構變成可重現的生成式音樂——全程本機運算、確定性生成、開放原始碼。

## 詳細說明

每一個網頁本來就有結構。我們只是讓你聽見它。

WebCode Sonification Engine（WSE）把你正在閱讀的網頁結構，變成一首 30–90 秒的生成式音樂——在瀏覽器裡即時合成，素材只有網頁本身。

點一下「Analyze & Play」，WSE 讀取目前分頁的 DOM 結構、抽樣 CSS 與版面幾何，然後作出一首屬於這個頁面的曲子：

🎼 確定性的聲音身份
種子是 Hash(CanonicalURL, StructuralFingerprint)。同一個網頁結構永遠生成同一首音樂——每個網站都有自己的聲音指紋。網站改版，音樂也會跟著改變。按「Regenerate」可以在保留網站身份的前提下生成變奏。

🏛️ 結構決定編制
文字為主的部落格由鍵盤與弦樂主奏；佈滿按鈕的儀表板變得節奏感十足；圖片牆會響起鐘聲；連結密集的頁面琶音繁忙；DOM 越深音域越寬；深色配色走小調、亮色走大調。七種音階、Euclidean 節奏簽名，曲式（前奏–A–B–A'–尾奏）由 header、sections、footer 推導。

👁️ 可視化——看見程式碼變成音樂（v0.3 新功能）
按「Analyze & Visualize」開啟全頁視覺化：網頁的標籤像字幕一樣流過，「驅動那個音符的標籤」在發聲瞬間發光——連結在琶音時閃、圖片在鐘聲時閃、按鈕在打擊時閃——下方的鋼琴捲軸樂譜隨播放頭持續前進。誠實的溯源：每個音符都知道自己來自哪一層結構。

🎛️ 自訂
五種風格（Ambient、Piano、Electronic、Orchestral、Eastern 東方）、三種模式（Hybrid、Musical、Analytical），以及節奏、密度、亮度、殘響四支滑桿。18 種合成樂器，包含蕭、笛、Karplus-Strong 吉他與太鼓——不需下載音色庫，全部即時 Web Audio 合成。

💡 解釋模式
「為什麼這個網頁聽起來是這樣？」——彈出視窗直接告訴你是哪些頁面特徵決定了速度、調性、音階與各個聲部。

🔒 預設隱私
沒有伺服器、沒有遙測、不需帳號。只有在你點擊時才分析、只分析目前分頁。絕不讀取表單值與可編輯內容；網址的 query string 不會進入運算。你瀏覽的內容永遠不會離開你的電腦。
隱私政策：https://wse.evemisstechnology.com/privacy/

📖 開放原始碼（Apache-2.0）
原始碼、技術白皮書與研究筆記：
https://github.com/kakon77777-commits/webcode-sonification-engine
官網與免安裝線上示範：
https://wse.evemisstechnology.com/

🙏 特別感謝先行者：「Synesthesia Add-on: a Tool for HTML Sonification」（Brazilian Symposium on Computer Music, 2017）。WSE 為獨立設計、並不完全等同，但正因為有先行者證明過方向可行，我們才得以安心創作。

網路從來不是無聲的。

---

概念與專案方向：Neo.K（EveMissLab / EVEMISS Technology）
