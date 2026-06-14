# RailwayFengBroAI

鋒兄設定是一個 Railway 連線檢查小工具。使用者可以在同一個介面選擇 MongoDB、Postgres、MySQL 或 Railway Bucket，輸入 credentials 後測試連線狀態。

## 功能

- MongoDB：使用 connection string 執行 `ping`
- Postgres：使用 connection string 執行 `select version()`
- MySQL：使用 connection string 執行 `select version()`
- Bucket：使用 S3-compatible credentials 執行 `HeadBucket`
- 本機保存設定到瀏覽器 localStorage
- Railway 風格深色設定頁與手機版響應式版面

## 開發

```bash
npm install
npm run build
npm start
```

預設服務會跑在 `http://localhost:3000`。Railway 部署時請使用 `npm run build` 作為 build command，`npm start` 作為 start command。
