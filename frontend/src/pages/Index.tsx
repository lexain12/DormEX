import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";

import { queryKeys } from "@/api/query-keys";
import { tasksService } from "@/api/services/tasks";
import { TopNav } from "@/components/TopNav";
import { FeaturedCard } from "@/components/FeaturedCard";
import { TaskCard } from "@/components/TaskCard";
import { RightSidebar } from "@/components/RightSidebar";
import { CategoryChips } from "@/components/CategoryChips";
import { CreateRequestModal } from "@/components/CreateRequestModal";
import { CATEGORIES } from "@/lib/data";
import { mapTaskDtoToUi } from "@/lib/task-mappers";

const Index = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);

  const categoryParam = searchParams.get("category") ?? "all";
  const category = CATEGORIES.some((cat) => cat.id === categoryParam) ? categoryParam : "all";
  const searchValue = (searchParams.get("search") ?? "").trim();
  const dormitoryParam = Number(searchParams.get("dormitory_id"));
  const dormitoryId = Number.isFinite(dormitoryParam) && dormitoryParam > 0 ? dormitoryParam : undefined;

  const tasksQuery = useQuery({
    queryKey: queryKeys.tasks({ category, searchValue, dormitoryId: dormitoryId ?? null }),
    queryFn: () => tasksService.list({
      category: category === "all" ? undefined : category,
      search: searchValue || undefined,
      dormitory_id: dormitoryId,
      limit: 30,
      offset: 0,
    }),
  });

  const allTasks = useMemo(
    () => (tasksQuery.data?.items ?? []).map((task) => mapTaskDtoToUi(task)),
    [tasksQuery.data?.items],
  );

  const handleCategoryChange = (nextCategory: string) => {
    const nextParams = new URLSearchParams(searchParams);

    if (nextCategory === "all") {
      nextParams.delete("category");
    } else {
      nextParams.set("category", nextCategory);
    }

    setSearchParams(nextParams, { replace: true });
  };

  const featuredTask = allTasks[0];
  const hasActiveFilters = Boolean(searchValue || category !== "all" || dormitoryId);
  const featuredCardPlaceholder = (
    <div className="card-surface h-[190px] border-dashed p-4 sm:p-6 flex flex-col justify-between">
      <div>
        <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Лента заявок</div>
        <h2 className="mt-3 text-lg font-semibold text-foreground">
          {tasksQuery.isError
            ? "Лента временно недоступна"
            : hasActiveFilters
              ? "По текущим фильтрам пока ничего не найдено"
              : "Новые объявления скоро появятся"}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-lg">
          {tasksQuery.isError
            ? "Фильтры и навигация остаются доступны, а ленту можно загрузить повторно чуть позже."
            : hasActiveFilters
              ? "Попробуйте изменить категорию, поиск или общежитие. Подборка обновится сразу."
              : "Как только появятся свежие заявки, они сразу появятся в этой подборке."}
        </p>
      </div>
      <div className="text-xs text-muted-foreground">
        {hasActiveFilters
          ? "Можно ослабить фильтры и посмотреть больше вариантов."
          : "Создайте новую заявку или обновите страницу позже."}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <TopNav onCreateRequest={() => setCreateOpen(true)} />

      <div className="max-w-[1400px] mx-auto px-4 py-4 sm:px-6 sm:py-6">
        <div className="flex flex-col gap-6 xl:flex-row">
          <div className="flex-1 min-w-0 space-y-5">
            {tasksQuery.isLoading && (
              <>
                <div className="card-surface h-[190px] animate-pulse p-4 sm:p-6" />
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div key={index} className="card-surface h-[220px] animate-pulse" />
                  ))}
                </div>
              </>
            )}

            {!tasksQuery.isLoading && (
              <>
                <div className="min-h-[190px]">
                  {featuredTask ? <FeaturedCard task={featuredTask} /> : featuredCardPlaceholder}
                </div>
                <CategoryChips active={category} onChange={handleCategoryChange} />

                {tasksQuery.isError ? (
                  <div className="card-surface p-5">
                    <h3 className="text-sm font-semibold text-foreground">Не удалось загрузить ленту</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {tasksQuery.error instanceof Error ? tasksQuery.error.message : "Проверьте соединение и повторите попытку."}
                    </p>
                    <button
                      type="button"
                      onClick={() => void tasksQuery.refetch()}
                      className="mt-3 h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                    >
                      Повторить
                    </button>
                  </div>
                ) : allTasks.length === 0 ? (
                  <div className="card-surface p-5">
                    <h3 className="text-sm font-semibold text-foreground">
                      {hasActiveFilters ? "По фильтрам ничего не найдено" : "Подборка пока пустая"}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {hasActiveFilters
                        ? "Измените параметры поиска или выберите другую категорию."
                        : "Создайте первую заявку или загляните чуть позже."}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {allTasks.slice(1).map((task) => (
                      <TaskCard key={task.id} task={task} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <RightSidebar tasks={allTasks} />
        </div>
      </div>

      <CreateRequestModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
};

export default Index;
