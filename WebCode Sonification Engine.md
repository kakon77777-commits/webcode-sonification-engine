# WebCode Sonification Engine

## 網頁代碼生成音樂瀏覽器擴充系統

### 從 DOM、HTML、CSS 與 Runtime Event 到可聆聽生成音樂的開源技術白皮書

**作者：** Neo.K\
**日期：** 2026-07-04\
**版本：** v0.1 Technical Whitepaper Draft\
**文件類型：** Browser Extension / Web Sonification / Generative Music / Open Source / Agent Implementation Specification

---

# 0. 文件定位

本文提出一個瀏覽器擴充系統：

# **WebCode Sonification Engine**

## WSE

暫定中文名：

# **網頁代碼音樂化引擎**

其核心功能為：

> **讀取使用者目前瀏覽網頁的結構與可存取計算特徵，依照固定或可配置的映射規則，自動生成音樂。**

最簡化形式：

[\
\boxed{\
WebPage\
\rightarrow\
FeatureExtraction\
\rightarrow\
MusicalMapping\
\rightarrow\
Audio\
}\
]

更完整形式：

[\
\boxed{\
HTML\
+\
DOM\
+\
CSS\
+\
RuntimeEvents\
\rightarrow\
FeatureSpace\
\rightarrow\
MusicGrammar\
\rightarrow\
Instrumentation\
\rightarrow\
Audio\
}\
]

本文預設第一階段採：

[\
\boxed{\
\text{Open Source First}\
}\
]

策略。

主要價值優先順序：

1. 可玩性；
2. 技術實驗；
3. 學術價值；
4. 社群傳播；
5. 作者識別；
6. 後續商業可能。

本文不以：

> 世界第一個 HTML Sonification Extension

作為宣傳。

因為此方向已有明確前例。

2017 年的 **Synesthesia Add-on: a Tool for HTML Sonification** 已提出將 HTML 頁面視為 musical score，讓頁面元素作為 sequencer 內容播放，並研究 HTML tag、style attribute 與 instrument mapping。

因此，本專案採取保守定位：

> **An open-source experimental browser extension for transforming webpage computational structure into deterministic and generative music.**

---

# 1. 研究背景與 Prior Art

---

## 1.1 Synesthesia Add-on

已知直接相關先例：

**Synesthesia Add-on: a Tool for HTML Sonification**

其論文發表於 2017 年 Brazilian Symposium on Computer Music；公開研究資料描述的方向包括：

- 將 HTML page 作為 musical score；
- 頁面元素形成 sequencing；
- HTML tags 參與 mapping；
- style attributes 可映射聲音參數；
- 可選擇 instrument；
- 以 browser add-on 形式作用於網站。

因此：

[\
\boxed{\
HTML\
\rightarrow\
Music\
}\
]

不是本文原創命題。

---

## 1.2 現存 repository 狀態

截至 2026-07-04，本文件撰寫時直接檢查其公開 GitHub repository：

[\
\texttt{rppbodo/synesthesia-addon}\
]

頁面顯示：

- 8 commits；
- 0 stars；
- 0 forks；
- 0 published releases。

README 主要提供 Firefox `about:debugging` 暫時載入測試方式。

本文不根據此數據推論：

> 該研究沒有價值。

相反地，它是一個重要 prior art。

本文僅推論：

> 該方向至少沒有從此 repository 的公開 GitHub 社群指標形成大型開源生態。

這是推論，不是完整市場調查。

---

## 1.3 無法公開確認總下載量

本文件不能可靠提供：

[\
\text{Total Downloads}\
]

原因：

GitHub repository traffic 中的 clone、visitor 等資料，需要具 repository push access 的使用者才能查看；另一方面，GitHub 可公開取得的 download count 主要與 release assets 有關，而該 repository 目前沒有 published releases。

因此：

[\
\boxed{\
\text{Unknown Downloads}\
}\
]

是目前最誠實結論。

---

# 2. 本專案的差異化定位

本專案不應只做：

[\
HTML Tags\
\rightarrow\
Notes\
]

而應做：

[\
\boxed{\
\text{Entire Accessible Webpage Structure}\
\rightarrow\
\text{Generative Music System}\
}\
]

第一階段候選輸入：

(\
H,\
D,\
C,\
V,\
E\
)\
]

其中：

- (H)：HTML / element structure；
- (D)：DOM topology；
- (C)：CSS / computed style features；
- (V)：visual geometry；
- (E)：runtime events。

未來可擴充：

- JavaScript metadata；
- network behavior；
- accessibility tree；
- animation state；
- mutation streams。

---

# 3. 核心產品命題

對任一網頁：

[\
W\
]

提取：

[\
F(W)\
]

再生成：

[\
M(W)\
]

即：

[\
\boxed{\
M(W)=G(F(W),\Theta)\
}\
]

