# Codex 操作手冊與接續紀錄

本文件讓新工作階段不必依賴聊天歷史即可操作專案。根目錄 `AGENTS.md` 指向這裡。路徑皆相對專案根目錄。

## 1. 接續工作順序

1. 讀 `AGENTS.md` 與本文件，再查看使用者最新指示。
2. 檢查工作樹，保留使用者既有修改；讀相關原始碼確認文件仍與程式一致。
3. 若需要現成地圖，從 `data/` 的 JSON 載入；`rocketHideout()` 是復刻 JSON 的 CLI／測試讀取函式，不從畫面反推資料。
4. 用共用引擎驗證，必要時在瀏覽器載入對照與試玩。
5. 改引擎後執行規則測試；交付前編譯。新增命令、改格式或改復刻進度時更新本文件。

## 2. 執行與檢查

需求為 Node.js 22（開發時使用 22.17.0）及 npm。

```sh
npm install
npm run dev
npm test
npm run build
```

`dev` 在本機執行 Vite，預設 5173，埠已使用時可能選別的埠；不要假設舊工作階段的服務仍在執行。`build` 會執行 TypeScript 檢查並產生 `dist/` 靜態網站。無應用程式後端，不需資料庫服務或帳號。

## 3. Codex 用資料與程式操作

### 直接使用 TypeScript 引擎

`src/engine.ts` 沒有 DOM、React 或儲存依賴，可在 Node 中由 `tsx` 執行。

```ts
import { analyze, blank, move, parseMaze } from './src/engine';
import { rocketHideout } from './src/rocketHideout';

const map = rocketHideout(); // 每次回傳獨立資料；可安全修改
const edited = structuredClone(map);
edited.tiles[5 * edited.width + 4] = 'right';
const validMap = parseMaze(edited); // 修改後先驗證端點、尺寸、地形
const result = analyze(validMap);
for (const route of result.routes) {
  console.log(route.exit.id, route.reachable, route.commands.length);
}
const step = move(validMap, validMap.entrance, 'right');
// step.trace 是完整逐格軌跡；step.end 是停止點；step.loop 是滑行循環。
```

用 `blank(width, height)` 建空白圖。它會產生邊界牆、一個 In、一個 Out；預設 28 × 20。合法寬高為 5–100。`demo()` 是最早的通用機關範例，**不是火箭隊復刻圖**。

### 命令列

```sh
npm run --silent analyze -- examples/arrow-corridor.json
npm run --silent reference
```

使用 `--silent` 避免 npm 的命令橫幅污染 JSON stdout。前者讀取指定檔案並輸出分析；後者輸出復刻地圖 JSON，沒有寫檔副作用。若要將 stdout 存檔，應由執行端明確處理編碼，或在本專案使用 `apply_patch` 建立要保留的 JSON。不要把含 npm 橫幅的內容交給 JSON parser。

CLI 地圖格式錯誤會以非零結束；**有出口無解時依然正常輸出 JSON，不會以 exit code 表示無解**。批量篩選須檢查 `routes[].reachable`。

目前沒有 HTTP 建圖 API、瀏覽器全域控制物件或批量生成器。不要臆造不存在的端點。需要大量生成時，寫呼叫引擎的程式即可；後續再依使用者需求新增生成策略。

### JSON v1

```ts
type Point = { x: number; y: number };
type Tile = 'floor' | 'wall' | 'block' | 'up' | 'right' | 'down' | 'left' | 'stop';
type Maze = {
  version: 1;
  name: string;
  width: number;
  height: number;
  tiles: Tile[];
  entrance: Point;
  exits: (Point & { id: string })[];
  appearance?: 'rocket'; // 範例識別值；不代表圖片渲染
  markers?: (Point & { label: string; kind: 'item' | 'stairs' | 'lift' | 'npc' })[];
  review?: (Point & { reason: string })[];
};
```

座標從左上 (0,0) 起算；索引為 `y * width + x`。`tiles.length` 必須等於寬乘高。牆 `wall` 與藍框障礙 `block` 都不可站立，會擋住滑行；外觀不同。端點必須是地圖內非障礙格，出口 ID 唯一。可沒有出口。標記和待核對欄位不影響碰撞或求解。

`parseMaze(unknown)` 檢查格式並回傳深複製。`move()` 與 `analyze()` 假設輸入已合法，外部資料必須先經過 `parseMaze()`。

### 分析結果

- `routes[]`：每個出口各自的 `reachable`、`commands`、`trace`、`sliding`。
- `commands`：自由操作的方向序列。一個命令包含一步自主移動與後續完整滑行。
- `trace`：從 In 開始的逐格位置，長度減一為移動格數。
- `sliding`：與 trace 對齊，該步是否由強制滑行產生；自主踩上第一個箭頭的那步為 false。
- `reachable`：可從 In 抵達並停住的位置，**不是所有滑行經過的格子**。
- `loopTransitions`：從可達停止點發出的循環操作數，**不是不同循環的數目**。

