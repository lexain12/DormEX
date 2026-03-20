import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Star, Clock, MessageSquare, Send } from 'lucide-react';
import { TopNav } from '@/components/TopNav';
import { CreateRequestModal } from '@/components/CreateRequestModal';
import { useState } from 'react';
import {
  SAMPLE_TASKS, SAMPLE_TRANSACTIONS, PRICE_HISTOGRAM,
  STATUS_LABELS, URGENCY_LABELS, PAYMENT_LABELS,
} from '@/lib/data';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

const TaskDetail = () => {
  const { id } = useParams();
  const [createOpen, setCreateOpen] = useState(false);
  const task = SAMPLE_TASKS.find(t => t.id === id) || SAMPLE_TASKS[0];

  const urgencyClass =
    task.urgency === 'urgent' ? 'urgency-urgent' :
    task.urgency === 'today' ? 'urgency-today' :
    task.urgency === 'week' ? 'urgency-week' : 'chip-inactive';

  const statusClass =
    task.status === 'open' ? 'status-open' :
    task.status === 'offers' ? 'status-offers' :
    task.status === 'progress' ? 'status-progress' :
    task.status === 'done' ? 'status-done' : 'status-cancelled';

  const categoryTransactions = SAMPLE_TRANSACTIONS.filter(t => t.category === task.category);

  return (
    <div className="min-h-screen bg-background">
      <TopNav onCreateRequest={() => setCreateOpen(true)} />

      <div className="max-w-[1400px] mx-auto px-6 py-6">
        {/* Back */}
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-5">
          <ArrowLeft className="w-4 h-4" />
          Назад к бирже
        </Link>

        <div className="flex gap-6">
          {/* Left */}
          <div className="flex-1 min-w-0 space-y-5">
            {/* Main card */}
            <div className="card-surface p-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">{task.categoryIcon}</span>
                <span className="text-sm text-muted-foreground">{task.dorm}</span>
                <span className={`chip text-xs px-2 py-0.5 ${statusClass}`}>
                  {STATUS_LABELS[task.status]}
                </span>
                <span className={`chip text-xs px-2 py-0.5 ${urgencyClass}`}>
                  {URGENCY_LABELS[task.urgency]}
                </span>
              </div>

              <h1 className="text-xl font-semibold text-foreground mb-3">{task.title}</h1>
              <p className="text-sm text-muted-foreground leading-relaxed mb-5">{task.description}</p>

              <div className="grid grid-cols-3 gap-4 p-4 rounded-lg bg-secondary">
                <div>
                  <div className="text-[11px] text-muted-foreground mb-0.5">Оплата</div>
                  <div className="text-sm font-medium text-foreground">{PAYMENT_LABELS[task.paymentType]}</div>
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground mb-0.5">Цена</div>
                  <div className="text-sm font-semibold text-foreground">{task.price ? `${task.price} ₽` : 'По договорённости'}</div>
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground mb-0.5">Предложения</div>
                  <div className="text-sm font-medium text-foreground">{task.offersCount}</div>
                </div>
              </div>

              {/* Requester */}
              <div className="flex items-center gap-3 mt-5 pt-5 border-t border-border">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                  {task.requesterAvatar}
                </div>
                <div>
                  <div className="text-sm font-medium text-foreground">{task.requesterName}</div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-0.5">
                      <Star className="w-3 h-3 text-warning fill-warning" />
                      <span className="text-xs font-medium text-foreground">{task.requesterRating}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">· 12 сделок · 8 отзывов</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Analytics */}
            <div className="card-surface p-6">
              <h3 className="font-semibold text-sm text-foreground mb-4">Аналитика категории: {task.categoryIcon} История сделок</h3>

              <div className="h-48 mb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={PRICE_HISTOGRAM}>
                    <XAxis dataKey="range" tick={{ fontSize: 11, fill: 'hsl(220, 9%, 46%)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: 'hsl(220, 9%, 46%)' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        background: 'hsl(0, 0%, 100%)',
                        border: '1px solid hsl(220, 13%, 91%)',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                    <ReferenceLine y={22} stroke="hsl(217, 91%, 60%)" strokeDasharray="4 4" label={{ value: 'Медиана', position: 'right', fontSize: 11, fill: 'hsl(217, 91%, 60%)' }} />
                    <Bar dataKey="count" fill="hsl(217, 91%, 60%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: 'Медианная цена', value: '380 ₽' },
                  { label: 'Средняя цена', value: '420 ₽' },
                  { label: 'Диапазон', value: '150–1200 ₽' },
                  { label: 'Среднее время', value: '2.5 часа' },
                ].map((s) => (
                  <div key={s.label} className="p-3 rounded-lg bg-secondary">
                    <div className="text-base font-semibold text-foreground">{s.value}</div>
                    <div className="text-[11px] text-muted-foreground">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Recent transactions */}
              {categoryTransactions.length > 0 && (
                <div className="mt-5 pt-5 border-t border-border">
                  <h4 className="text-sm font-medium text-foreground mb-3">Последние сделки</h4>
                  <div className="space-y-2">
                    {categoryTransactions.slice(0, 5).map((tx) => (
                      <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors cursor-pointer">
                        <div>
                          <div className="text-sm text-foreground">{tx.title}</div>
                          <div className="text-xs text-muted-foreground">{tx.performer} · {tx.date}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold text-foreground">{tx.price} ₽</div>
                          <div className="flex items-center gap-0.5 justify-end">
                            <Star className="w-3 h-3 text-warning fill-warning" />
                            <span className="text-xs text-foreground">{tx.rating}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right panel */}
          <div className="w-80 shrink-0 space-y-4">
            <div className="card-surface p-5 space-y-3 sticky top-20">
              <button className="w-full h-11 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors flex items-center justify-center gap-2">
                <Send className="w-4 h-4" />
                Предложить услугу
              </button>
              <button className="w-full h-11 rounded-lg border border-border text-foreground font-medium text-sm hover:bg-accent transition-colors">
                Предложить цену
              </button>
              <button className="w-full h-11 rounded-lg border border-border text-muted-foreground font-medium text-sm hover:bg-accent transition-colors flex items-center justify-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Написать
              </button>

              <div className="pt-3 border-t border-border">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="w-3.5 h-3.5" />
                  Создано {task.createdAt}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <CreateRequestModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
};

export default TaskDetail;