其中：

- (G)：music generation function；
- (\Theta)：mapping profile。

因此：

[\
\boxed{\
Webpage\
\rightarrow\
Music\
}\
]

---

# 4. 網站音樂身份

若映射規則 deterministic：

[\
G\
]

固定。

則：

[\
F(W_1)\approx F(W_1)\
]

應導致：

[\
M(W_1)\approx M(W_1)\
]

因此每個網站可能具有：

# **Site Sound Signature**

## 網站聲音指紋

例如：

[\
M(\text{Wikipedia})\
]

與：

[\
M(\text{GitHub})\
]

理論上不同。

---

# 5. 重要設計原則：不要直接把資料硬轉音符

最天真的版本：

```
<div> → C
<p>   → D
<a>   → E
<img> → F
```

問題是：

[\
\boxed{\
\text{Data Mapping}\
\neq\
\text{Good Music}\
}\
]

如果直接逐元素播放：

[\
e_1,e_2,\dots,e_n\
]

大型網站可能產生：

- 高密度噪音；
- 無調性；
- 無節奏；
- 音符爆炸；
- 聽覺疲勞。

因此本專案必須採用：

# **Two-Stage Architecture**

---

## Stage A：Structural Sonification

[\
WebPage\
\rightarrow\
FeatureVector\
]

---

## Stage B：Musicalization

[\
FeatureVector\
\rightarrow\
MusicalGrammar\
\rightarrow\
Music\
]

---

即：

[\
\boxed{\
\text{先忠實提取}\
+\
\text{再音樂化約束}\
}\
]

---

# 6. 三種模式

---

## 6.1 Analytical Mode

### 分析聲音化模式

目標：

[\
\boxed{\
\text{Structure Fidelity}\
}\
]

優先保留網頁差異。

例如：

- DOM depth 直接控制 pitch；
- node count 控制 density；
- tag ratio 控制 rhythm。

此模式可能不好聽。

但分析價值較高。

---

## 6.2 Musical Mode

### 音樂生成模式

目標：

[\
\boxed{\
\text{Listenability}\
}\
]

允許：

- scale quantization；
- chord constraints；
- rhythm grids；
- voice leading；
- density limits。

此模式不追求資料完全忠實。

---

## 6.3 Hybrid Mode

### 混合模式

預設推薦。

保留：

[\
\text{Website Identity}\
]

但加入：

[\
\text{Musical Constraints}\
]

---

# 7. Chrome Extension 技術基礎

第一版建議使用：

[\
\boxed{\
\text{Manifest V3}\
}\
]

Chrome 官方擴充架構允許 content scripts 在網頁環境中運行，並透過標準 DOM 讀取頁面細節，再與擴充本體通訊。

因此第一版核心：

```
Current Tab
    ↓
Content Script
    ↓
DOM Feature Extraction
    ↓
Extension Messaging
    ↓
Music Engine
    ↓
Web Audio
```

---

# 8. 最小權限策略

推薦 MVP：

```
{
  "manifest_version": 3,
  "permissions": [
    "activeTab",
    "scripting",
    "storage"
  ]
}
```

Chrome 官方 `scripting` API 可搭配 `activeTab` 取得使用者當次主動授予的暫時頁面權限，而不必一開始要求所有網站永久 host access。

因此推薦：

[\
\boxed{\
\text{Click Extension}\
\rightarrow\
\text{Analyze Current Tab}\
}\
]

而不是預設：

[\
\boxed{\
\text{Always Read Every Website}\
}\
]

---

# 9. MVP 架構

```
/src
  /background
    service-worker.ts

  /content
    extractor.ts
    dom-features.ts
    style-features.ts
    geometry-features.ts

  /audio
    engine.ts
    scheduler.ts
    instruments.ts
    harmony.ts
    rhythm.ts

  /mapping
    profile.ts
    default-map.ts
    deterministic-seed.ts

  /ui
    popup.ts
    popup.html
    options.ts

  /shared
    types.ts
    messages.ts
```

---

# 10. 音訊執行位置

Manifest V3 service worker 不應被視為長時間穩定音訊播放環境。

Chrome 官方提供 Offscreen API，使 extension 可以建立隱藏 document 使用需要 DOM/window 類環境的能力；官方亦明確指出 service workers 沒有 DOM access。

因此推薦：

```
Service Worker
      ↓
Create / Manage Offscreen Document
      ↓
AudioContext
      ↓
Synth Engine
```

Web Audio API 本身提供：

- `AudioContext`
- `AudioNode`
- `AudioParam`
- dynamic audio graph
- `AudioWorklet`

等聲音合成與處理結構。

---

# 11. 完整系統架構

[\
W\
\rightarrow\
E\
\rightarrow\
F\
\rightarrow\
N\
\rightarrow\
G\
\rightarrow\
S\
\rightarrow\
A\
]

