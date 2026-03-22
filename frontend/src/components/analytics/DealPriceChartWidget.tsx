import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { Area, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Link } from "react-router-dom";

import { queryKeys } from "@/api/query-keys";
import { analyticsService } from "@/api/services/analytics";
import { Button } from "@/components/ui/button";
import { CATEGORIES } from "@/lib/data";
import { cn } from "@/lib/utils";

const shortDateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
});

const fullDateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

const CATEGORY_COLORS: Record<string, string> = {
  delivery: "hsl(217, 91%, 60%)",
  moving: "hsl(24, 95%, 60%)",
  cleaning: "hsl(170, 72%, 42%)",
  tech_help: "hsl(275, 70%, 62%)",
  study_help: "hsl(336, 80%, 62%)",
  other: "hsl(220, 9%, 46%)",
};

export interface DealPricePoint {
  taskId: number;
  title: string;
  priceAmount: number;
  completedAt: string;
  category?: string;
  categoryLabel?: string;
  categoryColor?: string;
}

interface DealPriceChartWidgetProps {
  points: DealPricePoint[];
  medianWindow?: number;
  height?: number;
  className?: string;
  emptyTitle?: string;
  emptyDescription?: string;
}

interface CategoryDealPriceChartWidgetProps extends Omit<DealPriceChartWidgetProps, "points" | "emptyTitle" | "emptyDescription"> {
  category: string;
  categoryLabel?: string;
  limit?: number;
}

interface CategoryDealHistoryWidgetProps {
  category: string;
  categoryLabel?: string;
  limit?: number;
  className?: string;
}

interface DealPriceChartRow extends DealPricePoint {
  shortLabel: string;
  fullLabel: string;
  rollingMedian: number;
  categoryMedians: Record<string, number | null>;
}

function calculateMedian(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middleIndex = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return Math.round((sorted[middleIndex - 1] + sorted[middleIndex]) / 2);
  }

  return sorted[middleIndex];
}

function buildChartRows(points: DealPricePoint[], medianWindow: number): DealPriceChartRow[] {
  const safeWindow = Math.max(1, medianWindow);
  const sortedPoints = [...points].sort(
    (left, right) => new Date(left.completedAt).getTime() - new Date(right.completedAt).getTime(),
  );
  const categoryValues = new Map<string, number[]>();

  return sortedPoints.map((point, index) => {
    const windowValues = sortedPoints
      .slice(Math.max(0, index - safeWindow + 1), index + 1)
      .map((item) => item.priceAmount);
    const completedAt = new Date(point.completedAt);
    const categoryMedians: Record<string, number | null> = {};

    if (point.category) {
      const values = categoryValues.get(point.category) ?? [];
      values.push(point.priceAmount);
      categoryValues.set(point.category, values);
    }

    categoryValues.forEach((values, category) => {
      categoryMedians[category] = calculateMedian(values.slice(Math.max(0, values.length - safeWindow)));
    });

    return {
      ...point,
      shortLabel: Number.isNaN(completedAt.getTime()) ? "?" : shortDateFormatter.format(completedAt),
      fullLabel: Number.isNaN(completedAt.getTime()) ? point.completedAt : fullDateFormatter.format(completedAt),
      rollingMedian: calculateMedian(windowValues),
      categoryMedians,
    };
  });
}

function formatCurrency(value: number) {
  return `${Math.round(value).toLocaleString("ru-RU")} ₽`;
}

function formatAxisCurrency(value: number) {
  if (Math.abs(value) >= 1000) {
    return `${Math.round(value / 1000)}k`;
  }

  return `${Math.round(value)}`;
}

