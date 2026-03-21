import { Star, Shield, CheckCircle, Clock } from 'lucide-react';
import { TopNav } from '@/components/TopNav';
import { CreateRequestModal } from '@/components/CreateRequestModal';
import { TaskCard } from '@/components/TaskCard';
import { SAMPLE_TASKS, SAMPLE_TRANSACTIONS } from '@/lib/data';
import { useState } from 'react';
import { useInteractionStore } from '@/context/interaction-store';

const Profile = () => {
  const [createOpen, setCreateOpen] = useState(false);
  const [tab, setTab] = useState<'active' | 'history' | 'reviews'>('active');
  const [selectedHistoryTxId, setSelectedHistoryTxId] = useState<string | null>(null);
  const { localTasks } = useInteractionStore();

  const activeTasks = [...localTasks, ...SAMPLE_TASKS].filter((task) => task.status === 'open' || task.status === 'offers');
  const selectedHistoryTx = SAMPLE_TRANSACTIONS.find((transaction) => transaction.id === selectedHistoryTxId);
  const reviews = [
    { author: 'Мария К.', rating: 5, text: 'Отличная работа! Всё сделал быстро и аккуратно.', date: '10 мар' },
    { author: 'Дмитрий В.', rating: 4, text: 'Хороший исполнитель, рекомендую.', date: '8 мар' },
    { author: 'Елена С.', rating: 5, text: 'Пунктуальный и ответственный. Спасибо!', date: '5 мар' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <TopNav onCreateRequest={() => setCreateOpen(true)} />

      <div className="max-w-[1400px] mx-auto px-6 py-6">
        <div className="flex gap-6">
          {/* Left - Profile info */}
          <div className="w-80 shrink-0 space-y-4">
            <div className="card-surface p-6 text-center">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-semibold text-primary mx-auto mb-4">
                АМ
              </div>
              <h2 className="text-lg font-semibold text-foreground">Алексей Михайлов</h2>
              <p className="text-sm text-muted-foreground mt-1">Общежитие №4, этаж 5</p>

              <div className="flex items-center justify-center gap-1 mt-3">
                <Star className="w-4 h-4 text-warning fill-warning" />
                <span className="font-semibold text-foreground">4.8</span>
                <span className="text-sm text-muted-foreground">· 24 отзыва</span>
              </div>

              <div className="grid grid-cols-3 gap-3 mt-5 pt-5 border-t border-border">
                <div>
                  <div className="text-lg font-semibold text-foreground">32</div>
                  <div className="text-[11px] text-muted-foreground">Сделки</div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-foreground">5</div>
                  <div className="text-[11px] text-muted-foreground">Активных</div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-foreground">3</div>
                  <div className="text-[11px] text-muted-foreground">Заявки</div>
                </div>
              </div>
            </div>

            {/* Badges */}
            <div className="card-surface p-4">
              <h3 className="font-semibold text-sm text-foreground mb-3">Знаки доверия</h3>
              <div className="space-y-2.5">
                {[
                  { icon: Shield, label: 'Верифицированный студент', color: 'text-primary' },
                  { icon: CheckCircle, label: '30+ завершённых сделок', color: 'text-success' },
                  { icon: Star, label: 'Рейтинг выше 4.5', color: 'text-warning' },
                  { icon: Clock, label: 'Быстрый отклик (<15 мин)', color: 'text-primary' },
                ].map((badge) => (
                  <div key={badge.label} className="flex items-center gap-2.5 p-2 rounded-lg bg-secondary">
                    <badge.icon className={`w-4 h-4 ${badge.color}`} />
                    <span className="text-xs text-foreground">{badge.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right - Content */}
          <div className="flex-1 min-w-0 space-y-5">
            {/* Tabs */}
            <div className="flex gap-1 border-b border-border">
              {([
                { id: 'active', label: 'Активные' },
                { id: 'history', label: 'История сделок' },
                { id: 'reviews', label: 'Отзывы' },
              ] as const).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                    tab === t.id
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === 'active' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeTasks.map(task => (
                  <TaskCard key={task.id} task={task} />
                ))}
              </div>
            )}

            {tab === 'history' && (
              <div className="card-surface">
                {SAMPLE_TRANSACTIONS.map((tx, i) => (
                  <button
                    key={tx.id}
                    type="button"
                    onClick={() => setSelectedHistoryTxId(tx.id === selectedHistoryTxId ? null : tx.id)}
                    className={`w-full flex items-center justify-between p-4 transition-colors text-left ${
                      tx.id === selectedHistoryTxId ? 'bg-primary/5' : 'hover:bg-accent'
                    } ${i > 0 ? 'border-t border-border' : ''}`}
                  >
                    <div>
                      <div className="text-sm font-medium text-foreground">{tx.title}</div>
                      <div className="text-xs text-muted-foreground">{tx.performer} · {tx.date}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-foreground">{tx.price} ₽</div>
                      <span className={`chip text-[10px] px-1.5 py-0.5 ${tx.status === 'done' ? 'status-done' : 'status-cancelled'}`}>
                        {tx.status === 'done' ? 'Завершена' : 'Отменена'}
                      </span>
                    </div>
                  </button>
                ))}

                {selectedHistoryTx && (
                  <div className="p-4 border-t border-border bg-secondary/40">
                    <h4 className="text-sm font-semibold text-foreground mb-2">Детали выбранной сделки</h4>
                    <div className="text-sm text-foreground">{selectedHistoryTx.title}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Исполнитель: {selectedHistoryTx.performer} · Оценка: {selectedHistoryTx.rating || '—'} · Статус: {selectedHistoryTx.status === 'done' ? 'завершена' : 'отменена'}
                    </div>
                  </div>
                )}
              </div>
            )}

            {tab === 'reviews' && (
              <div className="space-y-3">
                {reviews.map((review, i) => (
                  <div key={i} className="card-surface p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-semibold text-primary">
                          {review.author.split(' ').map(n => n[0]).join('')}
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
