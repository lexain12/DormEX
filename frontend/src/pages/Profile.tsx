import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle, Clock, Shield, Star } from "lucide-react";

import { queryKeys } from "@/api/query-keys";
import { usersService } from "@/api/services/users";
import { CreateRequestModal } from "@/components/CreateRequestModal";
import { TaskCard } from "@/components/TaskCard";
import { TopNav } from "@/components/TopNav";
import { useAuth } from "@/context/auth-context";
import { CATEGORIES, type Task } from "@/lib/data";
import { mapApiPaymentToUi, mapApiStatusToUi, mapApiUrgencyToUi } from "@/lib/task-mappers";

function formatShortDate(value?: string | null): string {
  if (!value) {
    return "—";
  }

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return "—";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
  }).format(new Date(timestamp));
}

function initials(fullName: string): string {
  return fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

interface HistoryItem {
  id: string;
  title: string;
  performer: string;
  date: string;
  status: "done" | "cancelled";
  price: number | null;
  rating: number;
  timestamp: number;
}

const Profile = () => {
  const [createOpen, setCreateOpen] = useState(false);
  const [tab, setTab] = useState<"active" | "history" | "reviews">("active");
  const [selectedHistoryTxId, setSelectedHistoryTxId] = useState<string | null>(null);
  const { user } = useAuth();

  const currentUserId = user?.id ?? null;
  const apiEnabled = Boolean(currentUserId && currentUserId > 0);

  const profileQuery = useQuery({
    queryKey: queryKeys.userProfile(currentUserId ?? 0),
    queryFn: () => usersService.getById(currentUserId as number),
    enabled: apiEnabled,
  });

  const activeTasksQuery = useQuery({
    queryKey: queryKeys.userTasks(currentUserId ?? 0, "customer", "active"),
    queryFn: () => usersService.getTasks(currentUserId as number, { role: "customer", status: "active" }),
    enabled: apiEnabled,
  });

  const completedTasksQuery = useQuery({
    queryKey: queryKeys.userTasks(currentUserId ?? 0, "customer", "completed"),
    queryFn: () => usersService.getTasks(currentUserId as number, { role: "customer", status: "completed" }),
    enabled: apiEnabled,
  });

  const cancelledTasksQuery = useQuery({
    queryKey: queryKeys.userTasks(currentUserId ?? 0, "customer", "cancelled"),
    queryFn: () => usersService.getTasks(currentUserId as number, { role: "customer", status: "cancelled" }),
    enabled: apiEnabled,
  });

  const reviewsQuery = useQuery({
    queryKey: queryKeys.userReviews(currentUserId ?? 0),
    queryFn: () => usersService.getReviews(currentUserId as number),
    enabled: apiEnabled,
  });

  const displayName = profileQuery.data?.full_name ?? user?.full_name ?? "Пользователь";
  const displayDormitory = profileQuery.data?.dormitory?.name ?? user?.dormitory?.name ?? "Общежитие не указано";
  const displayRating = Number(profileQuery.data?.rating_avg ?? 0);
  const avatar = initials(displayName) || "??";

  const activeTasks = useMemo<Task[]>(() => {
    return (activeTasksQuery.data ?? []).map((task) => {
      const category = task.category ?? "other";
      const categoryMeta = CATEGORIES.find((item) => item.id === category);

      return {
        id: String(task.id),
        title: task.title ?? "Без названия",
        description: task.description ?? "Описание не указано",
        category,
        categoryIcon: categoryMeta?.icon ?? "📋",
        dorm: task.dormitory?.name ?? displayDormitory,
        status: mapApiStatusToUi(task.status ?? "open"),
        urgency: mapApiUrgencyToUi(task.urgency ?? "flexible"),
        paymentType: mapApiPaymentToUi(task.payment_type ?? "negotiable"),
        price: typeof task.price_amount === "number" ? task.price_amount : undefined,
        offersCount: Number(task.offers_count ?? 0),
        requesterName: displayName,
        requesterRating: displayRating,
        requesterAvatar: avatar,
        createdAt: formatShortDate(task.created_at),
      };
    });
  }, [activeTasksQuery.data, avatar, displayDormitory, displayName, displayRating]);

  const historyItems = useMemo<HistoryItem[]>(() => {
    const completed = (completedTasksQuery.data ?? []).map((task) => ({
      id: `done-${task.id}`,
      title: task.title ?? "Без названия",
      performer: task.performer?.full_name ?? "Исполнитель не указан",
      date: formatShortDate(task.completed_at ?? task.created_at),
      status: "done" as const,
      price: typeof task.price_amount === "number" ? task.price_amount : null,
      rating: 0,
      timestamp: Date.parse(task.completed_at ?? task.created_at ?? "") || 0,
    }));

    const cancelled = (cancelledTasksQuery.data ?? []).map((task) => ({
      id: `cancelled-${task.id}`,
      title: task.title ?? "Без названия",
      performer: task.performer?.full_name ?? "Исполнитель не указан",
      date: formatShortDate(task.cancelled_at ?? task.created_at),
      status: "cancelled" as const,
      price: typeof task.price_amount === "number" ? task.price_amount : null,
      rating: 0,
      timestamp: Date.parse(task.cancelled_at ?? task.created_at ?? "") || 0,
    }));

    return [...completed, ...cancelled].sort((a, b) => b.timestamp - a.timestamp);
  }, [cancelledTasksQuery.data, completedTasksQuery.data]);

  const selectedHistoryTx = historyItems.find((transaction) => transaction.id === selectedHistoryTxId);

  const reviews = useMemo(() => {
    return (reviewsQuery.data ?? []).map((review) => ({
      id: String(review.id ?? `${review.created_at ?? "review"}-${review.author?.id ?? "unknown"}`),
      author: review.author?.full_name ?? review.author_name ?? "Пользователь",
      rating: Math.min(5, Math.max(1, Number(review.rating || 0))),
      text: review.comment?.trim() || "Без комментария",
      date: formatShortDate(review.created_at),
    }));
  }, [reviewsQuery.data]);

  const badges = profileQuery.data?.badges?.length ? profileQuery.data.badges : [
    "verified_student",
    "30+ completed_tasks",
    "high_rating",
    "fast_responder",
  ];

  const dealsCount = Number(profileQuery.data?.completed_tasks_count ?? historyItems.filter((item) => item.status === "done").length);
  const activeCount = activeTasks.length;
  const createdCount = Number(profileQuery.data?.created_tasks_count ?? 0);
  const reviewsCount = Number(profileQuery.data?.reviews_count ?? reviews.length);

  return (
    <div className="min-h-screen bg-background">
      <TopNav onCreateRequest={() => setCreateOpen(true)} />

      <div className="max-w-[1400px] mx-auto px-6 py-6">
        <div className="flex gap-6">
          <div className="w-80 shrink-0 space-y-4">
            <div className="card-surface p-6 text-center">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-semibold text-primary mx-auto mb-4">
                {avatar || "??"}
              </div>
              <h2 className="text-lg font-semibold text-foreground">{displayName}</h2>
              <p className="text-sm text-muted-foreground mt-1">{displayDormitory}</p>

              <div className="flex items-center justify-center gap-1 mt-3">
                <Star className="w-4 h-4 text-warning fill-warning" />
                <span className="font-semibold text-foreground">{displayRating.toFixed(1)}</span>
                <span className="text-sm text-muted-foreground">· {reviewsCount} отзывов</span>
              </div>

              <div className="grid grid-cols-3 gap-3 mt-5 pt-5 border-t border-border">
                <div>
                  <div className="text-lg font-semibold text-foreground">{dealsCount}</div>
                  <div className="text-[11px] text-muted-foreground">Сделки</div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-foreground">{activeCount}</div>
                  <div className="text-[11px] text-muted-foreground">Активных</div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-foreground">{createdCount}</div>
                  <div className="text-[11px] text-muted-foreground">Заявки</div>
                </div>
              </div>
            </div>

            <div className="card-surface p-4">
              <h3 className="font-semibold text-sm text-foreground mb-3">Знаки доверия</h3>
              <div className="space-y-2.5">
                {badges.map((badge) => {
                  const normalized = badge.toLowerCase();
                  const isVerified = normalized.includes("verified");
                  const isCompleted = normalized.includes("completed") || normalized.includes("30+");
                  const isRating = normalized.includes("rating");
                  const icon = isVerified ? Shield : isCompleted ? CheckCircle : isRating ? Star : Clock;
                  const label = isVerified
                    ? "Верифицированный студент"
                    : isCompleted
                      ? "Завершённые сделки"
                      : isRating
                        ? "Высокий рейтинг"
                        : "Активный пользователь";

                  return (
                    <div key={badge} className="flex items-center gap-2.5 p-2 rounded-lg bg-secondary">
                      <icon className="w-4 h-4 text-primary" />
                      <span className="text-xs text-foreground">{label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex-1 min-w-0 space-y-5">
            <div className="flex gap-1 border-b border-border">
              {([
                { id: "active", label: "Активные" },
                { id: "history", label: "История сделок" },
                { id: "reviews", label: "Отзывы" },
              ] as const).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                    tab === t.id
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {!apiEnabled && (
              <div className="card-surface p-4 text-sm text-muted-foreground">
                Профиль API недоступен в dev-сессии без реального пользователя. После входа по email данные появятся автоматически.
              </div>
            )}

            {tab === "active" && (
              <>
                {activeTasksQuery.isLoading && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <div key={index} className="card-surface h-[220px] animate-pulse" />
                    ))}
                  </div>
                )}

                {!activeTasksQuery.isLoading && activeTasksQuery.isError && (
                  <div className="card-surface p-4 text-sm text-foreground">
                    Не удалось загрузить активные задачи.
                    <button
                      type="button"
                      onClick={() => void activeTasksQuery.refetch()}
                      className="ml-2 text-primary hover:text-primary/80"
                    >
                      Повторить
                    </button>
                  </div>
                )}

                {!activeTasksQuery.isLoading && !activeTasksQuery.isError && activeTasks.length === 0 && (
                  <div className="card-surface p-4 text-sm text-muted-foreground">Активных задач пока нет.</div>
                )}

                {!activeTasksQuery.isLoading && !activeTasksQuery.isError && activeTasks.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {activeTasks.map((task) => (
                      <TaskCard key={task.id} task={task} />
                    ))}
                  </div>
                )}
              </>
            )}

            {tab === "history" && (
              <div className="card-surface">
                {(completedTasksQuery.isLoading || cancelledTasksQuery.isLoading) && (
                  <div className="p-4 space-y-2">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <div key={index} className="h-14 rounded-lg bg-secondary animate-pulse" />
                    ))}
                  </div>
                )}

                {!completedTasksQuery.isLoading && !cancelledTasksQuery.isLoading && (completedTasksQuery.isError || cancelledTasksQuery.isError) && (
                  <div className="p-4 text-sm text-foreground">
                    Не удалось загрузить историю сделок.
                    <button
                      type="button"
                      onClick={() => {
                        void completedTasksQuery.refetch();
                        void cancelledTasksQuery.refetch();
                      }}
                      className="ml-2 text-primary hover:text-primary/80"
                    >
                      Повторить
                    </button>
                  </div>
                )}

                {!completedTasksQuery.isLoading && !cancelledTasksQuery.isLoading && !completedTasksQuery.isError && !cancelledTasksQuery.isError && historyItems.length === 0 && (
                  <div className="p-4 text-sm text-muted-foreground">История сделок пока пуста.</div>
                )}

                {!completedTasksQuery.isLoading && !cancelledTasksQuery.isLoading && !completedTasksQuery.isError && !cancelledTasksQuery.isError && historyItems.map((tx, i) => {
                  const isSelected = tx.id === selectedHistoryTxId;

                  return (
                    <div key={tx.id} className={i > 0 ? "border-t border-border" : ""}>
                      <button
                        type="button"
                        onClick={() => setSelectedHistoryTxId(isSelected ? null : tx.id)}
                        className={`w-full flex items-center justify-between p-4 transition-colors text-left ${
                          isSelected ? "bg-primary/5" : "hover:bg-accent"
                        }`}
                      >
                        <div>
                          <div className="text-sm font-medium text-foreground">{tx.title}</div>
                          <div className="text-xs text-muted-foreground">{tx.performer} · {tx.date}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold text-foreground">
                            {typeof tx.price === "number" ? `${tx.price} ₽` : "—"}
                          </div>
                          <span className={`chip text-[10px] px-1.5 py-0.5 ${tx.status === "done" ? "status-done" : "status-cancelled"}`}>
                            {tx.status === "done" ? "Завершена" : "Отменена"}
                          </span>
                        </div>
                      </button>

                      {isSelected && (
                        <div className="p-4 border-t border-border bg-secondary/40">
                          <h4 className="text-sm font-semibold text-foreground mb-2">Детали выбранной сделки</h4>
                          <div className="text-sm text-foreground">{tx.title}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Исполнитель: {tx.performer} · Оценка: {tx.rating || "—"} · Статус: {tx.status === "done" ? "завершена" : "отменена"}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {tab === "reviews" && (
              <div className="space-y-3">
                {reviewsQuery.isLoading && (
                  Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="card-surface h-24 animate-pulse" />
                  ))
                )}

                {!reviewsQuery.isLoading && reviewsQuery.isError && (
                  <div className="card-surface p-4 text-sm text-foreground">
                    Не удалось загрузить отзывы.
                    <button
                      type="button"
                      onClick={() => void reviewsQuery.refetch()}
                      className="ml-2 text-primary hover:text-primary/80"
                    >
                      Повторить
                    </button>
                  </div>
                )}

                {!reviewsQuery.isLoading && !reviewsQuery.isError && reviews.length === 0 && (
                  <div className="card-surface p-4 text-sm text-muted-foreground">Отзывов пока нет.</div>
                )}

                {!reviewsQuery.isLoading && !reviewsQuery.isError && reviews.map((review) => (
                  <div key={review.id} className="card-surface p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-semibold text-primary">
                          {initials(review.author)}
                        </div>
                        <span className="text-sm font-medium text-foreground">{review.author}</span>
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: review.rating }).map((_, j) => (
                            <Star key={j} className="w-3 h-3 text-warning fill-warning" />
                          ))}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground">{review.date}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{review.text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <CreateRequestModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
};

export default Profile;