function useCategoryDealDataset(category: string, limit: number) {
  const categoryItems = CATEGORIES.filter((item) => item.id !== "all");
  const requestedCategories = category === "all" ? categoryItems : categoryItems.filter((item) => item.id === category);
  const dealsQueries = useQueries({
    queries: requestedCategories.map((item) => ({
      queryKey: queryKeys.analyticsCategoryDeals(item.id, limit),
      queryFn: () => analyticsService.getCategoryDeals(item.id, limit),
      enabled: Boolean(item.id),
    })),
  });

  const points = useMemo(() => {
    const metaById = new Map(categoryItems.map((item) => [item.id, item]));
    const items = dealsQueries.flatMap((query, index) => {
      const queryPoints = query.data?.points ?? [];
      const categoryId = requestedCategories[index]?.id ?? "";
      const meta = metaById.get(categoryId);

      return queryPoints.map((point) => ({
        ...point,
        category: categoryId,
        categoryLabel: meta?.label ?? categoryId,
        categoryColor: CATEGORY_COLORS[categoryId] ?? "hsl(217, 91%, 60%)",
      }));
    });

    return [...items]
      .sort((left, right) => new Date(left.completed_at).getTime() - new Date(right.completed_at).getTime())
      .map((task) => ({
        taskId: task.task_id,
        title: task.title,
        priceAmount: task.price_amount,
        completedAt: task.completed_at,
        category: task.category,
        categoryLabel: task.categoryLabel,
        categoryColor: task.categoryColor,
      }));
  }, [categoryItems, dealsQueries, requestedCategories]);

  return {
    points,
    isLoading: dealsQueries.some((query) => query.isLoading),
    hasAnySuccess: dealsQueries.some((query) => Boolean(query.data)),
    hasOnlyErrors: dealsQueries.length > 0 && dealsQueries.every((query) => query.isError),
    refetchAll: () => {
      dealsQueries.forEach((query) => {
        void query.refetch();
      });
    },
  };
}

function ChartLoadingSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("card-surface p-5 sm:p-6", className)}>
      <div className="space-y-2">
        <div className="h-5 w-48 rounded bg-muted" />
        <div className="h-4 w-72 rounded bg-muted" />
      </div>
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className="h-16 rounded-xl border border-border bg-background/70" />
        ))}
      </div>
      <div className="mt-5 h-[320px] rounded-xl border border-border bg-background/70" />
    </div>
  );
}