無解路線的 `commands` 為空，但其 `trace` 仍含入口；必須先看 `reachable`。BFS 優先最少操作次數，不是最少格數。重播 `commands` 時，每步 `move` 均應 `loop === false`，最後 end 等於出口座標。

## 4. 瀏覽器操作

- 地圖統一放 `data/`；用頁首「匯入」選取 `data/rocket-hideout.json` 載入復刻草稿，可用復原返回原地圖。沒有儲存資料時顯示空白圖。
- 已移除復刻專用面板；來源圖可獨立開啟 `public/reference/rocket-hideout.png` 核對。右側顯示選項依 JSON 資料提供標記及待核對格開關。
- 左側工具：牆、藍框障礙、地板、四向箭頭、停止格、入口、出口、刪除出口。拖曳連續繪製。
- 地板筆刷清除機關及障礙；入口工具移動唯一 In；出口工具新增帶唯一 ID 的 Out。
- 在端點放置牆／障礙會被拒絕。先移走入口或刪除出口再畫。
- 放置端點時會將該格轉成普通地板，之後仍可覆蓋箭頭／停止格。
- Ctrl/Cmd+Z 復原；Ctrl/Cmd+Shift+Z 重做。每段拖曳是一筆歷史操作，上限 100。
- 預設「符合視窗」，以 ResizeObserver 持續依畫布可用區域縮放，切換模式、收合分析欄及視窗變更時自動調整。手動縮放／1:1 會退出自動模式；按「符合視窗」恢復。編輯工具列「分析」可收合右側欄，試玩時右側欄自動隱藏。操作說明在頁首收合選單，新增地圖收於左側「建立新地圖」。
- 右側選出口看對應路線，實線步行、虛線滑行；可顯示可停留區域。
- 「試玩迷宮」以方向鍵、WASD 或畫面方向鍵移動，隱藏答案。滑行循環後須重來。
- 「匯出 JSON」下載當前完整資料；「匯入」讀取並驗證 JSON。

自動儲存：IndexedDB 資料庫 `maze-lab`、object store `documents`、key `current`，約 400ms 防抖。舊資料會優先於預設地圖。測試時不要刪除使用者資料以強制載入新地圖；用頁首「匯入」載入 JSON。失敗會在狀態列提示，JSON 匯出仍可用。

## 5. 火箭隊復刻狀態

來源為使用者上傳的圖片，不是從網路找到的另一張布局。保留於 `public/reference/rocket-hideout.png`。

- 地圖尺寸 30 × 22，原圖格子 16px，編輯器邏輯繪製單位 32px。
- `data/rocket-hideout.json` 是復刻資料唯一來源；`src/rocketHideout.ts` 僅讀取並驗證此 JSON，供 CLI 與測試共用。後續直接更新 JSON。
- 使用者明確要求用編輯器素材重建相同機關；禁止貼來源圖片或裁切圖塊。原裁圖 `src/renderer.ts` 已移除，`App.tsx` 以共用 Canvas 素材繪製所有格子。來源圖片保留為獨立參考檔，不載入地圖畫布。
- 人物／樓梯／道具以符號標記。驗收重點是布局與移動行為，仍需核對被遮擋的地形。
- 測試端點：In 樓梯 (4)=(21,16)；Out 樓梯 (2)=(21,2)、樓梯 (1)=(27,2)、電梯=(24,13)。這是為驗證路線選定的配置，並非圖片明示的進出口。
- 受標籤遮擋的 22 格：Moon Stone x=1..3,y=6..7；TM07 x=5..8,y=7..8；Super Potion x=2..5,y=16..17。資料中逐格附 `reason`，可以在畫面標示。
- 原圖紅／紫／藍／黑路線是註記，沒有轉成地形或牆。
- 道具收集、NPC 碰撞／事件、樓梯跨層、電梯目的樓層、批量生成與遊戲性評分尚未實作。

修改待核對格時，保留推定理由；只有取得無標註圖或可靠遊戲資料並核對後才移除 `review` 記錄。不要為了「有解」任意修改來源布局。

## 6. 驗證紀錄與下一步

2026-10-27：React/TypeScript/Vite 編輯器已實作。初版 9 項規則測試、正式編譯及 CLI 分析通過；瀏覽器整合檢查已驗證繪製、復原、重做、方向鍵操作及遊玩隱藏答案。

