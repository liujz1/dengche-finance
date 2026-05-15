export function parseShanghaiDateInput(value: string): Date {
  return new Date(`${value}T00:00:00.000+08:00`);
}
