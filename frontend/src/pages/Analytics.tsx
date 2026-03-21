import { useState } from 'react';
import { TopNav } from '@/components/TopNav';
import { CreateRequestModal } from '@/components/CreateRequestModal';
import { CategoryChips } from '@/components/CategoryChips';
import { SAMPLE_TRANSACTIONS, PRICE_HISTOGRAM, CATEGORIES } from '@/lib/data';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Star, TrendingUp, DollarSign, Clock, BarChart3 } from 'lucide-react';

const Analytics = () => {
  const [createOpen, setCreateOpen] = useState(false);
  const [category, setCategory] = useState('all');
  const [selectedTx, setSelectedTx] = useState<string | null>(null);

  const filtered = category === 'all'
    ? SAMPLE_TRANSACTIONS
    : SAMPLE_TRANSACTIONS.filter(t => t.category === category);

  const selectedTransaction = SAMPLE_TRANSACTIONS.find(t => t.id === selectedTx);

  return (
    <div className="min-h-screen bg-background">
      <TopNav onCreateRequest={() => setCreateOpen(true)} />

      <div className="max-w-[1400px] mx-auto px-6 py-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Аналитика сделок</h1>
            <p className="text-sm text-muted-foreground">Статистика цен и завершённых сделок по категориям</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <BarChart3 className="w-4 h-4" />
            Обновлено 5 мин назад
          </div>
        </div>

        <CategoryChips active={category} onChange={setCategory} />

        <div className="flex gap-6 mt-5">
          {/* Main */}
          <div className="flex-1 min-w-0 space-y-5">
            {/* Stats */}
            <div className="grid grid-cols-4 gap-4">
              {[
                { icon: DollarSign, label: 'Средняя цена', value: '380 ₽', change: '+5%', color: 'text-primary' },
                { icon: TrendingUp, label: 'Медиана', value: '350 ₽', change: '+2%', color: 'text-success' },
                { icon: BarChart3, label: 'Всего сделок', value: '89', change: '+12', color: 'text-primary' },
                { icon: Clock, label: 'Ср. время', value: '2.5 ч', change: '-15 мин', color: 'text-success' },
              ].map((stat) => (
                <div key={stat.label} className="card-surface p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <stat.icon className={`w-4 h-4 ${stat.color}`} />
                    <span className="text-xs text-muted-foreground">{stat.label}</span>
                  </div>
                  <div className="text-xl font-semibold text-foreground">{stat.value}</div>
                  <div className="text-xs text-success mt-1">{stat.change}</div>
                </div>
              ))}
            </div>

            {/* Chart */}
            <div className="card-surface p-6">
              <h3 className="font-semibold text-sm text-foreground mb-4">Распределение цен по завершённым сделкам</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={PRICE_HISTOGRAM}>
                    <XAxis dataKey="range" tick={{ fontSize: 12, fill: 'hsl(220, 9%, 46%)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: 'hsl(220, 9%, 46%)' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        background: 'hsl(0, 0%, 100%)',
                        border: '1px solid hsl(220, 13%, 91%)',
                        borderRadius: '8px',
                        fontSize: '13px',
                      }}
                      formatter={(value: number) => [`${value} сделок`, 'Количество']}
                    />
                    <ReferenceLine y={22} stroke="hsl(217, 91%, 60%)" strokeDasharray="4 4" label={{ value: 'Медиана', position: 'right', fontSize: 12, fill: 'hsl(217, 91%, 60%)' }} />
                    <Bar dataKey="count" fill="hsl(217, 91%, 60%)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Transactions list */}
            <div className="card-surface">
              <div className="p-4 border-b border-border">
                <h3 className="font-semibold text-sm text-foreground">Последние сделки</h3>
              </div>
              {filtered.map((tx, i) => (
                <div
                  key={tx.id}
                  onClick={() => setSelectedTx(tx.id === selectedTx ? null : tx.id)}
                  className={`flex items-center justify-between p-4 cursor-pointer transition-colors ${
                    selectedTx === tx.id ? 'bg-primary/5' : 'hover:bg-accent'
                  } ${i > 0 ? 'border-t border-border' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-base">{CATEGORIES.find(c => c.id === tx.category)?.icon || '📋'}</span>
                    <div>
                      <div className="text-sm font-medium text-foreground">{tx.title}</div>
                      <div className="text-xs text-muted-foreground">{tx.performer} · {tx.date}</div>
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-4">
                    <div className="flex items-center gap-0.5">
                      <Star className="w-3 h-3 text-warning fill-warning" />
                      <span className="text-xs font-medium text-foreground">{tx.rating || '—'}</span>
                    </div>
                    <div className="text-sm font-semibold text-foreground w-16 text-right">{tx.price} ₽</div>
                    <span className={`chip text-[10px] px-2 py-0.5 ${tx.status === 'done' ? 'status-done' : 'status-cancelled'}`}>
                      {tx.status === 'done' ? 'Завершена' : 'Отменена'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right - Detail panel */}
          <div className="w-80 shrink-0">
            {selectedTransaction ? (
              <div className="card-surface p-5 sticky top-20 animate-fade-in">
                <h3 className="font-semibold text-sm text-foreground mb-4">Детали сделки</h3>
                <div className="space-y-3">
                  <div>
                    <div className="text-[11px] text-muted-foreground">Услуга</div>
                    <div className="text-sm font-medium text-foreground">{selectedTransaction.title}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-muted-foreground">Исполнитель</div>
                    <div className="text-sm text-foreground">{selectedTransaction.performer}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-muted-foreground">Цена</div>
                    <div className="text-lg font-semibold text-foreground">{selectedTransaction.price} ₽</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-muted-foreground">Дата</div>
                    <div className="text-sm text-foreground">{selectedTransaction.date}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-muted-foreground">Рейтинг</div>
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: selectedTransaction.rating }).map((_, j) => (
                        <Star key={j} className="w-3.5 h-3.5 text-warning fill-warning" />
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-muted-foreground">Статус</div>
                    <span className={`chip text-xs px-2 py-0.5 ${selectedTransaction.status === 'done' ? 'status-done' : 'status-cancelled'}`}>
                      {selectedTransaction.status === 'done' ? 'Завершена' : 'Отменена'}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="card-surface p-5 text-center">
                <p className="text-sm text-muted-foreground">Выберите сделку для просмотра деталей</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <CreateRequestModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
};

export default Analytics;
