"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";

export type EarningsChartPoint = {
  date: string;
} & Record<string, number | string>;

type EarningsChartProps = {
  data: EarningsChartPoint[];
};

const projectColors = [
  "#2563eb",
  "#16a34a",
  "#f97316",
  "#db2777",
  "#7c3aed",
  "#0891b2",
];

const currencyFormatter = new Intl.NumberFormat("zh-CN", {
  style: "currency",
  currency: "CNY",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

function formatDateTick(value: string) {
  const [, month, day] = value.split("-");
  return month && day ? `${month}-${day}` : value;
}

function formatYuan(value: number) {
  return currencyFormatter.format(value);
}

function ChartTooltip({
  active,
  label,
  payload,
}: TooltipContentProps) {
  if (!active || !payload?.length) {
    return null;
  }

  const orderedPayload = [...payload].sort((left, right) => {
    if (left.dataKey === "总计") {
      return -1;
    }

    if (right.dataKey === "总计") {
      return 1;
    }

    return String(left.dataKey).localeCompare(String(right.dataKey), "zh-CN");
  });

  return (
    <div className="min-w-40 rounded-lg border bg-popover p-3 text-sm shadow-md">
      <div className="mb-2 font-medium text-popover-foreground">{label}</div>
      <div className="space-y-1">
        {orderedPayload.map((item) => (
          <div
            key={String(item.dataKey)}
            className="flex items-center justify-between gap-6"
          >
            <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="truncate">{item.name}</span>
            </span>
            <span className="font-medium tabular-nums text-foreground">
              {formatYuan(Number(item.value ?? 0))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function EarningsChart({ data }: EarningsChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex min-h-72 items-center justify-center rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        暂无数据，等老板审核第一笔录入后这里会有曲线
      </div>
    );
  }

  const lineKeys = Array.from(
    new Set(data.flatMap((point) => Object.keys(point).filter((key) => key !== "date")))
  );
  const projectKeys = lineKeys.filter((key) => key !== "总计");

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%" minHeight={320}>
        <LineChart
          data={data}
          margin={{
            top: 16,
            right: 20,
            bottom: 8,
            left: 8,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatDateTick}
            tickLine={false}
            axisLine={false}
            minTickGap={24}
            tickMargin={10}
          />
          <YAxis
            tickFormatter={(value) => `¥${Number(value).toLocaleString("zh-CN")}`}
            tickLine={false}
            axisLine={false}
            tickMargin={10}
            width={72}
          />
          <Tooltip content={(props) => <ChartTooltip {...props} />} />
          {projectKeys.map((key, index) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={projectColors[index % projectColors.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              isAnimationActive="auto"
            />
          ))}
          {lineKeys.includes("总计") ? (
            <Line
              type="monotone"
              dataKey="总计"
              stroke="#111827"
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 5 }}
              isAnimationActive="auto"
            />
          ) : null}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
