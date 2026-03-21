import { X } from 'lucide-react';
import { useState } from 'react';
import { CATEGORIES, URGENCY_LABELS } from '@/lib/data';

interface CreateRequestModalProps {
  open: boolean;
  onClose: () => void;
}

export function CreateRequestModal({ open, onClose }: CreateRequestModalProps) {
  const [paymentMode, setPaymentMode] = useState<'fixed' | 'offers'>('fixed');

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-foreground/20 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card-surface w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-foreground">Создать заявку</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-accent transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="space-y-5">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Заголовок</label>
            <input
              type="text"
              placeholder="Кратко опишите, что нужно сделать"
              className="w-full h-10 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="text-[11px] text-muted-foreground mt-1">Хороший заголовок получает больше откликов</p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Описание</label>
            <textarea
              rows={4}
              placeholder="Подробно опишите задачу, условия, сроки..."
              className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Категория</label>
            <select className="w-full h-10 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring appearance-none">
              {CATEGORIES.filter(c => c.id !== 'all').map(cat => (
                <option key={cat.id} value={cat.id}>{cat.icon} {cat.label}</option>
              ))}
            </select>
          </div>

          {/* Urgency */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Срочность</label>
            <div className="flex gap-2">
              {(['urgent', 'today', 'week', 'none'] as const).map((u) => (
                <button key={u} className="chip chip-inactive text-xs flex-1 justify-center">
                  {URGENCY_LABELS[u]}
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
              >
                Фиксированная цена
              </button>
              <button
                onClick={() => setPaymentMode('offers')}
                className={`chip flex-1 justify-center text-xs ${paymentMode === 'offers' ? 'chip-active' : 'chip-inactive'}`}
              >
                Получить предложения
              </button>
            </div>
            {paymentMode === 'fixed' && (
              <div className="relative">
                <input
                  type="number"
                  placeholder="0"
                  className="w-full h-10 px-3 pr-8 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₽</span>
              </div>
            )}
          </div>

          {/* Visibility */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Видимость</label>
            <select className="w-full h-10 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring appearance-none">
              <option>Моё общежитие (№4)</option>
              <option>Весь кампус</option>
              <option>Только мой этаж</option>
            </select>
          </div>

          {/* Submit */}
          <button className="w-full h-11 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors">
            Создать заявку
          </button>
        </div>
      </div>
    </div>
  );
}
