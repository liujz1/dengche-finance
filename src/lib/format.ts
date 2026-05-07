import type { EntryType } from "@/generated/prisma/enums";

const yuanFormatter = new Intl.NumberFormat("zh-CN", {
  style: "currency",
  currency: "CNY",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function formatYuan(cents: number): string {
  return yuanFormatter.format(cents / 100);
}

export function formatDate(d: Date): string {
  return dateFormatter.format(d).replaceAll("/", "-");
}

export function entryTypeLabel(type: EntryType): string {
  switch (type) {
    case "INCOME":
      return "收入";
    case "EXPENSE":
      return "支出";
    case "TRANSFER":
      return "转账";
    case "PROXY_RECEIVE":
      return "代收";
    case "PROXY_PAY":
      return "代付";
  }
}