其中：

- (W)：Webpage；
- (E)：Extractor；
- (F)：Raw Feature Space；
- (N)：Normalizer；
- (G)：Music Grammar；
- (S)：Scheduler；
- (A)：Audio Engine。

---

# 12. Phase 1：DOM Feature Extraction

Content script 讀：

```
document.documentElement
```

遍歷：

```
document.querySelectorAll("*")
```

但需要：

[\
\boxed{\
\text{Sampling}\
}\
]

避免超大型 DOM 阻塞。

---

# 13. 建議 DOM 特徵

定義：

[\
F_{DOM}\
]

包括：

```
totalNodes
maxDepth
avgDepth
tagHistogram
siblingHistogram
textDensity
linkDensity
imageCount
buttonCount
formCount
sectionCount
```

---

# 14. DOM 深度

對 node：

[\
v_i\
]

定義：

[\
depth(v_i)\
]

可映射：

[\
PitchRegister(v_i)\
]

例如：

2\
+\
(depth\bmod5)\
]

---

# 15. Tag Histogram

建立：

[\
H_{tag}(t)\
]

例如：

```
DIV     184
P        42
A       119
IMG      18
BUTTON   12
SCRIPT   31
```

---

可控制：

- instrument presence；
- rhythm density；
- orchestration。

---

# 16. HTML Tag → Instrument Family

第一版推薦：

```
header      → brass
nav         → percussion
main        → piano
article     → strings
section     → pad
a           → pluck
button      → mallet
img         → bell
form        → bass
footer      → low pad
```

注意：

這不是永久真理。

只是：

[\
\Theta_{default}\
]

---

# 17. Orchestra by Web Architecture

因此：

\text{Orchestration Structure}\
}\
]

若網站大量：

```
article
section
p
```

可能偏：

- strings；
- piano；
- long phrases。

若大量：

```
button
nav
a
```

可能偏：

- percussion；
- pluck；
- rhythmic music。

---

# 18. CSS Feature Extraction

第一版不要解析完整 CSS AST。

優先讀：

```
getComputedStyle(element)
```

候選：

```
color
backgroundColor
fontSize
fontWeight
opacity
display
position
transform
borderRadius
```

---

# 19. CSS Color → Musical Parameter

例如 RGB：

[\
(r,g,b)\
]

轉：

[\
HSL(h,s,l)\
]

再：

[\
h\
\rightarrow\
PitchClass\
]

[\
s\
\rightarrow\
TimbreBrightness\
]

[\
l\
\rightarrow\
Velocity\
]

---

形式：

\left\lfloor\
12\frac{h}{360}\
\right\rfloor\
]

---

# 20. 注意：色彩映射不是無限光譜理論本體

本專案可以受到無限光譜思維啟發。

但第一版只是：

[\
\boxed{\
\text{Color Feature}\
\rightarrow\
\text{Music Parameter}\
}\
]

不要過度宣稱。

---

# 21. Visual Geometry

從：

```
element.getBoundingClientRect()
```

提取：

- x；
- y；
- width；
- height。

---

定義：

[\
x_i\
\rightarrow\
Pan\
]

---

例如：

2\frac{x_i}{ViewportWidth}-1\
]

所以：

- 左邊元素 → 左聲道；
- 右邊元素 → 右聲道。

---

# 22. Y Position → Time

頁面垂直位置：

[\
y_i\
]

可映射：

[\
Time_i\
]

---

因此：

[\
\boxed{\
\text{Scrolling Page}\
}\
]

本身成為：

[\
\boxed{\
\text{Vertical Score}\
}\
]

---

# 23. Element Size

面積：

width_i\cdot height_i\
]

可映射：

- velocity；
- duration；
- instrument prominence。

---

# 24. Text Feature

第一版只讀：

[\
\boxed{\
\text{Text Length Statistics}\
}\
]

而不是上傳完整文字。

例如：

```
textLength
wordCount
sentenceEstimate
```

---

可映射：

[\
TextLength\
\rightarrow\
PhraseLength\
]

---

# 25. Privacy by Default

推薦：

[\
\boxed{\
\text{Local Processing Only}\
}\
]

MVP 不把：

- page text；
- form content；
- password；
- browsing history

傳往 server。

---

# 26. Sensitive Element Exclusion

預設跳過：

```
input
textarea
select
[contenteditable]
[type=password]
```

---

並避免讀：

```
element.value
```

---

# 27. JS Layer 的工程邊界

非常重要：

Chrome content script 可以讀 DOM，但這不代表：

> 可以無限制取得網站所有原始 JavaScript 語義。

因此 MVP 不應宣稱：

[\
\boxed{\
\text{Full JavaScript Understanding}\
}\
]

---

# 28. MVP 的 JavaScript Metadata

