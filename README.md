# RailwayFengBroAI

鋒兄設定是一個 Railway 連線檢查小工具。使用者可以在同一個介面選擇 MongoDB、Postgres、MySQL 或 Railway Bucket，輸入 credentials 後測試連線狀態。

## 功能

- MongoDB：使用 connection string 執行 `ping`
- Postgres：使用 connection string 執行 `select version()`
- MySQL：使用 connection string 執行 `select version()`
- Bucket：使用 S3-compatible credentials 執行 `HeadBucket`
- 部署時可直接使用 Railway Variables，不必在前端輸入 secrets
- 本機保存設定到瀏覽器 localStorage
- Railway 風格深色設定頁與手機版響應式版面

## 部署環境變數

在 Railway 的 service variables 內設定需要的連線資訊。前端勾選「使用部署環境變數」後，後端會直接從 `process.env` 讀取以下變數，不會把 secrets 傳到瀏覽器。

MongoDB：
- `MONGO_PUBLIC_URL` 或 `MONGO_URL`
- `MONGO_DATABASE`，選填，預設 `admin`
- `MONGO_AUTH_SOURCE`，選填

Postgres：
- `DATABASE_PUBLIC_URL`、`DATABASE_URL`、`POSTGRES_PUBLIC_URL` 或 `POSTGRES_URL`
- `PGDATABASE` 或 `POSTGRES_DB`，選填
- `DATABASE_SSL` 或 `POSTGRES_SSL`，選填，建議 Railway public URL 使用 `true`

MySQL：
- `MYSQL_PUBLIC_URL` 或 `MYSQL_URL`
- `MYSQL_DATABASE` 或 `MYSQLDATABASE`，選填
- `MYSQL_SSL`，選填

Bucket / S3-compatible storage：
- `BUCKET_ENDPOINT`
- `BUCKET_REGION`
- `BUCKET_NAME`
- `BUCKET_ACCESS_KEY_ID`
- `BUCKET_SECRET_ACCESS_KEY`

也支援 S3/AWS 別名：`S3_ENDPOINT`、`S3_REGION`、`S3_BUCKET`、`S3_ACCESS_KEY_ID`、`S3_SECRET_ACCESS_KEY`、`AWS_ENDPOINT_URL`、`AWS_REGION`、`AWS_BUCKET_NAME`、`AWS_ACCESS_KEY_ID`、`AWS_SECRET_ACCESS_KEY`。

可參考 [.env.example](./.env.example)。

## 開發

```bash
npm install
npm run build
npm start
```

預設服務會跑在 `http://localhost:3000`。Railway 部署時請使用 `npm run build` 作為 build command，`npm start` 作為 start command。
