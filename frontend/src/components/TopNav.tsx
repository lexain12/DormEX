import { Bell, CheckCheck, ChevronDown, Plus, Search, Trash2 } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useMemo, useState } from 'react';

import { DORM_OPTIONS, useInteractionStore } from '@/context/interaction-store';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface TopNavProps {
  onCreateRequest: () => void;
}

export function TopNav({ onCreateRequest }: TopNavProps) {
  const location = useLocation();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsTab, setNotificationsTab] = useState<'all' | 'unread'>('all');
  const {
    selectedDorm,
    setSelectedDorm,
    notifications,
    unreadNotificationsCount,
    markAllNotificationsRead,
    markNotificationRead,
    clearNotifications,
  } = useInteractionStore();

  const navItems = [
    { label: 'Биржа', path: '/' },
    { label: 'Аналитика', path: '/analytics' },
    { label: 'Мой профиль', path: '/profile' },
  ];

  const formatTime = (timestamp: number) => {
    const diffInMinutes = Math.floor((Date.now() - timestamp) / 1000 / 60);

    if (diffInMinutes < 1) return 'только что';
    if (diffInMinutes < 60) return `${diffInMinutes} мин назад`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} ч назад`;

    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays} дн назад`;
  };

  const filteredNotifications = useMemo(() => {
    if (notificationsTab === 'unread') {
      return notifications.filter((notification) => !notification.read);
    }

    return notifications;
  }, [notifications, notificationsTab]);

  return (
    <header className="h-14 border-b border-border bg-card sticky top-0 z-50">
      <div className="h-full max-w-[1400px] mx-auto px-6 flex items-center gap-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">DH</span>
          </div>
          <span className="font-semibold text-foreground text-[15px]">DormHub</span>
        </Link>

        {/* Nav */}
        <nav className="flex items-center gap-1 ml-6">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                location.pathname === item.path
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Search */}
        <div className="flex-1 max-w-md mx-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Поиск заявок, услуг, исполнителей..."
              className="w-full h-9 pl-9 pr-4 rounded-lg bg-secondary border-none text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {/* Dorm selector */}
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
                className={dorm === selectedDorm ? 'bg-primary/10 text-primary' : ''}
              >
                {dorm}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Create */}
        <button
          onClick={onCreateRequest}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          Создать заявку
        </button>

        {/* Notifications */}
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
                    {notifications.length === 0
                      ? 'Пока событий нет.'
                      : unreadNotificationsCount > 0
                        ? `${unreadNotificationsCount} новых событий`
                        : 'Все события просмотрены'}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={markAllNotificationsRead}
                    className="h-7 px-2 rounded-md border border-border text-[11px] text-muted-foreground hover:bg-accent transition-colors inline-flex items-center gap-1"
                  >
                    <CheckCheck className="w-3 h-3" />
                    Прочитано
                  </button>
                  <button
                    type="button"
                    onClick={clearNotifications}
                    className="h-7 px-2 rounded-md border border-border text-[11px] text-muted-foreground hover:bg-accent transition-colors inline-flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    Очистить
                  </button>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-1 rounded-lg bg-secondary p-1">
                <button
                  type="button"
                  onClick={() => setNotificationsTab('all')}
                  className={`h-7 px-3 rounded-md text-xs font-medium transition-colors ${
                    notificationsTab === 'all'
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Все
                </button>
                <button
                  type="button"
                  onClick={() => setNotificationsTab('unread')}
                  className={`h-7 px-3 rounded-md text-xs font-medium transition-colors ${
                    notificationsTab === 'unread'
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Новые
                </button>
              </div>
            </div>

            <div className="max-h-[360px] overflow-y-auto p-2 space-y-2">
              {filteredNotifications.length === 0 ? (
                <div className="h-28 flex items-center justify-center text-sm text-muted-foreground">
                  {notificationsTab === 'unread' ? 'Непрочитанных уведомлений нет' : 'Пусто'}
                </div>
              ) : (
                filteredNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`rounded-lg border p-3 transition-colors ${
                      notification.read
                        ? 'border-border bg-card'
                        : 'border-primary/20 bg-primary/5'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {!notification.read && <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />}
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-foreground">{notification.title}</div>
                        <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{notification.description}</div>
                        <div className="text-[11px] text-muted-foreground mt-1.5">{formatTime(notification.createdAt)}</div>
                      </div>
                    </div>

                    <div className="mt-2 flex items-center justify-between">
                      {notification.read ? (
                        <span className="text-[11px] text-muted-foreground">Прочитано</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => markNotificationRead(notification.id)}
                          className="text-[11px] text-primary hover:text-primary/80"
                        >
                          Отметить как прочитанное
                        </button>
                      )}

                      {notification.taskId && (
                        <Link
                          to={`/task/${notification.taskId}`}
                          onClick={() => setNotificationsOpen(false)}
                          className="text-[11px] text-primary hover:text-primary/80"
                        >
                          Открыть задачу
                        </Link>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* Avatar */}
        <Link to="/profile" className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
          АМ
        </Link>
      </div>

    </header>
  );
}