function ChartEmptyState({
  title,
  description,
  className,
}: {
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <div className={cn("card-surface p-5 sm:p-6", className)}>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function DealPriceTooltip({
  active,
  payload,
  medianWindow,
}: {
  active?: boolean;
  payload?: Array<{ payload: DealPriceChartRow }>;
  medianWindow: number;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const point = payload[0]?.payload;
  if (!point) {
    return null;
  }

  const medianValue = point.category ? (point.categoryMedians[point.category] ?? point.rollingMedian) : point.rollingMedian;

  return (
    <div className="min-w-56 rounded-lg border border-border bg-background px-3 py-2 text-xs shadow-xl">
      <div className="font-medium text-foreground">{point.title}</div>
      {point.categoryLabel ? (
        <div className="mt-1 flex items-center gap-2 text-muted-foreground">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: point.categoryColor }} />
          <span>{point.categoryLabel}</span>
        </div>
      ) : null}
      <div className="mt-1 text-muted-foreground">{point.fullLabel}</div>
      <div className="mt-2 space-y-1">
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Цена сделки</span>
          <span className="font-medium text-foreground">{formatCurrency(point.priceAmount)}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Медианная цена</span>
          <span className="font-medium text-foreground">{formatCurrency(medianValue)}</span>
        </div>
      </div>
      <div className="mt-2 text-[11px] text-muted-foreground">Расчёт по последним {medianWindow} сделкам</div>
    </div>
  );
}

export function DealPriceChartWidget({
  points,
  medianWindow = 5,
  height = 280,
  className,
  emptyTitle = "Нет данных для графика",
  emptyDescription = "Пока нет завершённых сделок с фиксированной ценой, поэтому график не построен.",
}: DealPriceChartWidgetProps) {
  const chartRows = useMemo(() => buildChartRows(points, medianWindow), [medianWindow, points]);
  const legendItems = useMemo(() => {
    const unique = new Map<string, { label: string; color: string }>();

    chartRows.forEach((point) => {
      if (!point.category || !point.categoryLabel || !point.categoryColor || unique.has(point.category)) {
        return;
      }

      unique.set(point.category, {
        label: point.categoryLabel,
        color: point.categoryColor,
      });
    });

    return Array.from(unique.entries()).map(([category, value]) => ({
      category,
      ...value,
    }));
  }, [chartRows]);
  const hasMultiCategoryView = legendItems.length > 1;
  const medianColor = legendItems[0]?.color ?? "hsl(210, 95%, 72%)";

  if (chartRows.length === 0) {
    return <ChartEmptyState title={emptyTitle} description={emptyDescription} className={className} />;
  }

  return (
    <div className={cn("card-surface p-5 sm:p-6", className)}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-background/70 p-4">
          <div className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Последняя цена</div>
          <div className="mt-2 text-2xl font-semibold text-foreground">
            {chartRows.at(-1) ? formatCurrency(chartRows.at(-1)!.priceAmount) : "—"}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-background/70 p-4">
          <div className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Медианная цена</div>
          <div className="mt-2 text-2xl font-semibold text-foreground">
            {chartRows.at(-1) ? formatCurrency(chartRows.at(-1)!.rollingMedian) : "—"}
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-border bg-background/70 p-4">
        {legendItems.length > 1 ? (
          <div className="mb-4 flex flex-wrap gap-2">
            {legendItems.map((item) => (
              <div key={item.category} className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        ) : null}

        <div style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartRows} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="shortLabel"
                tickLine={false}
                axisLine={false}
                minTickGap={24}
                tick={{ fontSize: 12, fill: "hsl(220, 9%, 46%)" }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={52}
                tickFormatter={formatAxisCurrency}
                tick={{ fontSize: 12, fill: "hsl(220, 9%, 46%)" }}
              />
              <Tooltip content={<DealPriceTooltip medianWindow={medianWindow} />} />
              <defs>
                <linearGradient id="deal-median-gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={medianColor} stopOpacity={0.28} />
                  <stop offset="75%" stopColor={medianColor} stopOpacity={0.08} />
                  <stop offset="100%" stopColor={medianColor} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <Line
                type="linear"
                dataKey="priceAmount"
                stroke="transparent"
                dot={({ cx, cy, payload }) => (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={5}
                    fill={payload.categoryColor ?? "hsl(217, 91%, 60%)"}
                    stroke="hsl(0, 0%, 100%)"
                    strokeWidth={2}
                  />
                )}
                activeDot={({ cx, cy, payload }) => (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={7}
                    fill={payload.categoryColor ?? "hsl(217, 91%, 60%)"}
                    stroke="hsl(0, 0%, 100%)"
                    strokeWidth={2}
                  />
                )}
                isAnimationActive={false}
              />
              {hasMultiCategoryView ? (
                legendItems.map((item) => (
                  <Line
                    key={item.category}
                    type="monotone"
                    dataKey={(row: DealPriceChartRow) => row.categoryMedians[item.category] ?? null}
                    connectNulls
                    stroke={item.color}
                    strokeWidth={2.5}
                    strokeOpacity={0.95}
                    dot={false}
                    activeDot={{ r: 4, fill: item.color }}
                    isAnimationActive={false}
                  />
                ))
              ) : (
                <>
                  <Area
                    type="monotone"
                    dataKey="rollingMedian"
                    stroke="none"
                    fill="url(#deal-median-gradient)"
                    fillOpacity={1}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="rollingMedian"
                    stroke={medianColor}
                    strokeWidth={3}
                    dot={false}
                    activeDot={{ r: 5, fill: medianColor }}
                    isAnimationActive={false}
                  />
                </>
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export function CategoryDealPriceChartWidget({
  category,
  categoryLabel,
  medianWindow = 5,
  height = 280,
  className,
  limit = 24,
}: CategoryDealPriceChartWidgetProps) {
  const { points, isLoading, hasAnySuccess, hasOnlyErrors, refetchAll } = useCategoryDealDataset(category, limit);

  if (isLoading) {
    return <ChartLoadingSkeleton className={className} />;
  }

  if (hasOnlyErrors && !hasAnySuccess) {
    return (
      <div className={cn("card-surface p-5 sm:p-6", className)}>
        <h3 className="text-sm font-semibold text-foreground">График последних сделок</h3>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Не удалось загрузить завершённые сделки{categoryLabel ? ` по категории ${categoryLabel}` : ""}.
        </p>
        <Button className="mt-4" variant="outline" onClick={refetchAll}>
          Повторить
        </Button>
      </div>
    );
  }

  return (
    <DealPriceChartWidget
      points={points}
      medianWindow={medianWindow}
      height={height}
      className={className}
      emptyTitle="Пока недостаточно завершённых сделок"
      emptyDescription={
        category === "all"
          ? "Пока нет завершённых задач с фиксированной ценой, поэтому общий график временно пуст."
          : "Для выбранной категории ещё нет завершённых задач с фиксированной ценой, поэтому график временно пуст."
      }
    />
  );
}

export function CategoryDealHistoryWidget({
  category,
  categoryLabel,
  limit = 500,
  className,
}: CategoryDealHistoryWidgetProps) {
  const { points, isLoading, hasAnySuccess, hasOnlyErrors, refetchAll } = useCategoryDealDataset(category, limit);

  if (isLoading) {
    return <div className={cn("card-surface h-[420px] animate-pulse", className)} />;
  }

  if (hasOnlyErrors && !hasAnySuccess) {
    return (
      <div className={cn("card-surface p-5 sm:p-6", className)}>
        <h3 className="text-sm font-semibold text-foreground">История сделок</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Не удалось загрузить историю сделок{categoryLabel ? ` по категории ${categoryLabel}` : ""}.
        </p>
        <Button className="mt-4" variant="outline" onClick={refetchAll}>
          Повторить
        </Button>
      </div>
    );
  }

  if (points.length === 0) {
    return (
      <div className={cn("card-surface p-5 sm:p-6", className)}>
        <h3 className="text-sm font-semibold text-foreground">История сделок</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Для выбранного режима история завершённых сделок пока пуста.
        </p>
      </div>
    );
  }

  const sortedPoints = [...points].sort(
    (left, right) => new Date(right.completedAt).getTime() - new Date(left.completedAt).getTime(),
  );

  return (
    <div className={cn("card-surface p-5 sm:p-6", className)}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">История сделок</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {category === "all" ? "Все категории" : categoryLabel ?? category}
          </p>
        </div>
        <div className="text-xs text-muted-foreground">{sortedPoints.length} записей</div>
      </div>

      <div className="mt-5 max-h-[520px] overflow-auto rounded-xl border border-border">
        {sortedPoints.map((point, index) => (
          <Link
            key={`${point.taskId}-${point.completedAt}`}
            to={`/task/${point.taskId}`}
            className={cn(
              "flex flex-col gap-3 bg-background/70 p-4 transition-colors hover:bg-accent/40 focus-visible:bg-accent/40 focus-visible:outline-none sm:flex-row sm:items-center sm:justify-between",
              index > 0 && "border-t border-border",
            )}
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {point.categoryLabel ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-[11px] text-muted-foreground">
                    <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: point.categoryColor }} />
                    <span>{point.categoryLabel}</span>
                  </span>
                ) : null}
                <span className="text-xs text-muted-foreground">{fullDateFormatter.format(new Date(point.completedAt))}</span>
              </div>
              <div className="mt-2 truncate text-sm font-medium text-foreground">{point.title}</div>
            </div>
            <div className="shrink-0 text-left sm:text-right">
              <div className="text-base font-semibold text-foreground">{formatCurrency(point.priceAmount)}</div>
              <div className="text-xs text-muted-foreground">Открыть сделку</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
