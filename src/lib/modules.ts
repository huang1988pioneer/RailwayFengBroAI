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

const mediaFields = (kind: string): FieldDef[] => [
  { key: "title", label: "標題", required: true },
  { key: "description", label: "描述", type: "textarea", wide: true },
  { key: "url", label: "外部 URL", type: "url" },
  { key: "file", label: `${kind}檔案`, type: "file", wide: true },
  { key: "bucketUrl", label: "Bucket URL", type: "url", wide: true },
  { key: "category", label: "分類" },
  { key: "createdAt", label: "建立日期", type: "date" },
];

export const MODULES: ModuleDef[] = [
  {
    id: "home",
    label: "鋒兄首頁",
    subtitle: "總覽與快速入口",
    icon: Home,
    csvHeaders: [],
    fields: [],
  },
  {
    id: "subscription",
    label: "鋒兄訂閱",
    subtitle: "扣款、續訂、帳號與提醒",
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
    subtitle: "食品效期與商品庫存",
    icon: Package,
    csvHeaders: ["name", "amount", "todate", "photo", "price", "shop", "photohash"],
    fields: [
      { key: "name", label: "名稱", required: true },
      { key: "amount", label: "庫存數量", type: "number" },
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
    subtitle: "文章、想法與附件",
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
    subtitle: "常用帳號與站台清單",
    icon: Star,
    csvHeaders: ["name", ...Array.from({ length: 37 }, (_, index) => [`site${String(index + 1).padStart(2, "0")}`, `note${String(index + 1).padStart(2, "0")}`]).flat()],
    fields: [
      { key: "name", label: "帳號 / 名稱", required: true },
      ...Array.from({ length: 10 }, (_, index) => [
        { key: `site${String(index + 1).padStart(2, "0")}`, label: `站台 ${index + 1}` },
        { key: `note${String(index + 1).padStart(2, "0")}`, label: `備註 ${index + 1}` },
      ]).flat(),
    ],
  },
  { id: "images", label: "鋒兄圖片", subtitle: "圖片 Bucket 與外部圖庫", icon: Image, csvHeaders: ["title", "description", "url", "bucketUrl", "category", "createdAt"], fields: mediaFields("圖片"), kind: "media" },
  { id: "videos", label: "鋒兄影片", subtitle: "影片 Bucket 與播放清單", icon: Video, csvHeaders: ["title", "description", "url", "bucketUrl", "category", "createdAt"], fields: mediaFields("影片"), kind: "media" },
  { id: "music", label: "鋒兄音樂", subtitle: "音樂、歌詞與音訊檔", icon: Music, csvHeaders: ["title", "description", "url", "bucketUrl", "category", "createdAt"], fields: mediaFields("音樂"), kind: "media" },
  { id: "documents", label: "鋒兄文件", subtitle: "文件與附件管理", icon: FileText, csvHeaders: ["title", "description", "url", "bucketUrl", "category", "createdAt"], fields: mediaFields("文件"), kind: "media" },
  { id: "podcast", label: "鋒兄播客", subtitle: "Podcast 與音訊節目", icon: Headphones, csvHeaders: ["title", "description", "url", "bucketUrl", "category", "createdAt"], fields: mediaFields("播客"), kind: "media" },
  {
    id: "bank",
    label: "鋒兄銀行",
    subtitle: "銀行帳戶與電子票證",
    icon: Banknote,
    csvHeaders: ["name", "deposit", "site", "address", "withdrawals", "transfer", "activity", "card", "account"],
    fields: [
      { key: "name", label: "名稱", required: true },
      { key: "deposit", label: "餘額", type: "number" },
      { key: "site", label: "網站", type: "url" },
      { key: "address", label: "地址" },
      { key: "withdrawals", label: "提款次數", type: "number" },
      { key: "transfer", label: "轉帳次數", type: "number" },
      { key: "activity", label: "活動 URL", type: "url", wide: true },
      { key: "card", label: "卡片" },
      { key: "account", label: "帳號" },
    ],
  },
  {
    id: "routine",
    label: "鋒兄例行",
    subtitle: "固定週期、保養與回診",
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
    subtitle: "工具總覽與自訂工具",
    icon: Wrench,
    csvHeaders: ["name", "description", "url", "category", "note"],
    fields: [
      { key: "name", label: "工具名稱", required: true },
      { key: "description", label: "描述", type: "textarea", wide: true },
      { key: "url", label: "URL", type: "url" },
      { key: "category", label: "分類" },
      { key: "note", label: "備註", type: "textarea", wide: true },
    ],
    kind: "tool",
  },
  { id: "priceCompare", parent: "tools", label: "鋒兄比價", subtitle: "商品價格追蹤", icon: GalleryHorizontalEnd, csvHeaders: ["name", "site", "price", "currency", "checkedAt", "note"], fields: [
    { key: "name", label: "商品", required: true }, { key: "site", label: "網址", type: "url", wide: true }, { key: "price", label: "價格", type: "number" }, { key: "currency", label: "幣別" }, { key: "checkedAt", label: "查價日期", type: "date" }, { key: "note", label: "備註", type: "textarea", wide: true },
  ], kind: "tool" },
  { id: "phoneCompare", parent: "tools", label: "手機比價", subtitle: "手機規格與價格", icon: BookOpenText, csvHeaders: ["name", "site", "price", "storage", "carrier", "checkedAt", "note"], fields: [
    { key: "name", label: "手機", required: true }, { key: "site", label: "網址", type: "url", wide: true }, { key: "price", label: "價格", type: "number" }, { key: "storage", label: "容量" }, { key: "carrier", label: "通路" }, { key: "checkedAt", label: "查價日期", type: "date" }, { key: "note", label: "備註", type: "textarea", wide: true },
  ], kind: "tool" },
  { id: "tube", parent: "tools", label: "鋒兄Tube", subtitle: "影音頻道與收藏", icon: Video, csvHeaders: ["title", "channel", "url", "category", "note"], fields: [
    { key: "title", label: "標題", required: true }, { key: "channel", label: "頻道" }, { key: "url", label: "URL", type: "url", wide: true }, { key: "category", label: "分類" }, { key: "note", label: "備註", type: "textarea", wide: true },
  ], kind: "tool" },
  { id: "finance", parent: "tools", label: "鋒兄金融", subtitle: "金融工具與追蹤", icon: Banknote, csvHeaders: ["name", "symbol", "site", "price", "currency", "note"], fields: [
    { key: "name", label: "名稱", required: true }, { key: "symbol", label: "代號" }, { key: "site", label: "URL", type: "url", wide: true }, { key: "price", label: "價格", type: "number" }, { key: "currency", label: "幣別" }, { key: "note", label: "備註", type: "textarea", wide: true },
  ], kind: "tool" },
  { id: "settings", label: "鋒兄設定", subtitle: "後端、Bucket 與匯入匯出設定", icon: Settings, csvHeaders: ["key", "value", "note"], fields: [
    { key: "key", label: "設定鍵", required: true }, { key: "value", label: "設定值", type: "textarea", wide: true }, { key: "note", label: "備註", type: "textarea", wide: true },
  ], kind: "settings" },
  { id: "about", label: "鋒兄關於", subtitle: "系統資訊與說明", icon: Info, csvHeaders: ["title", "content", "updatedAt"], fields: [
    { key: "title", label: "標題", required: true }, { key: "content", label: "內容", type: "textarea", wide: true }, { key: "updatedAt", label: "更新日期", type: "date" },
  ], kind: "settings" },
];

export const DATA_MODULES = MODULES.filter((module) => module.id !== "home");

export function getModule(id: string) {
  return DATA_MODULES.find((module) => module.id === id) ?? DATA_MODULES[0];
}

export function getPrimaryField(module: ModuleDef) {
  return module.fields.find((field) => field.required)?.key ?? module.csvHeaders[0] ?? "name";
}
