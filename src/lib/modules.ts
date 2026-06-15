import {
  Banknote,
  BookOpenText,
  CalendarClock,
  FileText,
  GalleryHorizontalEnd,
  Headphones,
  Home,
  Image,
  Info,
  ListChecks,
  Music,
  NotebookText,
  Package,
  Settings,
  Star,
  Video,
  Wrench,
} from "lucide-react";
import type { ComponentType } from "react";

export type FieldType = "text" | "textarea" | "number" | "date" | "datetime" | "url" | "boolean" | "file";

export type FieldDef = {
  key: string;
  label: string;
  type?: FieldType;
  required?: boolean;
  wide?: boolean;
  accept?: string;
};

export type ModuleDef = {
  id: string;
  label: string;
  subtitle: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  csvHeaders: string[];
  fields: FieldDef[];
  kind?: "media" | "tool" | "settings";
  parent?: string;
};

const mediaAccept: Record<string, string> = {
  image: "image/*",
  video: "video/*",
  audio: "audio/*",
  document: ".pdf,.txt,.md,.csv,.json,.doc,.docx,.xls,.xlsx,.ppt,.pptx,image/*",
};

const mediaFields = (kind: string, accept?: string): FieldDef[] => [
  { key: "title", label: "標題", required: true },
  { key: "description", label: "描述", type: "textarea", wide: true },
  { key: "url", label: "來源 URL", type: "url" },
  { key: "file", label: `${kind}檔案`, type: "file", accept, wide: true },
  { key: "bucketUrl", label: "Bucket URL", wide: true },
  { key: "category", label: "分類" },
  { key: "createdAt", label: "建立日期", type: "date" },
];

const toolHistoryHeaders = [
  "toolType",
  "queryText",
  "title",
  "source",
  "currentPrice",
  "highPrice",
  "lowPrice",
  "currency",
  "resultUrl",
  "notice",
  "checkedAt",
];

const toolHistoryFields = (queryLabel: string): FieldDef[] => [
  { key: "queryText", label: queryLabel, required: true, wide: true },
  { key: "title", label: "標題 / 商品 / 內容名稱", wide: true },
  { key: "source", label: "來源" },
  { key: "currentPrice", label: "目前價格 / 數值", type: "number" },
  { key: "highPrice", label: "最高價格 / 高點", type: "number" },
  { key: "lowPrice", label: "最低價格 / 低點", type: "number" },
  { key: "currency", label: "幣別" },
  { key: "resultUrl", label: "結果 URL", type: "url", wide: true },
  { key: "notice", label: "備註 / 警示", type: "textarea", wide: true },
  { key: "checkedAt", label: "查詢日期", type: "datetime" },
];

