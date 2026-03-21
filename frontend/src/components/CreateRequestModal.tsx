import { X } from 'lucide-react';
import { type FormEvent, useMemo, useState } from 'react';

import { useInteractionStore } from '@/context/interaction-store';
import { CATEGORIES, URGENCY_LABELS, type Task, type Urgency } from '@/lib/data';
import { toast } from '@/hooks/use-toast';

interface CreateRequestModalProps {
  open: boolean;
  onClose: () => void;
}

type VisibilityMode = 'dorm' | 'campus' | 'floor';

const CATEGORY_OPTIONS = CATEGORIES.filter((category) => category.id !== 'all');

export function CreateRequestModal({ open, onClose }: CreateRequestModalProps) {
  const { selectedDorm, addLocalTask, addNotification } = useInteractionStore();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(CATEGORY_OPTIONS[0]?.id ?? 'other');
  const [urgency, setUrgency] = useState<Urgency>('none');
  const [paymentMode, setPaymentMode] = useState<'fixed' | 'offers'>('fixed');
  const [price, setPrice] = useState('');
  const [visibility, setVisibility] = useState<VisibilityMode>('dorm');
  const [errors, setErrors] = useState<{ title?: string; description?: string; price?: string }>({});

  const visibilityLabel = useMemo(() => {
    if (visibility === 'campus') {
      return 'Весь кампус';
    }

    if (visibility === 'floor') {
      return `${selectedDorm}, мой этаж`;
    }

    return selectedDorm;
  }, [selectedDorm, visibility]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setCategory(CATEGORY_OPTIONS[0]?.id ?? 'other');
    setUrgency('none');
    setPaymentMode('fixed');
    setPrice('');
    setVisibility('dorm');
    setErrors({});
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();

    const nextErrors: { title?: string; description?: string; price?: string } = {};
    const normalizedTitle = title.trim();
    const normalizedDescription = description.trim();

    if (!normalizedTitle) {
      nextErrors.title = 'Укажите заголовок заявки';
    }

    if (!normalizedDescription) {
      nextErrors.description = 'Добавьте описание, чтобы исполнителю было понятно задание';
    }

    if (paymentMode === 'fixed') {
      const parsed = Number(price);
      if (!price || Number.isNaN(parsed) || parsed <= 0) {
        nextErrors.price = 'Введите корректную цену';
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const categoryInfo = CATEGORY_OPTIONS.find((entry) => entry.id === category) ?? CATEGORY_OPTIONS[0];

    const task: Task = {
      id: `local-${Date.now()}`,
      title: normalizedTitle,
      description: normalizedDescription,
      category: categoryInfo.id,
      categoryIcon: categoryInfo.icon,
      dorm: visibilityLabel,
      status: 'open',
      urgency,
      paymentType: paymentMode === 'fixed' ? 'money' : 'offers',
      price: paymentMode === 'fixed' ? Number(price) : undefined,
      offersCount: 0,
      requesterName: 'Вы',
      requesterRating: 5,
      requesterAvatar: 'ВЫ',
      createdAt: 'только что',
    };

    addLocalTask(task);
    addNotification({
      type: 'request-created',
      title: 'Заявка создана',
      description: `«${task.title}» опубликована в разделе ${categoryInfo.label}`,
      taskId: task.id,
    });

    toast({
      title: 'Заявка опубликована',
      description: 'Она уже доступна в ленте задач.',
    });

    handleClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-foreground/20 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative card-surface w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-foreground">Создать заявку</h2>
          <button onClick={handleClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-accent transition-colors" type="button">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Заголовок</label>
            <input
              type="text"
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }));
              }}
              placeholder="Кратко опишите, что нужно сделать"
              className="w-full h-10 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {errors.title ? (
              <p className="text-[11px] text-destructive mt-1">{errors.title}</p>
            ) : (
              <p className="text-[11px] text-muted-foreground mt-1">Хороший заголовок получает больше откликов</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Описание</label>
            <textarea
              rows={4}
              value={description}
              onChange={(event) => {
                setDescription(event.target.value);
                if (errors.description) setErrors((prev) => ({ ...prev, description: undefined }));
              }}
              placeholder="Подробно опишите задачу, условия, сроки..."
              className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
            {errors.description && <p className="text-[11px] text-destructive mt-1">{errors.description}</p>}
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Категория</label>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="w-full h-10 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring appearance-none"
            >
              {CATEGORY_OPTIONS.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.icon} {cat.label}</option>
              ))}
            </select>
          </div>

          {/* Urgency */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Срочность</label>
            <div className="flex gap-2">
              {(['urgent', 'today', 'week', 'none'] as const).map((itemUrgency) => (
                <button
                  key={itemUrgency}
                  className={`chip text-xs flex-1 justify-center ${itemUrgency === urgency ? 'chip-active' : 'chip-inactive'}`}
                  onClick={() => setUrgency(itemUrgency)}
                  type="button"
                >
                  {URGENCY_LABELS[itemUrgency]}
                </button>
              ))}
            </div>
          </div>

          {/* Payment */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Оплата</label>
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setPaymentMode('fixed')}
                className={`chip flex-1 justify-center text-xs ${paymentMode === 'fixed' ? 'chip-active' : 'chip-inactive'}`}
                type="button"
              >
                Фиксированная цена
              </button>
              <button
                onClick={() => setPaymentMode('offers')}
                className={`chip flex-1 justify-center text-xs ${paymentMode === 'offers' ? 'chip-active' : 'chip-inactive'}`}
                type="button"
              >
                Получить предложения
              </button>
            </div>
            {paymentMode === 'fixed' && (
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  value={price}
                  onChange={(event) => {
                    setPrice(event.target.value);
                    if (errors.price) setErrors((prev) => ({ ...prev, price: undefined }));
                  }}
                  placeholder="0"
                  className="w-full h-10 px-3 pr-8 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₽</span>
              </div>
            )}
            {errors.price && <p className="text-[11px] text-destructive mt-1">{errors.price}</p>}
          </div>

          {/* Visibility */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Видимость</label>
            <select
              value={visibility}
              onChange={(event) => setVisibility(event.target.value as VisibilityMode)}
              className="w-full h-10 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring appearance-none"
            >
              <option value="dorm">Моё общежитие ({selectedDorm})</option>
              <option value="campus">Весь кампус</option>
              <option value="floor">Только мой этаж</option>
            </select>
          </div>

          {/* Submit */}
          <button className="w-full h-11 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors" type="submit">
            Создать заявку
          </button>
        </form>
      </div>
    </div>
  );
}
