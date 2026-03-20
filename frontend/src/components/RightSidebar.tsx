import { Clock, TrendingUp, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SAMPLE_TASKS, CATEGORIES } from '@/lib/data';

export function RightSidebar() {
  const urgentTasks = SAMPLE_TASKS.filter(t => t.urgency === 'urgent' || t.urgency === 'today').slice(0, 3);
  const hotCategories = CATEGORIES.filter(c => c.id !== 'all').slice(0, 5);

  return (
    <aside className="w-80 shrink-0 space-y-4">
      {/* Urgent */}
      <div className="card-surface p-4">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-destructive" />
          <h3 className="font-semibold text-sm text-foreground">Срочные заявки</h3>
        </div>
        <div className="space-y-3">
          {urgentTasks.map((task) => (
            <Link
              key={task.id}
              to={`/task/${task.id}`}
              className="block p-3 rounded-lg hover:bg-accent transition-colors"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">{task.dorm}</span>
                <span className="chip urgency-urgent text-[10px] px-1.5 py-0.5">
                  {task.urgency === 'urgent' ? 'Срочно' : 'Сегодня'}
                </span>
              </div>
              <div className="text-sm font-medium text-foreground mb-1 leading-snug">{task.title}</div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">
                  {task.price ? `${task.price} ₽` : 'Предложите'}
                </span>
                <span className="text-[11px] text-muted-foreground">{task.createdAt}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Hot categories */}
      <div className="card-surface p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm text-foreground">Горячие категории</h3>
        </div>
        <div className="space-y-2">
          {hotCategories.map((cat) => (
            <div key={cat.id} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-accent transition-colors cursor-pointer">
              <div className="flex items-center gap-2.5">
                <span className="text-base">{cat.icon}</span>
                <span className="text-sm text-foreground">{cat.label}</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {Math.floor(Math.random() * 20 + 5)} заявок
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="card-surface p-4">
        <h3 className="font-semibold text-sm text-foreground mb-3">Статистика кампуса</h3>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Активных заявок', value: '47' },
            { label: 'Сделок сегодня', value: '12' },
            { label: 'Средняя цена', value: '380 ₽' },
            { label: 'Средний рейтинг', value: '4.7' },
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