第一版只提取：

```
scriptCount
inlineScriptCount
externalScriptCount
moduleScriptCount
scriptSrcDomainCount
```

---

可以：

[\
ScriptDensity\
\rightarrow\
RhythmicComplexity\
]

---

但不要執行未知 script。

---

# 29. Runtime Event Layer

第二階段加入：

- click；
- scroll；
- resize；
- DOM mutation。

---

形成：

[\
E_t\
]

---

音樂：

G(\
F(W_t),\
E_t\
)\
]

---

# 30. MutationObserver Mode

使用：

```
new MutationObserver(...)
```

監控：

- node added；
- node removed；
- attribute changed。

---

映射：

```
Add Node     → note onset
Remove Node  → note release
Attribute    → modulation
```

---

# 31. Live Website Performance

因此動態網站：

[\
W_t\
]

本身成為演奏者。

---

\text{Live Performance}\
}\
]

---

# 32. 音樂生成的核心難題

真正難點不是：

[\
WebPage\rightarrow Sound\
]

而是：

[\
\boxed{\
WebPage\rightarrow GoodMusic\
}\
]

---

# 33. Music Grammar Layer

因此建立：

[\
\mathcal{G}_M\
]

包括：

- key；
- scale；
- meter；
- tempo；
- chord progression；
- voice limit。

---

# 34. Deterministic Key

從網站 seed：

[\
Seed(W)\
]

計算：

Hash(Seed)\bmod12\
]

---

# 35. Scale

候選：

```
Major
Minor
Dorian
Phrygian
Lydian
Pentatonic
```

---

第一版推薦限制：

```
Major
Minor
Pentatonic
```

降低難聽機率。

---

# 36. Tempo

定義：

[\
Complexity(W)\
]

例如：

\alpha\log(NodeCount)\
+\
\beta ScriptDensity\
+\
\gamma LinkDensity\
]

再：

Clamp(\
60+40C_W,\
60,\
160\
)\
]

---

# 37. Rhythm Quantization

所有事件：

[\
t_i\
]

量化至：

[\
\frac14,\
\frac18,\
\frac1{16}\
]

網格。

避免完全隨機。

---

# 38. Density Limiter

設定：

[\
N_{max}\
]

例如：

```
max simultaneous voices = 12
max note events / second = 20
```

---

大型網站必須：

[\
Sample(F)\
]

不能：

[\
\forall node,\ play(note)\
]

---

# 39. Harmonic Guardrail

所有 raw pitch：

[\
p_i\
]

量化：

[\
Q(p_i)\
\in\
Scale(K)\
]

---

因此：

[\
\boxed{\
\text{Structure controls variation}\
}\
]

但：

[\
\boxed{\
\text{Music grammar controls listenability}\
}\
]

---

# 40. Three-Layer Mapping

推薦：

## Layer A：Identity

由網站決定：

- key；
- tempo；
- seed。

---

## Layer B：Structure

由 DOM 決定：

- phrases；
- sections；
- density。

---

## Layer C：Performance

由 runtime 決定：

- fills；
- modulation；
- variation。

---

# 41. Site Signature

定義：

Hash(\
TagHistogram,\
DepthStats,\
StyleStats,\
GeometryStats\
)\
]

---

再：

H(S_W)\
]

---

因此同一結構：

[\
S_W\
]

應生成相近音樂。

---

# 42. URL 不應是唯一 Seed

不要只：

[\
Hash(URL)\
]

否則：

> 網頁結構完全改變，音樂不變。

---

推薦：

H(\
CanonicalURL,\
StructuralFingerprint\
)\
]

---

# 43. Static Mode

只在開始分析一次：

[\
W_0\
\rightarrow\
M\
]

---

優點：

- 穩定；
- 可重現；
- 省 CPU。

---

# 44. Live Mode

持續：

[\
W_t\
\rightarrow\
M_t\
]

---

優點：

- 網頁互動變成音樂。

---

# 45. Scroll Mode

只有 viewport 內元素參與：

[\
V_t\
\subset\
W\
]

---

生成：

[\
M(V_t)\
]

---

因此使用者滑動頁面：

\text{Playhead}\
}\
]

---

# 46. MVP Mode 建議

v0.1 只做：

1. Static Mode；
2. Hybrid Music Mode；
3. DOM + computed CSS；
4. 4 種 instrument profile。

---

不要一開始做：

- full JS analysis；
- network analysis；
- AI composition；
- cloud sync。

---

# 47. Instrument Profiles

---

## Profile A：Ambient

```
article → pad
section → strings
link    → bell
button  → soft pluck
```

---

## Profile B：Piano

大部分 melodic voice 使用：

```
piano
electric piano
```

---

## Profile C：Electronic

```
script → synth
button → kick
link   → hi-hat
image  → pad
```

---

## Profile D：Orchestral

