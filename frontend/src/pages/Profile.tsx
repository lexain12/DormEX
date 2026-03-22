import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle, Clock, Shield, Star } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { queryKeys } from "@/api/query-keys";
import { tasksService } from "@/api/services/tasks";
import { usersService } from "@/api/services/users";
import type { RoleMetricsDto, UserReviewDto, UserTaskDto } from "@/api/types";
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

function averageRating(reviews: UserReviewDto[]): number {
  if (reviews.length === 0) {
    return 0;
  }

  const total = reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0);
  return Math.round((total / reviews.length) * 10) / 10;
}

function mapTaskToCard(
  task: UserTaskDto,
  requesterName: string,
  requesterRating: number,
  requesterAvatar: string,
  fallbackDormitory: string,
): Task {
  const category = task.category ?? "other";
  const categoryMeta = CATEGORIES.find((item) => item.id === category);

  return {
    id: String(task.id),
    title: task.title ?? "Без названия",
    description: task.description ?? "Описание не указано",
    category,
    categoryIcon: categoryMeta?.icon ?? "📋",
    dorm: task.dormitory?.name ?? fallbackDormitory,
    status: mapApiStatusToUi(task.status ?? "open"),
    urgency: mapApiUrgencyToUi(task.urgency ?? "flexible"),
    paymentType: mapApiPaymentToUi(task.payment_type ?? "negotiable"),
    price: typeof task.price_amount === "number" ? task.price_amount : undefined,
    barterDescription: task.barter_description ?? null,
    offersCount: Number(task.offers_count ?? 0),
    requesterName,
    requesterRating,
    requesterAvatar,
    createdAt: formatShortDate(task.created_at),
  };
}

interface HistoryItem {
  id: string;
  taskId: number;
  title: string;
  counterpartyName: string;
  date: string;
  status: "done" | "cancelled";
  price: number | null;
  timestamp: number;
  reviewPending: boolean;
}

async function loadTasksForProfile(
  userId: number,
  isOwnProfile: boolean,
  role: "customer" | "performer",
  status: "active" | "completed" | "cancelled",
): Promise<UserTaskDto[]> {
  if (isOwnProfile) {
    try {
      return await tasksService.listMyTasks({ role, status });
    } catch {
      return usersService.getTasks(userId, { role, status });
    }
  }

  return usersService.getTasks(userId, { role, status });
}

function buildHistoryItems(
  tasks: UserTaskDto[],
  role: "customer" | "performer",
  status: "done" | "cancelled",
): HistoryItem[] {
  return tasks.map((task) => ({
    id: `${role}-${status}-${task.id}`,
    taskId: task.id,
    title: task.title ?? "Без названия",
    counterpartyName: role === "customer"
      ? task.performer?.full_name ?? "Исполнитель не указан"
      : task.customer?.full_name ?? "Заказчик не указан",
    date: formatShortDate(status === "done" ? task.completed_at ?? task.created_at : task.cancelled_at ?? task.created_at),
    status,
    price: typeof task.price_amount === "number" ? task.price_amount : null,
    timestamp: Date.parse(status === "done" ? task.completed_at ?? task.created_at ?? "" : task.cancelled_at ?? task.created_at ?? "") || 0,
    reviewPending: Boolean(status === "done" && task.review_summary?.pending_by_me),
  }));
}

function MetricsCard({
  title,
  metrics,
}: {
  title: string;
  metrics: RoleMetricsDto;
}) {
  return (
    <div className="rounded-xl border border-border bg-secondary/40 p-4">
      <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{title}</div>
      <div className="mt-3 flex items-center gap-1">
        <Star className="w-4 h-4 text-warning fill-warning" />
        <span className="text-lg font-semibold text-foreground">{metrics.rating_avg.toFixed(1)}</span>
        <span className="text-sm text-muted-foreground">· {metrics.reviews_count} отзывов</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <div className="text-lg font-semibold text-foreground">{metrics.completed_tasks_count}</div>
          <div className="text-[11px] text-muted-foreground">Завершено</div>
        </div>
        <div>
          <div className="text-lg font-semibold text-foreground">{metrics.reviews_count}</div>
          <div className="text-[11px] text-muted-foreground">Оценок</div>
        </div>
      </div>
    </div>
  );
}