加入復刻後有 11 項測試，包含藍框障礙碰撞及復刻資料尺寸／三個出口路線重播，目前測試全部通過。每次接續應以當前命令結果為準，而非只引用這份紀錄。

先前瀏覽器驗證三個出口可達且重新整理後仍保存復刻地圖。測試端點求解結果：樓梯 (2) 19 次操作／24 格、樓梯 (1) 27 次／32 格、電梯 8 次／8 格。這只驗證轉錄配置可解，不代表原版地圖完全正確。

使用者隨後糾正：應用編輯器素材重建，不應裁原圖圖塊。因此已移除圖塊渲染器、素材圖片載入及像素外觀切換；所有地圖共用編輯器 Canvas 素材。`output/playwright/rocket-replica.png` 是舊裁圖版本的歷史截圖，不代表目前外觀。保留格子資料、碰撞與滑行引擎。

下一步是核對被標籤遮住的格子，並請使用者驗收復刻布局及實際試玩。使用者最新指示優先。不要因長期批量生成目標而跳過目前的復刻驗收。

如需瀏覽器自動化，先遵守當前環境的 Playwright 技能。此開發階段曾使用 `npx --offline --package @playwright/cli playwright-cli -s=maze ...` 操作已安裝 CLI；新環境不能假設快取、瀏覽器或 session 存在，先檢查。Windows 可能需要對瀏覽器啟動與下載套件取得環境權限。瀏覽器測試輸出放 `output/playwright/`，工具狀態放 `.playwright-cli/`，兩者皆已加入 gitignore。

### Windows 瀏覽器恢復紀錄（2026-10-27）

- `npx --offline` 報 `ENOTCACHED` 不代表 CLI 檔案不存在。本機已確認可用的入口為 `C:/Users/a23034/AppData/Local/npm-cache/_npx/31e32ef8478fbf80/node_modules/@playwright/cli/playwright-cli.js`；路徑失效時重新搜尋 npm `_npx`，不要直接認定需重新安裝。
- 可直接執行 `node <上述入口> -s=maze open http://127.0.0.1:5173/ --headed`，網址仍以 Vite 實際輸出為準。
- 啟動會寫入工作區外的 `AppData/Local/ms-playwright/daemon`，本次需使用 `require_escalated`。啟動後的 snapshot、screenshot 等命令也需使用相同權限環境；沙箱內連線可能誤報 Browser 'maze' is not open。
- 已實際開啟 Chrome、讀取頁面快照並取得 `output/playwright/browser-restored.png`。未清除瀏覽器資料。當次 CUA 瀏覽器清單為空，故使用既有 Playwright CLI。

2026-10-27：依使用者要求改為 `data/` JSON 匯入工作流，移除復刻專用面板及網頁預設復刻資料，保留既有自動儲存與通用標記顯示。復刻布局未變，22 格仍待核對。

2026-10-27：依使用者要求新增十個獨立 19 × 19 挑戰關卡，位於 data/challenge-19x19/level-01.json 至 level-10.json，沒有教學或難度遞增順序。使用通用匯入及試玩；npm run validate:challenges 驗證尺寸、外框、路線重播、必須滑行、無可達循環及所有可達停止點均能到出口。這是另行要求的挑戰關卡組，未修改火箭隊復刻資料；尚待使用者遊玩回饋，不能以可解宣稱好玩。

2026-10-27 素材更新（較新使用者指示）：使用者另提供 300 × 206 像素地圖並要求使用該套素材。原檔未修改，保留於 public/assets/hideout-tiles-source.png；src/tileArtwork.ts 定義乾淨地板、牆、障礙、四向箭頭與停止格的來源座標，由 Canvas drawImage 逐格取樣，禁用平滑，筆刷縮圖同步使用同一組座標。此授權取代先前對新素材的裁圖限制，但未使用原 480 × 352 復刻圖作圖塊，未將整張圖鋪成地圖，未更動任何地圖 JSON 或引擎規則。素材載入失敗時退回基本圖示並顯示通知。

2026-10-27 素材清晰度修正：使用者指定 Spriters Resource asset/3734，已由正常下載連結取得 1736 × 576 原始 PNG，存為 public/assets/rocket-hideout-frlg.png，來源與上傳者 FrenchOrange 記於 public/assets/README.md。使用對齊的 16 × 16 圖塊及 32 × 32 障礙，取代已縮小模糊的 300 × 206 截圖。舊截圖保留但不再載入。畫布與 CSS 禁用影像平滑；切換 atlas 路徑時需重新載入圖像。

2026-10-27：依使用者要求，wall 與 block 統一使用原尺寸圖集的同一張 32 × 32 方塊障礙圖片（640,168），畫布及筆刷預覽共用；地形類型與碰撞規則不變。
