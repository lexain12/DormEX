import { Star, ArrowRight, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SAMPLE_TASKS, type Task } from '@/lib/data';

interface FeaturedCardProps {
  task?: Task;
}

export function FeaturedCard({ task = SAMPLE_TASKS[0] }: FeaturedCardProps) {

  return (
    <Link
      to={`/task/${task.id}`}
      className="card-surface p-6 border-primary/20 hover:border-primary/40 transition-all group block"
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="chip urgency-urgent text-xs px-2 py-0.5 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Срочно
            </span>
            <span className="text-xs text-muted-foreground">{task.dorm}</span>
          </div>
          <h2 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors mb-1">
            {task.title}
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-lg">
            {task.description}
          </p>
        </div>
        <div className="text-right shrink-0 ml-6">
          <div className="text-2xl font-bold text-foreground">{task.price} ₽</div>
          <div className="text-xs text-muted-foreground mt-1">{task.offersCount} предложения</div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
            {task.requesterAvatar}
          </div>
          <div>
            <div className="text-sm font-medium text-foreground">{task.requesterName}</div>
            <div className="flex items-center gap-1">
              <Star className="w-3 h-3 text-warning fill-warning" />
              <span className="text-xs text-foreground font-medium">{task.requesterRating}</span>
              <span className="text-xs text-muted-foreground">· 12 сделок</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm font-medium text-primary">
          Предложить
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </div>
      </div>
    </Link>
  );
}
