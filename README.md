# Maze Lab · 迷宮設計實驗室

純前端 React + TypeScript + Vite 編輯器。Canvas 地圖支援普通地板、牆壁、藍框障礙、四向箭頭、停止格、一個入口及多個出口。含即時尋路、試玩、本機 IndexedDB 自動儲存、JSON 匯入匯出、縮放及復原／重做。

## 火箭隊總部復刻

以使用者提供的 480 × 352 參考圖為目標，按 16px 原始格線轉錄為 30 × 22 地圖。地圖統一放在 `data/`，目前復刻草稿為 `data/rocket-hideout.json`。頁首「匯入」選擇此檔即可編輯與試玩；不再提供復刻專用面板或載入按鈕。既有瀏覽器資料優先載入，沒有儲存資料時開空白地圖。

原圖存於 `public/reference/rocket-hideout.png`，可獨立開啟核對。地圖使用編輯器自己的素材。右側顯示選項可切換 JSON 中的地點標記及待核對格。

Moon Stone、TM07、Super Potion 的標籤遮住共 22 格，已在 `review` 列出推定位置；需要無標註原圖或實機資料才能最終核對。人物、道具和樓梯是參考標記，沒有事件碰撞或跨樓層行為。測試用 In 暫設在樓梯 (4)，Out 為樓梯 (1)、(2) 與電梯，可用編輯工具重新指定。

`npm run --silent reference` 將復刻地圖 JSON 輸出至 stdout，供其他程式批量讀取或存檔。

## 啟動

```sh
npm install
npm run dev
```

開啟終端顯示的本機網址。`npm run build` 產生可部署的靜態檔案；`npm test` 驗證移動與尋路規則。

## 操作

左側選筆刷，拖曳繪製。入口工具移動唯一入口；出口工具新增出口，刪除出口工具移除標記。入口／出口所在格禁止畫牆，須先移動或移除標記。放置端點會將該格轉成普通地板，之後仍可畫上箭頭或停止格。右側選出口查看路線；實線為自由步行，虛線為強制滑行。滑行第一步踩入箭頭屬於自由步行。

地圖區的捲軸或觸控板用於平移；工具列調整縮放。Ctrl/Cmd+Z 復原，Ctrl/Cmd+Shift+Z 重做。試玩時以方向鍵、WASD 或畫面按鍵移動；滑行循環會鎖住操作，按「從入口重來」恢復。

## 規則

- 普通地板自由四向移動；踏入箭頭開始強制滑行，遇到其他箭頭轉向。
- 滑行通過普通地板，遇停止格停止；前方牆壁或地圖邊界使角色停在最後的可站立格。
- 停止後可自由移動，即使停在箭頭上也不會自動重新觸發。
- 必須停在出口才算抵達；每個出口獨立分析。
- BFS 求最少方向鍵操作次數；一段完整強制滑行算同一次操作。不是最少行經格數。
- 偵測重複的「座標＋滑行方向」以排除循環。循環數表示可達停止位置發出的循環操作數，不是不同循環的數目。

## Codex 操作入口

規則引擎在 `src/engine.ts`，不依賴 React 或瀏覽器。可呼叫 `blank`、`demo`、`parseMaze`、`move`、`analyze` 建圖、試解與評估。批量生成器可直接匯入這些函式。

```sh
npm run analyze -- path/to/maze.json
```

可先用 `npm run analyze -- examples/arrow-corridor.json` 試跑；此範例需兩次向右操作，第一步會連鎖滑行轉向，再停在停止格。

分析結果輸出 JSON，含各出口可達性、最短操作序列、逐格軌跡、滑行標記、可停留位置及循環操作數。CLI 格式錯誤以非零結束；無解地圖仍輸出完整分析，由呼叫端判定篩選條件。

JSON v1 結構：

```ts
{
  version: 1,
  name: string,
  width: number,  // 5–100
  height: number, // 5–100
  tiles: ('floor'|'wall'|'block'|'up'|'right'|'down'|'left'|'stop')[],
  entrance: { x: number, y: number },
  exits: { id: string, x: number, y: number }[]
  // Optional: appearance: 'rocket', markers: {x,y,label,kind}[], review: {x,y,reason}[]
}
```

座標從左上角 (0,0) 開始，tiles 以 `y * width + x` 索引。出口 ID 必須唯一，端點必須位於地圖內非牆壁格。生成檔案後在網頁匯入，即可編輯或試玩。地圖資料只保存在本機瀏覽器，請匯出 JSON 作為長期備份。

本版不包含自動批量生成、遊戲性評分、多樓層或地圖庫；先建立共用規則與人機均可使用的編輯／試玩入口。