export const MODULES: ModuleDef[] = [
  {
    id: "home",
    label: "鋒兄首頁",
    subtitle: "總覽與工具入口",
    icon: Home,
    csvHeaders: [],
    fields: [],
  },
  {
    id: "subscription",
    label: "鋒兄訂閱",
    subtitle: "訂閱項目、週期與續約提醒",
    icon: CalendarClock,
    csvHeaders: ["name", "site", "price", "nextdate", "note", "account", "currency", "continue"],
    fields: [
      { key: "name", label: "名稱", required: true },
      { key: "site", label: "網站", type: "url" },
      { key: "price", label: "價格", type: "number" },
      { key: "nextdate", label: "下次日期", type: "date" },
      { key: "note", label: "備註", type: "textarea", wide: true },
      { key: "account", label: "帳號" },
      { key: "currency", label: "幣別" },
      { key: "continue", label: "持續訂閱", type: "boolean" },
    ],
  },
  {
    id: "food",
    label: "鋒兄食品",
    subtitle: "食品、庫存、到期日與照片",
    icon: Package,
    csvHeaders: ["name", "amount", "todate", "photo", "price", "shop", "photohash"],
    fields: [
      { key: "name", label: "名稱", required: true },
      { key: "amount", label: "數量", type: "number" },
      { key: "todate", label: "到期日", type: "datetime" },
      { key: "photo", label: "照片 URL", type: "url", wide: true },
      { key: "photoFile", label: "上傳食品照片", type: "file", accept: "image/*", wide: true },
      { key: "price", label: "價格", type: "number" },
      { key: "shop", label: "商店" },
      { key: "photohash", label: "照片 Hash" },
    ],
  },
  {
    id: "notes",
    label: "鋒兄筆記",
    subtitle: "文字、連結與附件筆記",
    icon: NotebookText,
    csvHeaders: [
      "title",
      "content",
      "category",
      "newDate",
      "url1",
      "url2",
      "url3",
      "file1",
      "file1name",
      "file1type",
      "file2",
      "file2name",
      "file2type",
      "file3",
      "file3name",
      "file3type",
    ],
    fields: [
      { key: "title", label: "標題", required: true },
      { key: "content", label: "內容", type: "textarea", wide: true },
      { key: "category", label: "分類" },
      { key: "newDate", label: "日期", type: "date" },
      { key: "url1", label: "URL 1", type: "url" },
      { key: "url2", label: "URL 2", type: "url" },
      { key: "url3", label: "URL 3", type: "url" },
      { key: "file1", label: "附件 1", type: "file", wide: true },
      { key: "file2", label: "附件 2", type: "file", wide: true },
      { key: "file3", label: "附件 3", type: "file", wide: true },
    ],
  },
  {
    id: "common",
    label: "鋒兄常用",
    subtitle: "常用帳號、網站與備註",
    icon: Star,
    csvHeaders: ["name", ...Array.from({ length: 37 }, (_, index) => [`site${String(index + 1).padStart(2, "0")}`, `note${String(index + 1).padStart(2, "0")}`]).flat()],
    fields: [
      { key: "name", label: "帳號 / 名稱", required: true },
      ...Array.from({ length: 10 }, (_, index) => [
        { key: `site${String(index + 1).padStart(2, "0")}`, label: `網站 ${index + 1}` },
        { key: `note${String(index + 1).padStart(2, "0")}`, label: `備註 ${index + 1}` },
      ]).flat(),
    ],
  },
  { id: "images", label: "鋒兄圖片", subtitle: "圖片 Bucket 與來源管理", icon: Image, csvHeaders: ["title", "description", "url", "bucketUrl", "category", "createdAt"], fields: mediaFields("圖片", mediaAccept.image), kind: "media" },
  { id: "videos", label: "鋒兄影片", subtitle: "影片 Bucket 與來源管理", icon: Video, csvHeaders: ["title", "description", "url", "bucketUrl", "category", "createdAt"], fields: mediaFields("影片", mediaAccept.video), kind: "media" },
  { id: "music", label: "鋒兄音樂", subtitle: "音樂與音訊素材管理", icon: Music, csvHeaders: ["title", "description", "url", "bucketUrl", "category", "createdAt"], fields: mediaFields("音樂", mediaAccept.audio), kind: "media" },
  { id: "documents", label: "鋒兄文件", subtitle: "文件、資料與連結管理", icon: FileText, csvHeaders: ["title", "description", "url", "bucketUrl", "category", "createdAt"], fields: mediaFields("文件", mediaAccept.document), kind: "media" },
  { id: "podcast", label: "鋒兄Podcast", subtitle: "Podcast 內容與音訊管理", icon: Headphones, csvHeaders: ["title", "description", "url", "bucketUrl", "category", "createdAt"], fields: mediaFields("Podcast", mediaAccept.audio), kind: "media" },
  {
    id: "bank",
    label: "鋒兄銀行",
    subtitle: "銀行、餘額、轉帳提款優惠",
    icon: Banknote,
    csvHeaders: ["name", "deposit", "site", "address", "withdrawals", "transfer", "activity", "card", "account"],
    fields: [
      { key: "name", label: "名稱", required: true },
      { key: "deposit", label: "存款", type: "number" },
      { key: "site", label: "網站", type: "url" },
      { key: "address", label: "地址" },
      { key: "withdrawals", label: "提款次數", type: "number" },
      { key: "transfer", label: "轉帳次數", type: "number" },
      { key: "activity", label: "活動 URL", type: "url", wide: true },
      { key: "card", label: "金融卡" },
      { key: "account", label: "帳號" },
    ],
  },
  {
    id: "routine",
    label: "鋒兄例行",
    subtitle: "例行事項、日期與連結",
    icon: ListChecks,
    csvHeaders: ["name", "note", "lastdate1", "lastdate2", "lastdate3", "link", "photo"],
    fields: [
      { key: "name", label: "名稱", required: true },
      { key: "note", label: "備註", type: "textarea", wide: true },
      { key: "lastdate1", label: "日期 1", type: "datetime" },
      { key: "lastdate2", label: "日期 2", type: "datetime" },
      { key: "lastdate3", label: "日期 3", type: "datetime" },
      { key: "link", label: "連結", type: "url", wide: true },
      { key: "photo", label: "照片 URL", type: "url", wide: true },
    ],
  },
  {
    id: "tools",
    label: "鋒兄工具",
    subtitle: "比價、手機、Tube、金融集中入口",
    icon: Wrench,
    csvHeaders: [],
    fields: [],
    kind: "tool",
  },
  { id: "priceCompare", parent: "tools", label: "鋒兄比價", subtitle: "參考 BigGo、PChome、momo 的商品比價紀錄", icon: GalleryHorizontalEnd, csvHeaders: toolHistoryHeaders, fields: toolHistoryFields("商品網址 / 商品關鍵字"), kind: "tool" },
  { id: "phoneCompare", parent: "tools", label: "手機比價", subtitle: "參考 SOGI 與手機通路的手機價格紀錄", icon: BookOpenText, csvHeaders: toolHistoryHeaders, fields: toolHistoryFields("手機型號 / 3C 關鍵字"), kind: "tool" },
  { id: "tube", parent: "tools", label: "鋒兄Tube", subtitle: "參考 YouTube / Bilibili 的影音追蹤紀錄", icon: Video, csvHeaders: toolHistoryHeaders, fields: toolHistoryFields("頻道、影片或關鍵字"), kind: "tool" },
  { id: "finance", parent: "tools", label: "鋒兄金融", subtitle: "參考 Yahoo Finance、Google Finance、TradingView 的金融紀錄", icon: Banknote, csvHeaders: toolHistoryHeaders, fields: toolHistoryFields("股票代號 / 指數 / 金融關鍵字"), kind: "tool" },
  { id: "settings", label: "鋒兄設定", subtitle: "環境、Bucket 與連線設定", icon: Settings, csvHeaders: ["key", "value", "note"], fields: [
    { key: "key", label: "設定鍵", required: true }, { key: "value", label: "設定值", type: "textarea", wide: true }, { key: "note", label: "備註", type: "textarea", wide: true },
  ], kind: "settings" },
  { id: "about", label: "鋒兄關於", subtitle: "專案資訊與說明", icon: Info, csvHeaders: ["title", "content", "updatedAt"], fields: [
    { key: "title", label: "標題", required: true }, { key: "content", label: "內容", type: "textarea", wide: true }, { key: "updatedAt", label: "更新日期", type: "date" },
  ], kind: "settings" },
];

export const DATA_MODULES = MODULES.filter((module) => module.id !== "home");
export const TOOL_CHILD_MODULES = DATA_MODULES.filter((module) => module.parent === "tools");
export const NAV_MODULES = DATA_MODULES.filter((module) => !module.parent);

export function getModule(id: string) {
  return DATA_MODULES.find((module) => module.id === id) ?? DATA_MODULES[0];
}

export function getPrimaryField(module: ModuleDef) {
  return module.fields.find((field) => field.required)?.key ?? module.csvHeaders[0] ?? "name";
}
