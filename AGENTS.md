# Maze Lab — Codex 接續入口

## 產品目標與目前方向

這是給使用者與 Codex 共用的純前端迷宮編輯／試玩工具。長期目標是 Codex 批量製作、驗證、篩選迷宮，讓使用者試玩並回饋遊戲性。

**目前優先以 `public/reference/rocket-hideout.png` 的火箭隊總部迷宮為復刻目標。** 不要將一般隨機迷宮或額外地形當作已確認需求。使用者明確糾正過：滑行踩停止格或撞牆都會停止。

**地圖布局與碰撞必須由 JSON 與共用引擎控制，禁止將整張來源圖片鋪成地圖。** 原 480 × 352 復刻圖仍只作獨立對照。使用者於 2026-10-27 另提供 300 × 206 圖片並明確要求使用該套素材，因此目前使用原尺寸 1736 × 576 圖集，允許從 `public/assets/rocket-hideout-frlg.png` 取用乾淨圖塊作通用外觀；座標定義在 `src/tileArtwork.ts`，適用所有地圖。這是新的使用者授權，取代先前對此新素材的裁圖限制，不影響機關規則。

開始工作先閱讀 [Codex 操作手冊](docs/CODEX_OPERATIONS.md)。這份文件是工具入口、資料格式及接續工作的依據；功能入口或規則變更時同步更新。

## 快速入口

- 安裝：`npm install`
- 啟動：`npm run dev`；預設 `http://127.0.0.1:5173/`，以終端實際網址為準。
- 驗證：`npm test`、`npm run build`
- 分析 JSON：`npm run --silent analyze -- examples/arrow-corridor.json`
- 輸出復刻 JSON：`npm run --silent reference`
- 共用引擎：`src/engine.ts`；復刻配置：`data/rocket-hideout.json`；`src/rocketHideout.ts` 僅供 CLI／測試讀取 JSON。

Codex 優先透過 TypeScript 引擎與 JSON 操作地圖；瀏覽器用於檢查編輯器、對照原圖及試玩。不要為批量建圖逐格點滑鼠。

## 必須維持的規則

- 普通地板可自由四向移動；踩進箭頭後沿箭頭方向強制滑行；途中箭頭會轉向。
- 滑過普通地板繼續前進。踩停止格在該格停止；前方牆壁、藍框障礙或地圖邊界使角色停在最後可站立格。
- 停下後可以自由選方向，即使停在箭頭格也不原地自動重新觸發。
- 滑行循環按「座標＋方向」偵測，不能讓求解器無限執行。
- 編輯、求解、試玩使用同一個引擎，不可各自實作不同規則。
- 本版暫採：每個 Out 獨立求解、停在 Out 才成功、BFS 最少操作次數。這些是第一版設計選擇，不要說成使用者已逐項確認的遊戲原版規則。

## 復刻邊界與資料保護

- 原圖為 480 × 352，格線 16px，地圖 30 × 22。
- 原圖彩色／黑色路線是註記，不是地形。
- 22 個被文字遮住的格子在 `review` 列出；未核對前不得宣稱完全還原。
- 樓梯 (4) 暫作 In；樓梯 (1)、(2)、電梯作 Out。道具、NPC、樓梯目前只作參考標記，沒有跨樓層與事件碰撞。
- 已存在的 IndexedDB 地圖優先載入。地圖統一放 `data/`，看不到新復刻圖時用頁首「匯入」選取 `data/rocket-hideout.json`，不要刪使用者的瀏覽器資料。
- 保留既有使用者檔案與修改；尤其 `.idea`、`.iml` 不是本次建立的應用程式檔案。
- 若 Windows Git 報 dubious ownership，可對單次命令使用 `git -c safe.directory=C:/work/maze-maker/maze-maker ...`，不要擅改全域 Git 設定。