```
header  → brass
article → strings
nav     → percussion
footer  → bass
```

---

# 48. Instrument 不只是換 Skin

禁止只做：

[\
MIDI\
\rightarrow\
DifferentSoundFont\
]

更好的方式：

Instrument Profile 同時改變：

- articulation；
- rhythm role；
- register；
- density。

---

# 49. Popup UI

建議：

```
┌─────────────────────────┐
│ WebCode Sonification    │
├─────────────────────────┤
│ [ Analyze & Play ]       │
│                         │
│ Mode:   Hybrid ▼        │
│ Style:  Ambient ▼       │
│ Seed:   Structural      │
│                         │
│ Tempo:  108 BPM         │
│ Key:    D minor         │
│ Nodes:  1843            │
│                         │
│ [ Stop ] [ Regenerate ] │
└─────────────────────────┘
```

---

# 50. Explain Mode

顯示：

```
Why does this page sound like this?
```

例如：

```
High link density
→ faster pluck rhythm

Deep DOM tree
→ wider pitch register

Dark average palette
→ lower timbral brightness
```

---

這個功能具有：

- 教育價值；
- 學術價值；
- 可解釋性。

---

# 51. Inspector Mode

點某元素：

```
<article>
```

顯示：

```
Instrument: Strings
Pitch: A4
Reason: depth=7
Duration: 1/2
Color source: #1F2937
```

---

# 52. Export

v0.2 可加入：

- WAV；
- MIDI；
- JSON feature map。

---

第一版：

[\
\boxed{\
\text{不一定需要 Export}\
}\
]

先把：

[\
PlayCurrentPage()\
]

做好。

---

# 53. 分享機制

生成：

```
My GitHub sounds like...
```

---

或：

```
Listen to this webpage
```

---

這可能是社群傳播核心。

---

# 54. 但不要上傳私人頁面結構

Share 時只保存：

- generated seed；
- mapping profile；
- audio rendering。

不要默認保存：

- raw DOM；
- text；
- private URLs。

---

# 55. Open Source Strategy

建議：

[\
\boxed{\
\text{Open Source Core}\
}\
]

---

候選：

- Apache-2.0；
- MIT。

---

本文偏向：

[\
\boxed{\
Apache-2.0\
}\
]

作為第一候選。

---

# 56. 作者識別

建立：

```
README.md
CITATION.cff
AUTHORS
NOTICE
```

---

清楚標示：

```
Concept and project direction:
Neo.K
```

---

# 57. 學術識別

推薦未來：

- 技術白皮書；
- DOI archive；
- CITATION.cff；
- versioned releases。

---

讓他人：

[\
\boxed{\
\text{不只 Star}\
}\
]

而可以：

[\
\boxed{\
\text{Cite}\
}\
]

---

# 58. 開源不代表放棄商業化

可能模式：

### Free Core

瀏覽器外掛免費。

---

### Creator Pack

- premium instruments；
- export；
- advanced mappings。

---

### API / SDK

網站開發者：

[\
Website\
\rightarrow\
SoundIdentity\
]

---

### Installation Art

博物館／展覽。

---

### Accessibility Research

資料聲音化。

---

### Brand Sound

企業網站生成品牌聲音。

---

# 59. 但 v0.1 不做付費

推薦：

[\
\boxed{\
\text{Prove Interestingness First}\
}\
]

也就是先驗證：

> 生成結果到底好不好聽？

---

# 60. 核心成功問題

第一個問題不是：

> 有人願意付多少錢？

而是：

[\
\boxed{\
P(\
\text{User says "this is unexpectedly good"}\
)\
}\
]

是否夠高。

---

# 61. MVP 成功指標

---

## Metric A：Play Completion

使用者播放：

[

> 30s\
> ]

比例。

---

## Metric B：Replay

同一頁重新播放。

---

## Metric C：Cross-Site Exploration

一個使用者測試：

[\
\ge3\
]

網站。

---

## Metric D：Share

分享生成結果。

---

## Metric E：Star

GitHub stars。

---

# 62. 音樂品質 A/B Test

比較：

### A

Raw Sonification

---

### B

Musicalized

---

### C

Hybrid

---

評分：

[\
1\sim5\
]

---

# 63. 研究問題

---

## RQ1

不同網站是否形成可辨識 sound signature？

---

## RQ2

使用者能否從音樂辨認網站類型？

---

## RQ3

Musicalization 是否降低 structural fidelity？

---

## RQ4

哪些網頁特徵最影響 perceived musical quality？

---

## RQ5

網站改版是否產生可感知音樂差異？

---

# 64. 學術價值

本專案可以研究：

[\
\boxed{\
\text{Web Structure Sonification}\
}\
]

---

以及：

[\
\boxed{\
\text{Deterministic Generative Music from Computational Artifacts}\
}\
]

