import { Clock, TrendingUp, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CATEGORIES, type Task } from '@/lib/data';

interface RightSidebarProps {
  tasks: Task[];
}

export function RightSidebar({ tasks }: RightSidebarProps) {
  const urgentTasks = tasks.filter((task) => task.urgency === 'urgent' || task.urgency === 'today').slice(0, 3);
  const hotCategories = CATEGORIES.filter(c => c.id !== 'all').slice(0, 5);

  const activeTasksCount = tasks.filter((task) => (
    task.status === 'open' || task.status === 'offers' || task.status === 'progress'
  )).length;

  const completedToday = tasks.filter((task) => task.status === 'done').length;
  const pricedTasks = tasks.filter((task) => typeof task.price === 'number');
  const averagePrice = pricedTasks.length > 0
    ? `${Math.round(pricedTasks.reduce((sum, task) => sum + (task.price ?? 0), 0) / pricedTasks.length)} ₽`
    : '—';

  const averageRating = tasks.length > 0
    ? (tasks.reduce((sum, task) => sum + task.requesterRating, 0) / tasks.length).toFixed(1)
    : '—';

  return (
    <aside className="w-full shrink-0 space-y-4 xl:w-80">
      {/* Urgent */}
      <div className="card-surface p-4">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-destructive" />
          <h3 className="font-semibold text-sm text-foreground">Срочные заявки</h3>
        </div>
        {urgentTasks.length === 0 ? (
          <div className="rounded-lg bg-secondary p-3 text-xs text-muted-foreground">
            Срочных задач сейчас нет. Новые заявки появятся здесь автоматически.
          </div>
        ) : (
          <div className="space-y-3">
            {urgentTasks.map((task) => (
              <Link
                key={task.id}
                to={`/task/${task.id}`}
                className="block rounded-lg p-3 transition-colors hover:bg-accent"
              >
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">{task.dorm}</span>
                  <span className="chip urgency-urgent text-[10px] px-1.5 py-0.5">
                    {task.urgency === 'urgent' ? 'Срочно' : 'Сегодня'}
                  </span>
                </div>
                <div className="mb-1 text-sm font-medium leading-snug text-foreground">{task.title}</div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-foreground">
                    {task.price ? `${task.price} ₽` : 'Предложите'}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{task.createdAt}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Hot categories */}
      <div className="card-surface p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm text-foreground">Горячие категории</h3>
        </div>
        <div className="space-y-2">
          {hotCategories.map((cat) => (
            <Link
              key={cat.id}
              to={`/?category=${cat.id}`}
            className="flex items-center justify-between gap-3 rounded-lg p-2.5 transition-colors hover:bg-accent"
          >
            <div className="flex items-center gap-2.5">
              <span className="text-base">{cat.icon}</span>
              <span className="text-sm text-foreground">{cat.label}</span>
            </div>
              <span className="text-xs text-muted-foreground">
                {tasks.filter((task) => task.category === cat.id).length} заявок
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="card-surface p-4">
        <h3 className="font-semibold text-sm text-foreground mb-3">Статистика кампуса</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-2">
          {[
            { label: 'Активных заявок', value: String(activeTasksCount) },
            { label: 'Сделок сегодня', value: String(completedToday) },
            { label: 'Средняя цена', value: averagePrice },
            { label: 'Средний рейтинг', value: averageRating },
          ].map((stat) => (
            <div key={stat.label} className="p-2.5 rounded-lg bg-secondary">
              <div className="text-lg font-semibold text-foreground">{stat.value}</div>
              <div className="text-[11px] text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
