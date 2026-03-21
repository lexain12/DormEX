import { useEffect, useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { Bar, BarChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, Clock, DollarSign, Star, TrendingUp } from "lucide-react";

import { queryKeys } from "@/api/query-keys";
import { analyticsService } from "@/api/services/analytics";
import type { CategoryAnalyticsDto } from "@/api/types";
import { CategoryChips } from "@/components/CategoryChips";
import { CreateRequestModal } from "@/components/CreateRequestModal";
import { TopNav } from "@/components/TopNav";
import { CATEGORIES } from "@/lib/data";

function aggregateAnalytics(items: CategoryAnalyticsDto[]): CategoryAnalyticsDto | null {
  if (items.length === 0) {
    return null;
  }

  const completedTasksCount = items.reduce((sum, item) => sum + Number(item.completed_tasks_count || 0), 0);
  const weightedDenominator = completedTasksCount || items.length;
  const weighted = (key: keyof Pick<CategoryAnalyticsDto, "avg_price_amount" | "median_price_amount" | "avg_completion_minutes">) => (
    items.reduce((sum, item) => sum + Number(item[key] || 0) * Number(item.completed_tasks_count || 1), 0) / weightedDenominator
  );

  const minPrice = items.reduce((min, item) => Math.min(min, Number(item.min_price_amount || Infinity)), Infinity);
  const maxPrice = items.reduce((max, item) => Math.max(max, Number(item.max_price_amount || 0)), 0);

  const histogramMap = new Map<string, number>();
  items.forEach((item) => {
    item.price_histogram.forEach((entry) => {
      histogramMap.set(entry.range, (histogramMap.get(entry.range) ?? 0) + entry.count);
    });
  });

  return {
    category: "all",
    completed_tasks_count: completedTasksCount,
    avg_price_amount: Math.round(weighted("avg_price_amount")),
    median_price_amount: Math.round(weighted("median_price_amount")),
    min_price_amount: Number.isFinite(minPrice) ? minPrice : 0,
    max_price_amount: maxPrice,
    avg_completion_minutes: Math.round(weighted("avg_completion_minutes")),
    price_histogram: Array.from(histogramMap.entries()).map(([range, count]) => ({ range, count })),
  };
}

const Analytics = () => {
  const [createOpen, setCreateOpen] = useState(false);
  const [category, setCategory] = useState("all");
  const [selectedRange, setSelectedRange] = useState<string | null>(null);

  const categoryIds = CATEGORIES.filter((item) => item.id !== "all").map((item) => item.id);

  const categoryQueries = useQueries({
    queries: categoryIds.map((categoryId) => ({
      queryKey: queryKeys.analyticsCategory(categoryId),
      queryFn: () => analyticsService.getCategory(categoryId),
      enabled: category === "all" || category === categoryId,
    })),
  });

  const relevantQueries = category === "all"
    ? categoryQueries
    : categoryQueries.filter((_, index) => categoryIds[index] === category);

  const isLoading = relevantQueries.some((query) => query.isLoading);
  const failedQueriesCount = relevantQueries.filter((query) => query.isError).length;
  const successfulPayloads = relevantQueries
    .map((query) => query.data)
    .filter((item): item is CategoryAnalyticsDto => Boolean(item));
  const hasAnySuccess = successfulPayloads.length > 0;
  const hasOnlyErrors = failedQueriesCount > 0 && !hasAnySuccess;
  const hasPartialErrors = failedQueriesCount > 0 && hasAnySuccess;

  const analytics = useMemo(() => {
    if (category === "all") {
      return aggregateAnalytics(successfulPayloads);
    }

    return successfulPayloads[0] ?? null;
  }, [category, successfulPayloads]);

  useEffect(() => {
    setSelectedRange(null);
  }, [category]);

  const retryRelevantQueries = () => {
    relevantQueries.forEach((query) => {
      void query.refetch();
    });
  };

  const histogram = analytics?.price_histogram ?? [];
  const selectedHistogram = histogram.find((item) => item.range === selectedRange) ?? null;
  const totalHistogramCount = histogram.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="min-h-screen bg-background">
      <TopNav onCreateRequest={() => setCreateOpen(true)} />

      <div className="max-w-[1400px] mx-auto px-6 py-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Аналитика сделок</h1>
            <p className="text-sm text-muted-foreground">Статистика цен и завершённых сделок по категориям</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <BarChart3 className="w-4 h-4" />
            Обновлено только что
          </div>
        </div>

        <CategoryChips active={category} onChange={setCategory} />

        <div className="flex gap-6 mt-5">
          <div className="flex-1 min-w-0 space-y-5">
            {isLoading && (
              <>
                <div className="grid grid-cols-4 gap-4">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="card-surface h-28 animate-pulse" />
                  ))}
                </div>
                <div className="card-surface h-72 animate-pulse" />
                <div className="card-surface h-64 animate-pulse" />
              </>
            )}

            {!isLoading && hasOnlyErrors && (
              <div className="card-surface p-5">
                <h3 className="font-semibold text-sm text-foreground">Не удалось загрузить аналитику</h3>
                <p className="text-sm text-muted-foreground mt-1">Проверьте доступность endpoint аналитики категорий.</p>
                <button
                  type="button"
                  onClick={retryRelevantQueries}
                  className="mt-3 h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  Повторить
                </button>
              </div>
            )}

            {!isLoading && !hasOnlyErrors && !analytics && (
              <div className="card-surface p-5">
                <h3 className="font-semibold text-sm text-foreground">Пока нет данных</h3>
                <p className="text-sm text-muted-foreground mt-1">Для выбранной категории аналитика ещё не рассчитана.</p>
              </div>
            )}

            {!isLoading && !hasOnlyErrors && analytics && (
              <>
                {hasPartialErrors && (
                  <div className="card-surface p-4">
                    <div className="text-sm text-foreground">Часть категорий временно недоступна.</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Показаны данные по доступным endpoint.
                    </div>
                    <button
                      type="button"
                      onClick={retryRelevantQueries}
                      className="mt-2 text-xs text-primary hover:text-primary/80"
                    >
                      Повторить загрузку
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-4 gap-4">
                  {[
                    { icon: DollarSign, label: "Средняя цена", value: `${analytics.avg_price_amount} ₽`, change: "по категории", color: "text-primary" },
                    { icon: TrendingUp, label: "Медиана", value: `${analytics.median_price_amount} ₽`, change: "по категории", color: "text-success" },
                    { icon: BarChart3, label: "Всего сделок", value: String(analytics.completed_tasks_count), change: "завершённые", color: "text-primary" },
                    { icon: Clock, label: "Ср. время", value: `${Math.round(analytics.avg_completion_minutes / 60 * 10) / 10} ч`, change: "до завершения", color: "text-success" },
                  ].map((stat) => (
                    <div key={stat.label} className="card-surface p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <stat.icon className={`w-4 h-4 ${stat.color}`} />
                        <span className="text-xs text-muted-foreground">{stat.label}</span>
                      </div>
                      <div className="text-xl font-semibold text-foreground">{stat.value}</div>
                      <div className="text-xs text-muted-foreground mt-1">{stat.change}</div>
                    </div>
                  ))}
                </div>

                <div className="card-surface p-6">
                  <h3 className="font-semibold text-sm text-foreground mb-4">Распределение цен по завершённым сделкам</h3>
                  {histogram.length === 0 ? (
                    <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
                      Нет данных о диапазонах цен.
                    </div>
                  ) : (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={histogram}>
                          <XAxis dataKey="range" tick={{ fontSize: 12, fill: "hsl(220, 9%, 46%)" }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 12, fill: "hsl(220, 9%, 46%)" }} axisLine={false} tickLine={false} />
                          <Tooltip
                            contentStyle={{
                              background: "hsl(0, 0%, 100%)",
                              border: "1px solid hsl(220, 13%, 91%)",
                              borderRadius: "8px",
                              fontSize: "13px",
                            }}
                            formatter={(value: number) => [`${value} сделок`, "Количество"]}
                          />
                          <ReferenceLine y={Math.round((Math.max(...histogram.map((entry) => entry.count), 0)) / 2)} stroke="hsl(217, 91%, 60%)" strokeDasharray="4 4" />
                          <Bar dataKey="count" fill="hsl(217, 91%, 60%)" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                <div className="card-surface">
                  <div className="p-4 border-b border-border">
                    <h3 className="font-semibold text-sm text-foreground">Диапазоны цен</h3>
                  </div>
                  {histogram.length === 0 ? (
                    <div className="p-4 text-sm text-muted-foreground">Диапазоны пока недоступны.</div>
                  ) : (
                    histogram.map((item, i) => (
                      <div
                        key={item.range}
                        onClick={() => setSelectedRange(item.range === selectedRange ? null : item.range)}
                        className={`flex items-center justify-between p-4 cursor-pointer transition-colors ${
                          selectedRange === item.range ? "bg-primary/5" : "hover:bg-accent"
                        } ${i > 0 ? "border-t border-border" : ""}`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-base">📊</span>
                          <div>
                            <div className="text-sm font-medium text-foreground">Диапазон {item.range} ₽</div>
                            <div className="text-xs text-muted-foreground">Сделки в этом диапазоне</div>
                          </div>
                        </div>
                        <div className="text-right flex items-center gap-4">
                          <div className="text-sm font-semibold text-foreground w-16 text-right">{item.count}</div>
                          <span className="chip text-[10px] px-2 py-0.5 status-done">сделок</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          <div className="w-80 shrink-0">
            {selectedHistogram ? (
              <div className="card-surface p-5 sticky top-20 animate-fade-in">
                <h3 className="font-semibold text-sm text-foreground mb-4">Детали диапазона</h3>
                <div className="space-y-3">
                  <div>
                    <div className="text-[11px] text-muted-foreground">Диапазон</div>
                    <div className="text-sm font-medium text-foreground">{selectedHistogram.range} ₽</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-muted-foreground">Сделок</div>
                    <div className="text-lg font-semibold text-foreground">{selectedHistogram.count}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-muted-foreground">Доля</div>
                    <div className="text-sm text-foreground">
                      {totalHistogramCount > 0
                        ? `${Math.round((selectedHistogram.count / totalHistogramCount) * 100)}%`
                        : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-muted-foreground">Средняя цена категории</div>
                    <div className="text-sm text-foreground">{analytics ? `${analytics.avg_price_amount} ₽` : "—"}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-muted-foreground">Рейтинг диапазона</div>
                    <div className="flex items-center gap-0.5">
                      <Star className="w-3.5 h-3.5 text-warning fill-warning" />
                      <span className="text-xs text-foreground font-medium">
                        {selectedHistogram.count > 0 ? "Актуальный" : "Редкий"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="card-surface p-5 text-center">
                <p className="text-sm text-muted-foreground">Выберите диапазон для просмотра деталей</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <CreateRequestModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
};

export default Analytics;
