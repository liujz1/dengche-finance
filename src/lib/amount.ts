import { EntryType } from "@/generated/prisma/enums";

export type EntryAmount = {
  type: EntryType;
  amountCents: number;
};

export function isProfitIncomeEntryType(type: EntryType): boolean {
  return type === EntryType.INCOME;
}

export function isProfitExpenseEntryType(type: EntryType): boolean {
  return type === EntryType.EXPENSE || type === EntryType.PROXY_PAY;
}

export function isProfitEntryType(type: EntryType): boolean {
  return isProfitIncomeEntryType(type) || isProfitExpenseEntryType(type);
}

export function signedProfitAmountCents(entry: EntryAmount): number {
  if (isProfitIncomeEntryType(entry.type)) {
    return entry.amountCents;
  }

  if (isProfitExpenseEntryType(entry.type)) {
    return -entry.amountCents;
  }

  return 0;
}

export function signedDisplayAmountCents(entry: EntryAmount): number {
  if (isProfitExpenseEntryType(entry.type)) {
    return -entry.amountCents;
  }

  return entry.amountCents;
}