---

更高階：

[\
\boxed{\
\text{Can software structures possess audible identities?}\
}\
]

---

# 65. 與傳統 Sonification 的差異

傳統：

[\
Dataset\
\rightarrow\
Sound\
]

---

本專案：

[\
\boxed{\
\text{Executable / Rendered Web Structure}\
\rightarrow\
\text{Music}\
}\
]

---

網頁不是靜態 CSV。

它同時有：

- tree；
- style；
- geometry；
- runtime。

---

# 66. 核心研究命題

本文提出：

[\
\boxed{\
\text{A webpage may be treated as a latent musical score.}\
}\
]

但不宣稱此命題首次被提出。

因為已有 HTML sonification prior art。

本專案更保守的新方向是：

[\
\boxed{\
\text{A webpage's accessible computational structure may define a reproducible generative musical identity.}\
}\
]

---

# 67. Agent 實作任務清單

---

## Task 1：Extension Scaffold

建立：

```
Manifest V3
Popup
Service Worker
Content Script
Offscreen Audio Document
```

---

## Task 2：DOM Extractor

輸出：

```
interface DomFeatures {
  totalNodes: number;
  maxDepth: number;
  avgDepth: number;
  tagHistogram: Record<string, number>;
  linkCount: number;
  imageCount: number;
  buttonCount: number;
  textLength: number;
}
```

---

## Task 3：Style Extractor

```
interface StyleFeatures {
  avgHue: number;
  avgSaturation: number;
  avgLightness: number;
  avgFontSize: number;
  fixedCount: number;
  absoluteCount: number;
}
```

---

## Task 4：Geometry Extractor

```
interface GeometryFeatures {
  viewportWidth: number;
  viewportHeight: number;
  pageHeight: number;
  avgElementArea: number;
  horizontalDistribution: number[];
}
```

---

## Task 5：Structural Fingerprint

```
interface PageFingerprint {
  version: 1;
  hash: string;
  seed: number;
}
```

---

## Task 6：Music Profile

```
interface MusicProfile {
  key: number;
  scale: "major" | "minor" | "pentatonic";
  bpm: number;
  style: "ambient" | "piano" | "electronic" | "orchestral";
}
```

---

## Task 7：Score Generator

輸入：

```
PageFeatures
```

輸出：

```
interface NoteEvent {
  time: number;
  duration: number;
  pitch: number;
  velocity: number;
  instrument: string;
  pan: number;
}
```

---

## Task 8：Scheduler

排序：

[\
event.time\
]

---

lookahead scheduling。

---

## Task 9：Audio Engine

MVP：

- Oscillator；
- Gain；
- Filter；
- simple envelope。

---

不要第一版塞：

- 2 GB samples。

---

## Task 10：Popup

功能：

```
Analyze
Play
Stop
Regenerate
Style
Mode
```

---

# 68. 推薦第一版資料流

```
User Click
   ↓
activeTab permission
   ↓
Inject Extractor
   ↓
DOM Snapshot Features
   ↓
Normalize
   ↓
Fingerprint
   ↓
Music Profile
   ↓
Generate Score
   ↓
Offscreen Audio Engine
   ↓
Play
```

---

# 69. 第一版映射規則

---

## Rule 1

[\
NodeCount\
\rightarrow\
BPM\
]

---

## Rule 2

[\
MaxDepth\
\rightarrow\
PitchRange\
]

---

## Rule 3

[\
LinkDensity\
\rightarrow\
ArpeggioDensity\
]

---

## Rule 4

[\
ImageDensity\
\rightarrow\
BellLayer\
]

---

## Rule 5

[\
ButtonDensity\
\rightarrow\
Percussion\
]

---

## Rule 6

[\
AverageHue\
\rightarrow\
Key\
]

---

## Rule 7

[\
AverageLightness\
\rightarrow\
TimbreBrightness\
]

---

## Rule 8

[\
DOMSections\
\rightarrow\
SongSections\
]

---

# 70. Song Structure

例如：

```
Intro
A
B
A'
Outro
```

可由：

```
header
main sections
footer
```

生成。

---

# 71. DOM → Form

[\
header\
\rightarrow\
Intro\
]

---

[\
main\
\rightarrow\
Body\
]

---

[\
section_i\
\rightarrow\
Phrase_i\
]

---

[\
footer\
\rightarrow\
Outro\
]

---

# 72. 第一版樂曲長度

推薦：

[\
30\sim90s\
]

---

避免：

- 網站巨大 → 45 分鐘。

---

# 73. Normalization

所有網頁：

[\
F(W)\
]

先：

[\
N(F(W))\
\in[0,1]^n\
]

---

例如：

\frac{\log(1+NodeCount)}\
{\log(1+N_{cap})}\
]

---

# 74. Outlier Protection

例如：

[\
NodeCount=500000\
]

不能炸掉音樂。

---

使用：

[\
Clamp\
]

與：

[\
log\
]

---

# 75. Performance Budget

MVP：

```
DOM sampled nodes ≤ 5000
style sampled nodes ≤ 500
analysis target ≤ 500ms–1500ms
```

---

若超出：

[\
Sample\
]

---

# 76. Sampling Strategy

優先：

- semantic elements；
- visible elements；
- representative random sample。

---

不要遍歷所有 hidden SVG path。

---

# 77. iframe

MVP：

[\
\boxed{\
\text{Ignore cross-origin frames}\
}\
]

---

只分析：

- main document。

---

# 78. Unsupported Pages

以下可能無法正常注入：

- browser internal pages；
- extension store protected pages；
- special schemes。

---

UI 必須顯示：

```
This page cannot be analyzed.
```

---

# 79. Error Handling

```
NO_PERMISSION
NO_DOM
AUDIO_BLOCKED
EXTRACTION_TIMEOUT
PAGE_TOO_LARGE
UNSUPPORTED_PAGE
```

---

# 80. 安全原則

禁止：

- `eval` remote code；
- 執行網站 script；
- 上傳 raw DOM；
- 讀 password field；
- 靜默常駐所有網站。

---

# 81. Determinism Test

同一 snapshot：

[\
F_1=F_2\
]

必須：

[\
Score(F_1)=Score(F_2)\
]

若：

[\
Seed\
]

相同。

---

# 82. Variation Mode

使用者點：

```
Regenerate
```

則：

H(\
PageFingerprint,\
VariationIndex\
)\
]

---

因此：

- 保留網站身份；
- 產生新版本。

---

# 83. Unit Tests

---

## Extractor

```
known HTML
→ known features
```

---

## Fingerprint

```
same input
→ same hash
```

---

## Music Mapping

```
same features + same seed
→ same score
```

---

## Quantizer

所有 pitch：

[\
p_i\
\in\
Scale\
]

---

# 84. Integration Test

建立：

```
fixtures/
  simple-blog.html
  dashboard.html
  ecommerce.html
  docs.html
```

---

確認四種網站：

[\
M_1\neq M_2\neq M_3\neq M_4\
]

---

# 85. 第一版里程碑

---

## Milestone 0

Extension loads。

---

## Milestone 1

Current page DOM stats。

---

## Milestone 2

Stats → notes。

---

## Milestone 3

Stable playback。

---

## Milestone 4

4 instrument profiles。

---

## Milestone 5

Deterministic fingerprints。

---

## Milestone 6

GitHub release。

---

# 86. MVP 完成定義

必須：

1. 使用者打開任意一般網頁；
2. 點 extension；
3. 點 Analyze & Play；
4. 1–2 秒內開始音樂；
5. 不同網站有明顯差異；
6. 同網站同 seed 可重現；
7. 可切換至少 4 種 style；
8. 不上傳頁面內容。

---

# 87. 不屬於 MVP

暫不做：

- AI composer；
- LLM；
- full JavaScript AST；
- cloud account；
- payment；
- social network；
- mobile。

---

# 88. v0.2

加入：

- Scroll Mode；
- Mutation Mode；
- export WAV。

---

# 89. v0.3

加入：

- custom mapping profiles；
- MIDI；
- advanced instruments。

---

# 90. v1.0

候選：

- Chrome；
- Firefox；
- public mapping SDK；
- research dataset。

---

# 91. 商業化判斷

本文不主張：

[\
\boxed{\
\text{Commercialization Impossible}\
}\
]

更保守：

[\
\boxed{\
\text{Standalone paid HTML-to-music extension has uncertain willingness-to-pay and weak conceptual exclusivity.}\
}\
]

---

因此第一策略：

[\
\boxed{\
\text{Open Source}\
\rightarrow\
\text{Attention}\
\rightarrow\
\text{Community}\
\rightarrow\
\text{Evidence}\
}\
]

---

再判斷：

[\
\boxed{\
\text{Commercial Layer?}\
}\
]

---

# 92. 可能意外

真正值得測試的是：

> 如果音樂真的意外地好聽呢？

---

若：

[\
Quality(M(W))\
\gg\
Expectation\
]

則產品定位可能從：

[\
\text{Research Toy}\
]

轉成：

[\
\boxed{\
\text{Generative Music Product}\
}\
]

---

# 93. 更高階產品

使用者可能：

> 我不是想知道網站結構。

而是：

> 我喜歡聽網站。

---

這時：

[\
\boxed{\
\text{Browse the Web by Listening}\
}\
]

可能成為獨立體驗。

---

# 94. 研究—藝術—產品三重定位

本專案可同時是：

### Research

Web sonification。

### Art

網站成為樂譜。

### Product

瀏覽器生成音樂。

---

# 95. 核心宣傳邊界

禁止宣稱：

> 第一個把 HTML 變音樂的 extension。

---

推薦：

> An open-source experiment that turns webpage structure into reproducible generative music.

---

或：

> Every webpage already has a structure. We let you hear it.

---

中文：

> **每一個網頁本來就有結構。我們只是讓你聽見它。**

---

# 96. 更高階宣傳句

> **The web was never silent.**

中文：

> **網路從來不是無聲的。**

---

# 97. 最終技術模型

定義：

[\
W\
]

為網頁。

提取：

(\
F_{DOM},\
F_{CSS},\
F_{Geometry},\
F_{Runtime}\
)\
]