function ReviewsSection({
  title,
  reviews,
}: {
  title: string;
  reviews: UserReviewDto[];
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <span className="text-xs text-muted-foreground">{reviews.length}</span>
      </div>

      {reviews.length === 0 ? (
        <div className="rounded-lg border border-border bg-secondary/40 p-4 text-sm text-muted-foreground">
          Пока отзывов нет.
        </div>
      ) : (
        reviews.map((review) => (
          <div key={review.id ?? `${review.task_id}-${review.created_at}`} className="card-surface p-4">
            <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-semibold text-primary">
                  {initials(review.author?.full_name ?? review.author_name ?? "Пользователь")}
                </div>
                <span className="text-sm font-medium text-foreground">
                  {review.author?.full_name ?? review.author_name ?? "Пользователь"}
                </span>
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: Math.min(5, Math.max(1, Number(review.rating || 0))) }).map((_, index) => (
                    <Star key={index} className="w-3 h-3 text-warning fill-warning" />
                  ))}
                </div>
              </div>
              <span className="text-xs text-muted-foreground">{formatShortDate(review.created_at)}</span>
            </div>
            {review.task_id && review.task_title && (
              <Link to={`/task/${review.task_id}`} className="text-xs text-primary hover:text-primary/80">
                {review.task_title}
              </Link>
            )}
            <p className="mt-2 text-sm text-muted-foreground">{review.comment?.trim() || "Без комментария"}</p>
          </div>
        ))
      )}
    </div>
  );
}

