# 地圖 JSON

地圖統一放在此資料夾，透過編輯器頁首「匯入」選取 JSON，載入後即可編輯、求解及試玩。匯出後可將檔案存回此資料夾。

- `rocket-hideout.json`：火箭隊總部復刻草稿，30 × 22 格；22 格仍待核對。
- 原圖保留在 `public/reference/rocket-hideout.png`，僅供獨立查看與核對。

新增或修正地圖直接編輯 JSON，再以 `npm run --silent analyze -- data/rocket-hideout.json` 驗證。網頁優先載入瀏覽器已儲存的地圖；沒有儲存資料時顯示空白地圖。