---

正規化：

N(F(W))\
]

---

生成網站身份：

H(Z)\
]

---

生成音樂設定：

P(S_W)\
]

---

生成樂譜：

G(Z,\Theta)\
]

---

播放：

Render(Q)\
]

---

完整：

[\
\boxed{\
W\
\rightarrow\
F(W)\
\rightarrow\
Z\
\rightarrow\
S_W\
\rightarrow\
\Theta\
\rightarrow\
Q\
\rightarrow\
A\
}\
]

---

# 98. 最終核心

本專案不是：

> 隨機替 HTML tag 配音。

---

而是：

[\
\boxed{\
\text{Web Structure}\
\rightarrow\
\text{Musical Identity}\
}\
]

---

HTML 提供：

[\
\boxed{\
\text{Structure}\
}\
]

CSS 提供：

[\
\boxed{\
\text{Timbre / Visual Parameters}\
}\
]

DOM 提供：

[\
\boxed{\
\text{Topology}\
}\
]

Geometry 提供：

[\
\boxed{\
\text{Space}\
}\
]

Runtime 提供：

[\
\boxed{\
\text{Performance}\
}\
]

---

最終：

\text{Latent Score}\
}\
]

---

# 99. 結論

本文提出：

# **WebCode Sonification Engine**

一個開源瀏覽器擴充系統。

