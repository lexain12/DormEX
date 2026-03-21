import { Bell, CheckCheck, ChevronDown, Plus, Search } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { type FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { DORM_OPTIONS, useInteractionStore } from "@/context/interaction-store";
import { useAuth } from "@/context/auth-context";
import { queryKeys } from "@/api/query-keys";
import { notificationsService } from "@/api/services/notifications";
import { formatEventTime, resolveNotificationTaskId } from "@/lib/task-mappers";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "@/hooks/use-toast";

interface TopNavProps {
  onCreateRequest: () => void;
}

export function TopNav({ onCreateRequest }: TopNavProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsTab, setNotificationsTab] = useState<"all" | "unread">("all");
  const [searchValue, setSearchValue] = useState("");
  const { status, logout, user } = useAuth();
  const { selectedDorm, setSelectedDorm } = useInteractionStore();

  const isAuthenticated = status === "authenticated";

  const unreadCountQuery = useQuery({
    queryKey: queryKeys.unreadNotificationsCount,
    queryFn: notificationsService.unreadCount,
    enabled: isAuthenticated,
    refetchInterval: 30_000,
  });

  const notificationsQuery = useQuery({
    queryKey: queryKeys.notifications(notificationsTab),
    queryFn: () => notificationsService.list({
      status: notificationsTab,
      limit: 20,
      offset: 0,
    }),
    enabled: isAuthenticated && notificationsOpen,
    refetchInterval: notificationsOpen ? 30_000 : false,
  });

  const markReadMutation = useMutation({
    mutationFn: notificationsService.markRead,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["notifications"] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.unreadNotificationsCount }),
      ]);
    },
    onError: (error) => {
      toast({
        title: "Не удалось отметить уведомление",
        description: error instanceof Error ? error.message : "Попробуйте ещё раз.",
        variant: "destructive",
      });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: notificationsService.markAllRead,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["notifications"] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.unreadNotificationsCount }),
      ]);
    },
    onError: (error) => {
      toast({
        title: "Не удалось обновить уведомления",
        description: error instanceof Error ? error.message : "Попробуйте ещё раз.",
        variant: "destructive",
      });
    },
  });

  const navItems = [
    { label: "Биржа", path: "/" },
    { label: "Аналитика", path: "/analytics" },
    { label: "Мой профиль", path: "/profile" },
  ];

  const notifications = notificationsQuery.data?.items ?? [];
  const unreadNotificationsCount = unreadCountQuery.data?.unread_count ?? 0;
  const avatarInitials = user?.full_name
    ? user.full_name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("")
    : "??";

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setSearchValue(params.get("search") ?? "");
  }, [location.search]);

  const handleSearchSubmit = (event: FormEvent) => {
    event.preventDefault();

    const params = new URLSearchParams(location.search);
    const normalizedValue = searchValue.trim();

    if (normalizedValue) {
      params.set("search", normalizedValue);
    } else {
      params.delete("search");
    }

    navigate({
      pathname: "/",
      search: params.toString() ? `?${params.toString()}` : "",
    });
  };

  return (
    <header className="h-14 border-b border-border bg-card sticky top-0 z-50">
      <div className="h-full max-w-[1400px] mx-auto px-6 flex items-center gap-4">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">DH</span>
          </div>
          <span className="font-semibold text-foreground text-[15px]">DormHub</span>
        </Link>

        <nav className="flex items-center gap-1 ml-6">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                location.pathname === item.path
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex-1 max-w-md mx-4">
          <form className="relative" onSubmit={handleSearchSubmit}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Поиск заявок, услуг, исполнителей..."
              className="w-full h-9 pl-9 pr-4 rounded-lg bg-secondary border-none text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </form>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:bg-accent transition-colors shrink-0">
              <span>{selectedDorm}</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>Выберите общежитие</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {DORM_OPTIONS.map((dorm) => (
              <DropdownMenuItem
                key={dorm}
                onSelect={() => setSelectedDorm(dorm)}
                className={dorm === selectedDorm ? "bg-primary/10 text-primary" : ""}
              >
                {dorm}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <button
          onClick={onCreateRequest}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          Создать заявку
        </button>

        <Popover open={notificationsOpen} onOpenChange={setNotificationsOpen}>
          <PopoverTrigger asChild>
            <button className="relative w-9 h-9 rounded-lg flex items-center justify-center hover:bg-accent transition-colors shrink-0">
              <Bell className="w-4.5 h-4.5 text-muted-foreground" />
              {unreadNotificationsCount > 0 && (
                <>
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-destructive" />
                  <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-primary text-[10px] font-semibold text-primary-foreground flex items-center justify-center">
                    {Math.min(unreadNotificationsCount, 99)}
                  </span>
                </>
              )}
            </button>
          </PopoverTrigger>

          <PopoverContent
            align="end"
            sideOffset={10}
            className="w-[380px] p-0 rounded-xl border border-border bg-card shadow-xl"
          >
            <div className="px-4 py-3 border-b border-border">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Уведомления</h3>
                  <p className="text-xs text-muted-foreground">
                    {unreadNotificationsCount > 0
                      ? `${unreadNotificationsCount} новых событий`
                      : "Все события просмотрены"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => markAllReadMutation.mutate()}
                  className="h-7 px-2 rounded-md border border-border text-[11px] text-muted-foreground hover:bg-accent transition-colors inline-flex items-center gap-1"
                  disabled={markAllReadMutation.isPending}
                >
                  <CheckCheck className="w-3 h-3" />
                  Прочитано
                </button>
              </div>

              <div className="mt-3 flex items-center gap-1 rounded-lg bg-secondary p-1">
                <button
                  type="button"
                  onClick={() => setNotificationsTab("all")}
                  className={`h-7 px-3 rounded-md text-xs font-medium transition-colors ${
                    notificationsTab === "all"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Все
                </button>
                <button
                  type="button"
                  onClick={() => setNotificationsTab("unread")}
                  className={`h-7 px-3 rounded-md text-xs font-medium transition-colors ${
                    notificationsTab === "unread"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Новые
                </button>
              </div>
            </div>

            <div className="max-h-[360px] overflow-y-auto p-2 space-y-2">
              {notificationsQuery.isLoading && (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="rounded-lg border p-3 animate-pulse bg-secondary h-20" />
                  ))}
                </div>
              )}

              {!notificationsQuery.isLoading && notificationsQuery.isError && (
                <div className="p-3 rounded-lg border border-border">
                  <div className="text-sm text-foreground">Не удалось загрузить уведомления</div>
                  <button
                    type="button"
                    onClick={() => void notificationsQuery.refetch()}
                    className="text-xs text-primary mt-2 hover:text-primary/80"
                  >
                    Повторить
                  </button>
                </div>
              )}

              {!notificationsQuery.isLoading && !notificationsQuery.isError && notifications.length === 0 && (
                <div className="h-28 flex items-center justify-center text-sm text-muted-foreground">
                  {notificationsTab === "unread" ? "Непрочитанных уведомлений нет" : "Пока событий нет"}
                </div>
              )}

              {!notificationsQuery.isLoading && !notificationsQuery.isError && notifications.map((notification) => {
                const taskId = resolveNotificationTaskId(notification);

                return (
                  <div
                    key={notification.id}
                    className={`rounded-lg border p-3 transition-colors ${
                      notification.is_read
                        ? "border-border bg-card"
                        : "border-primary/20 bg-primary/5"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {!notification.is_read && <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />}
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-foreground">{notification.title}</div>
                        <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{notification.body}</div>
                        <div className="text-[11px] text-muted-foreground mt-1.5">{formatEventTime(notification.created_at)}</div>
                      </div>
                    </div>

                    <div className="mt-2 flex items-center justify-between">
                      {notification.is_read ? (
                        <span className="text-[11px] text-muted-foreground">Прочитано</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => markReadMutation.mutate(notification.id)}
                          className="text-[11px] text-primary hover:text-primary/80"
                          disabled={markReadMutation.isPending}
                        >
                          Отметить как прочитанное
                        </button>
                      )}

                      {taskId && (
                        <Link
                          to={`/task/${taskId}`}
                          onClick={() => setNotificationsOpen(false)}
                          className="text-[11px] text-primary hover:text-primary/80"
                        >
                          Открыть задачу
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
              {avatarInitials}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem asChild>
              <Link to="/profile">Профиль</Link>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void logout()}>Выйти</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