function HistorySection({
  title,
  items,
  showPendingReview,
}: {
  title: string;
  items: HistoryItem[];
  showPendingReview: boolean;
}) {
  return (
    <div className="card-surface overflow-hidden">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>

      {items.length === 0 ? (
        <div className="p-4 text-sm text-muted-foreground">История по этой роли пока пуста.</div>
      ) : (
        <div>
          {items.map((item, index) => (
            <div key={item.id} className={index > 0 ? "border-t border-border" : ""}>
              <Link to={`/task/${item.taskId}`} className="block p-4 transition-colors hover:bg-accent">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-medium text-foreground">{item.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {item.counterpartyName} · {item.date}
                    </div>
                    {showPendingReview && item.reviewPending && (
                      <div className="mt-2 text-[11px] text-primary">Нужно оставить отзыв</div>
                    )}
                  </div>
                  <div className="text-left sm:text-right">
                    <div className="text-sm font-semibold text-foreground">
                      {typeof item.price === "number" ? `${item.price} ₽` : "—"}
                    </div>
                    <span className={`chip mt-1 text-[10px] px-1.5 py-0.5 ${item.status === "done" ? "status-done" : "status-cancelled"}`}>
                      {item.status === "done" ? "Завершена" : "Отменена"}
                    </span>
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const Profile = () => {
  const [createOpen, setCreateOpen] = useState(false);
  const [tab, setTab] = useState<"active" | "history" | "reviews">("active");
  const { id } = useParams();
  const { user } = useAuth();

  const routeUserId = id ? Number(id) : null;
  const targetUserId = routeUserId ?? user?.id ?? null;
  const isOwnProfile = routeUserId == null || routeUserId === user?.id;
  const apiEnabled = Boolean(targetUserId && targetUserId > 0);

  const profileQuery = useQuery({
    queryKey: queryKeys.userProfile(targetUserId ?? 0),
    queryFn: () => usersService.getById(targetUserId as number),
    enabled: apiEnabled,
  });

  const activeCustomerQuery = useQuery({
    queryKey: queryKeys.userTasks(targetUserId ?? 0, "customer", "active"),
    queryFn: () => loadTasksForProfile(targetUserId as number, isOwnProfile, "customer", "active"),
    enabled: apiEnabled,
  });

  const activePerformerQuery = useQuery({
    queryKey: queryKeys.userTasks(targetUserId ?? 0, "performer", "active"),
    queryFn: () => loadTasksForProfile(targetUserId as number, isOwnProfile, "performer", "active"),
    enabled: apiEnabled,
  });

  const completedCustomerQuery = useQuery({
    queryKey: queryKeys.userTasks(targetUserId ?? 0, "customer", "completed"),
    queryFn: () => loadTasksForProfile(targetUserId as number, isOwnProfile, "customer", "completed"),
    enabled: apiEnabled,
  });

  const cancelledCustomerQuery = useQuery({
    queryKey: queryKeys.userTasks(targetUserId ?? 0, "customer", "cancelled"),
    queryFn: () => loadTasksForProfile(targetUserId as number, isOwnProfile, "customer", "cancelled"),
    enabled: apiEnabled,
  });

  const completedPerformerQuery = useQuery({
    queryKey: queryKeys.userTasks(targetUserId ?? 0, "performer", "completed"),
    queryFn: () => loadTasksForProfile(targetUserId as number, isOwnProfile, "performer", "completed"),
    enabled: apiEnabled,
  });

  const cancelledPerformerQuery = useQuery({
    queryKey: queryKeys.userTasks(targetUserId ?? 0, "performer", "cancelled"),
    queryFn: () => loadTasksForProfile(targetUserId as number, isOwnProfile, "performer", "cancelled"),
    enabled: apiEnabled,
  });

  const reviewsQuery = useQuery({
    queryKey: queryKeys.userReviews(targetUserId ?? 0),
    queryFn: () => usersService.getReviews(targetUserId as number),
    enabled: apiEnabled,
  });

  const displayName = profileQuery.data?.full_name ?? user?.full_name ?? "Пользователь";
  const displayDormitory = profileQuery.data?.dormitory?.name ?? user?.dormitory?.name ?? "Общежитие не указано";
  const avatar = initials(displayName) || "??";

  const splitReviews = useMemo(() => {
    const items = reviewsQuery.data ?? [];
    const customer = items.filter((review) => review.target_role === "customer");
    const performer = items.filter((review) => review.target_role === "performer");

    if (customer.length === 0 && performer.length === 0) {
      return {
        customer: items,
        performer: [] as UserReviewDto[],
      };
    }

    return { customer, performer };
  }, [reviewsQuery.data]);

  const customerMetrics = profileQuery.data?.customer_metrics ?? {
    rating_avg: averageRating(splitReviews.customer),
    reviews_count: splitReviews.customer.length,
    completed_tasks_count: (completedCustomerQuery.data ?? []).length,
  };

  const performerMetrics = profileQuery.data?.performer_metrics ?? {
    rating_avg: averageRating(splitReviews.performer),
    reviews_count: splitReviews.performer.length,
    completed_tasks_count: (completedPerformerQuery.data ?? []).length,
  };

  const activeCustomerCards = useMemo(
    () => (activeCustomerQuery.data ?? []).map((task) => mapTaskToCard(task, displayName, customerMetrics.rating_avg, avatar, displayDormitory)),
    [activeCustomerQuery.data, avatar, customerMetrics.rating_avg, displayDormitory, displayName],
  );

  const activePerformerCards = useMemo(
    () => (activePerformerQuery.data ?? []).map((task) => mapTaskToCard(
      task,
      task.customer?.full_name ?? "Заказчик",
      0,
      initials(task.customer?.full_name ?? "Заказчик") || "??",
      displayDormitory,
    )),
    [activePerformerQuery.data, displayDormitory],
  );

  const customerHistory = useMemo(() => {
    const completed = buildHistoryItems(completedCustomerQuery.data ?? [], "customer", "done");
    const cancelled = buildHistoryItems(cancelledCustomerQuery.data ?? [], "customer", "cancelled");
    return [...completed, ...cancelled].sort((a, b) => b.timestamp - a.timestamp);
  }, [cancelledCustomerQuery.data, completedCustomerQuery.data]);

  const performerHistory = useMemo(() => {
    const completed = buildHistoryItems(completedPerformerQuery.data ?? [], "performer", "done");
    const cancelled = buildHistoryItems(cancelledPerformerQuery.data ?? [], "performer", "cancelled");
    return [...completed, ...cancelled].sort((a, b) => b.timestamp - a.timestamp);
  }, [cancelledPerformerQuery.data, completedPerformerQuery.data]);

  const pendingReviewItems = useMemo(() => {
    if (!isOwnProfile) {
      return [];
    }

    return [
      ...customerHistory.filter((item) => item.reviewPending),
      ...performerHistory.filter((item) => item.reviewPending),
    ].sort((a, b) => b.timestamp - a.timestamp);
  }, [customerHistory, isOwnProfile, performerHistory]);

  const combinedCompletedCount = Number(profileQuery.data?.completed_tasks_count ?? (customerMetrics.completed_tasks_count + performerMetrics.completed_tasks_count));
  const createdTasksCount = Number(profileQuery.data?.created_tasks_count ?? (activeCustomerQuery.data ?? []).length);
  const combinedReviewsCount = Number(profileQuery.data?.reviews_count ?? (customerMetrics.reviews_count + performerMetrics.reviews_count));
  const combinedRating = Number(profileQuery.data?.rating_avg ?? Math.max(customerMetrics.rating_avg, performerMetrics.rating_avg));

  const badges = useMemo(() => {
    if (profileQuery.data?.badges?.length) {
      return profileQuery.data.badges;
    }

    const derivedBadges: string[] = [];

    if (profileQuery.data?.dormitory?.id || user?.dormitory?.id) {
      derivedBadges.push("verified_student");
    }

    if (combinedCompletedCount >= 1) {
      derivedBadges.push("completed_tasks");
    }

    if (combinedRating >= 4.5 && combinedReviewsCount > 0) {
      derivedBadges.push("high_rating");
    }

    if ((activeCustomerQuery.data ?? []).length > 0 || (activePerformerQuery.data ?? []).length > 0 || createdTasksCount > 0) {
      derivedBadges.push("active_user");
    }

    return derivedBadges;
  }, [
    activeCustomerQuery.data,
    activePerformerQuery.data,
    combinedCompletedCount,
    combinedRating,
    combinedReviewsCount,
    createdTasksCount,
    profileQuery.data?.badges,
    profileQuery.data?.dormitory?.id,
    user?.dormitory?.id,
  ]);

  const isActiveLoading = activeCustomerQuery.isLoading || activePerformerQuery.isLoading;
  const isHistoryLoading = completedCustomerQuery.isLoading
    || cancelledCustomerQuery.isLoading
    || completedPerformerQuery.isLoading
    || cancelledPerformerQuery.isLoading;

  return (
    <div className="min-h-screen bg-background">
      <TopNav onCreateRequest={() => setCreateOpen(true)} />

      <div className="max-w-[1400px] mx-auto px-4 py-4 sm:px-6 sm:py-6">
        <div className="flex flex-col gap-6 xl:flex-row">
          <div className="w-full shrink-0 space-y-4 xl:w-80">
            <div className="card-surface p-6 text-center">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-semibold text-primary mx-auto mb-4">
                {avatar}
              </div>
              <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                {isOwnProfile ? "Мой профиль" : "Профиль пользователя"}
              </div>
              <h2 className="mt-2 text-lg font-semibold text-foreground">{displayName}</h2>
              <p className="text-sm text-muted-foreground mt-1">{displayDormitory}</p>

              <div className="flex items-center justify-center gap-1 mt-3">
                <Star className="w-4 h-4 text-warning fill-warning" />
                <span className="font-semibold text-foreground">{combinedRating.toFixed(1)}</span>
                <span className="text-sm text-muted-foreground">· {combinedReviewsCount} отзывов</span>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-3 border-t border-border pt-5">
                <div>
                  <div className="text-lg font-semibold text-foreground">{combinedCompletedCount}</div>
                  <div className="text-[11px] text-muted-foreground">Сделки</div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-foreground">{(activeCustomerQuery.data ?? []).length + (activePerformerQuery.data ?? []).length}</div>
                  <div className="text-[11px] text-muted-foreground">Активных</div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-foreground">{createdTasksCount}</div>
                  <div className="text-[11px] text-muted-foreground">Заявки</div>
                </div>
              </div>
            </div>

            <MetricsCard title="Как заказчик" metrics={customerMetrics} />
            <MetricsCard title="Как исполнитель" metrics={performerMetrics} />

            <div className="card-surface p-4">
              <h3 className="font-semibold text-sm text-foreground mb-3">Знаки доверия</h3>
              {badges.length === 0 ? (
                <div className="p-3 rounded-lg bg-secondary text-xs text-muted-foreground">
                  Знаки доверия появятся автоматически по мере заполнения профиля и завершения сделок.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {badges.map((badge) => {
                    const normalized = badge.toLowerCase();
                    const isVerified = normalized.includes("verified");
                    const isCompleted = normalized.includes("completed") || normalized.includes("30+");
                    const isRating = normalized.includes("rating");
                    const Icon = isVerified ? Shield : isCompleted ? CheckCircle : isRating ? Star : Clock;
                    const label = isVerified
                      ? "Верифицированный студент"
                      : isCompleted
                        ? "Завершённые сделки"
                        : isRating
                          ? "Высокий рейтинг"
                          : "Активный пользователь";

                    return (
                      <div key={badge} className="flex items-center gap-2.5 p-2 rounded-lg bg-secondary">
                        <Icon className="w-4 h-4 text-primary" />
                        <span className="text-xs text-foreground">{label}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 min-w-0 space-y-5">
            {isOwnProfile && pendingReviewItems.length > 0 && (
              <div className="card-surface p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Напоминание об отзывах</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      По завершённым сделкам ниже ещё ждут вашу оценку.
                    </p>
                  </div>
                  <span className="chip chip-active text-[11px] px-2 py-0.5">{pendingReviewItems.length}</span>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {pendingReviewItems.slice(0, 4).map((item) => (
                    <Link key={item.id} to={`/task/${item.taskId}?panel=review`} className="rounded-lg border border-border bg-secondary/40 p-4 hover:bg-accent transition-colors">
                      <div className="text-sm font-medium text-foreground">{item.title}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{item.counterpartyName} · {item.date}</div>
                      <div className="mt-2 text-xs text-primary">Открыть сделку и оставить отзыв</div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <div className="overflow-x-auto border-b border-border">
              <div className="flex min-w-max gap-1">
                {([
                  { id: "active", label: "Активные" },
                  { id: "history", label: "История сделок" },
                  { id: "reviews", label: "Отзывы" },
                ] as const).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setTab(item.id)}
                    className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                      tab === item.id
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {!apiEnabled && (
              <div className="card-surface p-4 text-sm text-muted-foreground">
                Профиль API недоступен в dev-сессии без реального пользователя. После входа по email данные появятся автоматически.
              </div>
            )}

            {tab === "active" && (
              <div className="space-y-5">
                {isActiveLoading && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <div key={index} className="card-surface h-[220px] animate-pulse" />
                    ))}
                  </div>
                )}

                {!isActiveLoading && (activeCustomerQuery.isError || activePerformerQuery.isError) && (
                  <div className="card-surface p-4 text-sm text-foreground">
                    Не удалось загрузить активные сделки.
                    <button
                      type="button"
                      onClick={() => {
                        void activeCustomerQuery.refetch();
                        void activePerformerQuery.refetch();
                      }}
                      className="ml-2 text-primary hover:text-primary/80"
                    >
                      Повторить
                    </button>
                  </div>
                )}

                {!isActiveLoading && !activeCustomerQuery.isError && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold text-foreground">Как заказчик</h3>
                      <span className="text-xs text-muted-foreground">{activeCustomerCards.length}</span>
                    </div>
                    {activeCustomerCards.length === 0 ? (
                      <div className="card-surface p-4 text-sm text-muted-foreground">Активных заявок в роли заказчика пока нет.</div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {activeCustomerCards.map((task) => (
                          <TaskCard key={task.id} task={task} />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {!isActiveLoading && !activePerformerQuery.isError && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold text-foreground">Как исполнитель</h3>
                      <span className="text-xs text-muted-foreground">{activePerformerCards.length}</span>
                    </div>
                    {activePerformerCards.length === 0 ? (
                      <div className="card-surface p-4 text-sm text-muted-foreground">Активных сделок в роли исполнителя пока нет.</div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {activePerformerCards.map((task) => (
                          <TaskCard key={task.id} task={task} />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {tab === "history" && (
              <div className="space-y-5">
                {isHistoryLoading && (
                  <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <div key={index} className="card-surface h-20 animate-pulse" />
                    ))}
                  </div>
                )}

                {!isHistoryLoading && (
                  <>
                    <HistorySection title="История как заказчик" items={customerHistory} showPendingReview={isOwnProfile} />
                    <HistorySection title="История как исполнитель" items={performerHistory} showPendingReview={isOwnProfile} />
                  </>
                )}
              </div>
            )}

            {tab === "reviews" && (
              <div className="space-y-5">
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

                {!reviewsQuery.isLoading && !reviewsQuery.isError && (
                  <>
                    <ReviewsSection title="Отзывы о заказчике" reviews={splitReviews.customer} />
                    <ReviewsSection title="Отзывы об исполнителе" reviews={splitReviews.performer} />
                  </>
                )}
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