它不聲稱首次發明：

[\
HTML\rightarrow Music\
]

因為存在明確 prior art。

本專案真正的工程方向是：

[\
\boxed{\
\text{Accessible Webpage Computational Structure}\
\rightarrow\
\text{Deterministic Generative Musical Identity}\
}\
]

---

第一代：

[\
DOM\
+\
CSS\
+\
Geometry\
\rightarrow\
Music\
]

---

第二代：

[\
+\
RuntimeEvents\
]

---

第三代：

[\
+\
AdvancedStructuralAnalysis\
]

---

其核心不是：

> 一個網站播放一首背景音樂。

而是：

> **網站自己的結構，決定它成為什麼音樂。**

---

因此：

[\
\boxed{\
M(W_1)\neq M(W_2)\
}\
]

不是因為人工指定：

> GitHub 播電子樂。

而是因為：

[\
F(W_1)\neq F(W_2)\
]

---

最終，本專案希望回答：

> **如果每一個網頁本身都具有獨特的結構，那麼這些結構是否也具有可以被聽見的音樂身份？**

---

# 附錄 A：一句話版本

> **讀取目前網頁的 DOM、HTML、CSS 與可存取結構特徵，再透過可重現的生成規則把它轉成音樂。**

---

# 附錄 B：MVP

[\
\boxed{\
CurrentPage\
\rightarrow\
DOM/CSS Features\
\rightarrow\
Music Grammar\
\rightarrow\
Web Audio\
}\
]

---

# 附錄 C：Agent 第一指令

> 建立一個 Manifest V3 Chrome extension。使用 activeTab 與 scripting 權限，在使用者點擊 Analyze & Play 後注入 content script，提取目前主文件的 DOM 統計、有限抽樣 computed style 與 geometry features。將特徵送回 extension，使用 deterministic seed 生成 30–90 秒 NoteEvent score，經 scale quantization、rhythm quantization、voice limiting 後，在 offscreen document 中以 Web Audio API 播放。所有分析預設 local-only，不上傳 raw DOM 或 page text，不讀 input、textarea、contenteditable 與 password values。

---

# 附錄 D：第一版 DoD

```
[ ] MV3 extension loads
[ ] activeTab only
[ ] current DOM analyzed
[ ] CSS sampled
[ ] fingerprint generated
[ ] deterministic score
[ ] 4 styles
[ ] play / stop
[ ] local-only
[ ] no form-value reading
[ ] 4 fixture tests
[ ] README
[ ] CITATION.cff
[ ] LICENSE
```

---

# 附錄 E：最終宣傳句

> **Every webpage already has a structure. We let you hear it.**

---

> **The web was never silent.**

---

中文：

> **每一個網頁本來就有結構。我們只是讓你聽見它。**

以及：

> **網路從來不是無聲的。**
