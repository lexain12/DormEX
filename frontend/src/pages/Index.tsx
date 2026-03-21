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

  return (
    <div className="min-h-screen bg-background">
      <TopNav onCreateRequest={() => setCreateOpen(true)} />

      <div className="max-w-[1400px] mx-auto px-6 py-6">
        <div className="flex gap-6">
          <div className="flex-1 min-w-0 space-y-5">
            {tasksQuery.isLoading && (
              <>
                <div className="card-surface p-6 h-[190px] animate-pulse" />
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div key={index} className="card-surface h-[220px] animate-pulse" />
                  ))}
                </div>
              </>
            )}

            {!tasksQuery.isLoading && (
              <>
                {featuredTask && <FeaturedCard task={featuredTask} />}
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
                    <h3 className="text-sm font-semibold text-foreground">Заявок пока нет</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Попробуйте другой фильтр или создайте первую заявку.
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
