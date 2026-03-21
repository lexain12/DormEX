import { Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Task, STATUS_LABELS, URGENCY_LABELS, PAYMENT_LABELS } from '@/lib/data';

interface TaskCardProps {
  task: Task;
}

export function TaskCard({ task }: TaskCardProps) {
  const urgencyClass =
    task.urgency === 'urgent' ? 'urgency-urgent' :
    task.urgency === 'today' ? 'urgency-today' :
    task.urgency === 'week' ? 'urgency-week' : '';

  const statusClass =
    task.status === 'open' ? 'status-open' :
    task.status === 'offers' ? 'status-offers' :
    task.status === 'progress' ? 'status-progress' :
    task.status === 'done' ? 'status-done' :
    'status-cancelled';

  return (
    <Link
      to={`/task/${task.id}`}
      className="card-surface p-4 hover:border-primary/30 transition-all group animate-fade-in block"
    >
      {/* Top row */}
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-base">{task.categoryIcon}</span>
          <span className="text-xs text-muted-foreground">{task.dorm}</span>
        </div>
        <span className={`chip text-xs px-2 py-0.5 ${statusClass}`}>
          {STATUS_LABELS[task.status]}
        </span>
      </div>

      {/* Title */}
      <h3 className="font-semibold text-sm text-foreground mb-2 leading-snug group-hover:text-primary transition-colors">
        {task.title}
      </h3>

      {/* Tags */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {task.urgency !== 'none' && (
          <span className={`chip text-xs px-2 py-0.5 ${urgencyClass}`}>
            {URGENCY_LABELS[task.urgency]}
          </span>
        )}
        <span className="chip chip-inactive text-xs px-2 py-0.5">
          {PAYMENT_LABELS[task.paymentType]}
        </span>
      </div>

      {/* Price row */}
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-lg font-semibold text-foreground">
          {task.price ? `${task.price} ₽` : 'Предложите цену'}
        </div>
        {task.offersCount > 0 && (
          <span className="text-xs text-muted-foreground">
            {task.offersCount} предл.
          </span>
        )}
      </div>

      {/* Footer */}
      <div className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-semibold text-primary">
            {task.requesterAvatar}
          </div>
          <span className="text-xs text-muted-foreground">{task.requesterName}</span>
          <div className="flex items-center gap-0.5">
            <Star className="w-3 h-3 text-warning fill-warning" />
            <span className="text-xs font-medium text-foreground">{task.requesterRating}</span>
          </div>
        </div>
        <span className="text-[11px] text-muted-foreground">{task.createdAt}</span>
      </div>
    </Link>
  );
}
