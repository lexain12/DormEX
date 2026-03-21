import { type FormEvent, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Clock, MessageSquare, Send, Star } from 'lucide-react';
import { Bar, BarChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { CreateRequestModal } from '@/components/CreateRequestModal';
import { TopNav } from '@/components/TopNav';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useInteractionStore } from '@/context/interaction-store';
import { toast } from '@/hooks/use-toast';
import {
  PAYMENT_LABELS,
  PRICE_HISTOGRAM,
  SAMPLE_TASKS,
  SAMPLE_TRANSACTIONS,
  STATUS_LABELS,
  URGENCY_LABELS,
} from '@/lib/data';

type ActionModal = 'service' | 'price' | 'message' | null;

const ACTION_LABELS = {
  'service-offer': 'Предложена услуга',
  'price-offer': 'Отправлена цена',
  message: 'Отправлено сообщение',
} as const;

const TaskDetail = () => {
  const { id } = useParams();
  const [createOpen, setCreateOpen] = useState(false);
  const [actionModal, setActionModal] = useState<ActionModal>(null);
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);

  const [serviceTitle, setServiceTitle] = useState('');
  const [serviceDescription, setServiceDescription] = useState('');
  const [serviceEta, setServiceEta] = useState('');
  const [priceValue, setPriceValue] = useState('');
  const [priceComment, setPriceComment] = useState('');
  const [messageValue, setMessageValue] = useState('');

  const [serviceError, setServiceError] = useState<string | null>(null);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [messageError, setMessageError] = useState<string | null>(null);

  const { localTasks, taskInteractions, addTaskInteraction, addNotification } = useInteractionStore();
  const allTasks = useMemo(() => [...localTasks, ...SAMPLE_TASKS], [localTasks]);
  const task = allTasks.find((entry) => entry.id === id) ?? allTasks[0];

  const urgencyClass =
    task.urgency === 'urgent' ? 'urgency-urgent' :
      task.urgency === 'today' ? 'urgency-today' :
        task.urgency === 'week' ? 'urgency-week' : 'chip-inactive';

  const statusClass =
    task.status === 'open' ? 'status-open' :
      task.status === 'offers' ? 'status-offers' :
        task.status === 'progress' ? 'status-progress' :
          task.status === 'done' ? 'status-done' : 'status-cancelled';

  const categoryTransactions = SAMPLE_TRANSACTIONS.filter((entry) => entry.category === task.category);
  const selectedTransaction = categoryTransactions.find((entry) => entry.id === selectedTransactionId);
  const taskHistory = taskInteractions
    .filter((entry) => entry.taskId === task.id)
    .slice(0, 3);

  const closeActionModal = () => {
    setActionModal(null);
    setServiceError(null);
    setPriceError(null);
    setMessageError(null);
  };

  const handleServiceSubmit = (event: FormEvent) => {
    event.preventDefault();
    const normalizedTitle = serviceTitle.trim();

    if (!normalizedTitle) {
      setServiceError('Укажите, какую услугу вы предлагаете.');
      return;
    }

    const payload = [normalizedTitle, serviceDescription.trim(), serviceEta ? `Срок: ${serviceEta}` : '']
      .filter(Boolean)
      .join(' · ');

    addTaskInteraction({
      taskId: task.id,
      taskTitle: task.title,
      type: 'service-offer',
      content: payload,
    });

    addNotification({
      type: 'service-offer',
      title: 'Предложение услуги отправлено',
      description: `По задаче «${task.title}» вы предложили: ${normalizedTitle}`,
      taskId: task.id,
    });

    toast({
      title: 'Предложение отправлено',
      description: 'Событие сохранено локально и добавлено в уведомления.',
    });

    setServiceTitle('');
    setServiceDescription('');
    setServiceEta('');
    closeActionModal();
  };

  const handlePriceSubmit = (event: FormEvent) => {
    event.preventDefault();
    const normalizedPrice = Number(priceValue);

    if (!priceValue || Number.isNaN(normalizedPrice) || normalizedPrice <= 0) {
      setPriceError('Введите корректную сумму предложения.');
      return;
    }

    const payload = [priceComment.trim(), `${normalizedPrice} ₽`].filter(Boolean).join(' · ');

    addTaskInteraction({
      taskId: task.id,
      taskTitle: task.title,
      type: 'price-offer',
      content: payload,
      amount: normalizedPrice,
    });

    addNotification({
      type: 'price-offer',
      title: 'Ценовое предложение отправлено',
      description: `По задаче «${task.title}» вы предложили ${normalizedPrice} ₽`,
      taskId: task.id,
    });

    toast({
      title: 'Цена отправлена',
      description: 'Ваше предложение сохранено и доступно в панели уведомлений.',
    });

    setPriceValue('');
    setPriceComment('');
    closeActionModal();
  };

  const handleMessageSubmit = (event: FormEvent) => {
    event.preventDefault();
    const normalizedMessage = messageValue.trim();

    if (!normalizedMessage) {
      setMessageError('Сообщение не может быть пустым.');
      return;
    }

    addTaskInteraction({
      taskId: task.id,
      taskTitle: task.title,
      type: 'message',
      content: normalizedMessage,
    });

    addNotification({
      type: 'message',
      title: 'Сообщение отправлено',
      description: `По задаче «${task.title}» отправлено новое сообщение.`,
      taskId: task.id,
    });

    toast({
      title: 'Сообщение отправлено',
      description: 'Диалог сохранён локально и отображён в уведомлениях.',
    });

    setMessageValue('');
    closeActionModal();
  };

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
                    {categoryTransactions.slice(0, 5).map((tx) => {
                      const isSelected = tx.id === selectedTransactionId;

                      return (
                        <button
                          key={tx.id}
                          type="button"
                          onClick={() => setSelectedTransactionId(isSelected ? null : tx.id)}
                          className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors text-left ${
                            isSelected ? 'bg-primary/10' : 'hover:bg-accent'
                          }`}
                        >
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
                        </button>
                      );
                    })}
                  </div>

                  {selectedTransaction && (
                    <div className="mt-3 p-3 rounded-lg border border-border bg-secondary/50">
                      <div className="text-sm font-medium text-foreground">{selectedTransaction.title}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Исполнитель: {selectedTransaction.performer} · Статус: {selectedTransaction.status === 'done' ? 'завершена' : 'отменена'}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right panel */}
          <div className="w-80 shrink-0 space-y-4">
            <div className="card-surface p-5 space-y-3 sticky top-20">
              <button
                onClick={() => setActionModal('service')}
                className="w-full h-11 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                Предложить услугу
              </button>
              <button
                onClick={() => setActionModal('price')}
                className="w-full h-11 rounded-lg border border-border text-foreground font-medium text-sm hover:bg-accent transition-colors"
              >
                Предложить цену
              </button>
              <button
                onClick={() => setActionModal('message')}
                className="w-full h-11 rounded-lg border border-border text-muted-foreground font-medium text-sm hover:bg-accent transition-colors flex items-center justify-center gap-2"
              >
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

            {taskHistory.length > 0 && (
              <div className="card-surface p-4">
                <h4 className="text-sm font-semibold text-foreground mb-3">Ваши последние действия</h4>
                <div className="space-y-2">
                  {taskHistory.map((entry) => (
                    <div key={entry.id} className="p-2.5 rounded-lg bg-secondary">
                      <div className="text-xs font-medium text-foreground">{ACTION_LABELS[entry.type]}</div>
                      <div className="text-xs text-muted-foreground mt-1">{entry.content}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={actionModal === 'service'} onOpenChange={(open) => { if (!open) closeActionModal(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Предложить услугу</DialogTitle>
            <DialogDescription>Опишите, как вы готовы выполнить задачу.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleServiceSubmit}>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Название услуги</label>
              <input
                type="text"
                value={serviceTitle}
                onChange={(event) => {
                  setServiceTitle(event.target.value);
                  if (serviceError) setServiceError(null);
                }}
                className="w-full h-10 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Например: Перенесу мебель вдвоём"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Комментарий</label>
              <textarea
                rows={3}
                value={serviceDescription}
                onChange={(event) => setServiceDescription(event.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                placeholder="Коротко опишите опыт и условия"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Срок выполнения</label>
              <input
                type="text"
                value={serviceEta}
                onChange={(event) => setServiceEta(event.target.value)}
                className="w-full h-10 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Например: сегодня до 20:00"
              />
            </div>
            {serviceError && <p className="text-xs text-destructive">{serviceError}</p>}
            <button type="submit" className="w-full h-11 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
              Отправить предложение
            </button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={actionModal === 'price'} onOpenChange={(open) => { if (!open) closeActionModal(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Предложить цену</DialogTitle>
            <DialogDescription>Укажите вашу стоимость и при необходимости добавьте комментарий.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handlePriceSubmit}>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Сумма</label>
              <div className="relative">
                <input
                  type="number"
                  min={1}
                  value={priceValue}
                  onChange={(event) => {
                    setPriceValue(event.target.value);
                    if (priceError) setPriceError(null);
                  }}
                  className="w-full h-10 px-3 pr-8 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="0"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₽</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Комментарий</label>
              <textarea
                rows={3}
                value={priceComment}
                onChange={(event) => setPriceComment(event.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                placeholder="Например: могу начать через 30 минут"
              />
            </div>
            {priceError && <p className="text-xs text-destructive">{priceError}</p>}
            <button type="submit" className="w-full h-11 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
              Отправить цену
            </button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={actionModal === 'message'} onOpenChange={(open) => { if (!open) closeActionModal(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Написать сообщение</DialogTitle>
            <DialogDescription>Отправьте короткое сообщение автору задачи.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleMessageSubmit}>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Текст сообщения</label>
              <textarea
                rows={5}
                value={messageValue}
                onChange={(event) => {
                  setMessageValue(event.target.value);
                  if (messageError) setMessageError(null);
                }}
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                placeholder="Привет! Могу помочь с этой задачей..."
              />
            </div>
            {messageError && <p className="text-xs text-destructive">{messageError}</p>}
            <button type="submit" className="w-full h-11 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
              Отправить сообщение
            </button>
          </form>
        </DialogContent>
      </Dialog>

      <CreateRequestModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
};

export default TaskDetail;
