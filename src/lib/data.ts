export type TaskStatus = 'open' | 'offers' | 'progress' | 'done' | 'cancelled';
export type Urgency = 'urgent' | 'today' | 'week' | 'none';
export type PaymentType = 'money' | 'exchange' | 'offers';

export interface Task {
  id: string;
  title: string;
  description: string;
  category: string;
  categoryIcon: string;
  dorm: string;
  status: TaskStatus;
  urgency: Urgency;
  paymentType: PaymentType;
  price?: number;
  offersCount: number;
  requesterName: string;
  requesterRating: number;
  requesterAvatar: string;
  createdAt: string;
}

export interface Transaction {
  id: string;
  category: string;
  title: string;
  price: number;
  date: string;
  status: 'done' | 'cancelled';
  performer: string;
  rating: number;
}

export const STATUS_LABELS: Record<TaskStatus, string> = {
  open: 'Открыта',
  offers: 'Есть предложения',
  progress: 'В работе',
  done: 'Завершена',
  cancelled: 'Отменена',
};

export const URGENCY_LABELS: Record<Urgency, string> = {
  urgent: 'Срочно',
  today: 'Сегодня',
  week: 'На неделе',
  none: 'Без срока',
};

export const PAYMENT_LABELS: Record<PaymentType, string> = {
  money: 'Деньги',
  exchange: 'Услуга взамен',
  offers: 'Получить предложения',
};

export const CATEGORIES = [
  { id: 'all', label: 'Все', icon: '📋' },
  { id: 'delivery', label: 'Доставка', icon: '🚀' },
  { id: 'tutoring', label: 'Репетиторство', icon: '📚' },
  { id: 'repair', label: 'Ремонт', icon: '🔧' },
  { id: 'cleaning', label: 'Уборка', icon: '🧹' },
  { id: 'food', label: 'Еда', icon: '🍕' },
  { id: 'printing', label: 'Печать', icon: '🖨️' },
  { id: 'moving', label: 'Переезд', icon: '📦' },
  { id: 'tech', label: 'Техника', icon: '💻' },
  { id: 'other', label: 'Другое', icon: '✨' },
];

export const SAMPLE_TASKS: Task[] = [
  {
    id: '1',
    title: 'Помочь перенести мебель с 3 на 7 этаж',
    description: 'Нужна помощь с переносом стола и двух стульев. Лифт не работает, нужны сильные руки. Примерно 30 минут работы.',
    category: 'moving',
    categoryIcon: '📦',
    dorm: 'Общежитие №4',
    status: 'open',
    urgency: 'urgent',
    paymentType: 'money',
    price: 800,
    offersCount: 3,
    requesterName: 'Алексей М.',
    requesterRating: 4.8,
    requesterAvatar: 'АМ',
    createdAt: '15 мин назад',
  },
  {
    id: '2',
    title: 'Репетитор по математическому анализу',
    description: 'Ищу репетитора по матану, подготовка к экзамену. 2-3 занятия в неделю по 1.5 часа.',
    category: 'tutoring',
    categoryIcon: '📚',
    dorm: 'Корпус Б',
    status: 'offers',
    urgency: 'week',
    paymentType: 'money',
    price: 500,
    offersCount: 7,
    requesterName: 'Мария К.',
    requesterRating: 4.9,
    requesterAvatar: 'МК',
    createdAt: '1 час назад',
  },
  {
    id: '3',
    title: 'Забрать заказ из пункта выдачи',
    description: 'Заказ в Wildberries на Ленина 42. Нужно забрать и принести в общагу до 18:00.',
    category: 'delivery',
    categoryIcon: '🚀',
    dorm: 'Общежитие №2',
    status: 'open',
    urgency: 'today',
    paymentType: 'money',
    price: 200,
    offersCount: 1,
    requesterName: 'Дмитрий В.',
    requesterRating: 4.5,
    requesterAvatar: 'ДВ',
    createdAt: '2 часа назад',
  },
  {
    id: '4',
    title: 'Починить кран в ванной',
    description: 'Течёт кран, нужен кто-то с инструментами и опытом.',
    category: 'repair',
    categoryIcon: '🔧',
    dorm: 'Общежитие №4',
    status: 'open',
    urgency: 'week',
    paymentType: 'offers',
    offersCount: 0,
    requesterName: 'Елена С.',
    requesterRating: 5.0,
    requesterAvatar: 'ЕС',
    createdAt: '3 часа назад',
  },
  {
    id: '5',
    title: 'Напечатать курсовую работу, 50 страниц',
    description: 'Нужно напечатать и сброшюровать курсовую. Файл готов, нужен принтер.',
    category: 'printing',
    categoryIcon: '🖨️',
    dorm: 'Корпус А',
    status: 'progress',
    urgency: 'today',
    paymentType: 'money',
    price: 350,
    offersCount: 2,
    requesterName: 'Олег Н.',
    requesterRating: 4.7,
    requesterAvatar: 'ОН',
    createdAt: '5 часов назад',
  },
  {
    id: '6',
    title: 'Приготовить ужин на 4 человека',
    description: 'День рождения соседа, нужен кто-то, кто хорошо готовит. Продукты куплю сам.',
    category: 'food',
    categoryIcon: '🍕',
    dorm: 'Общежитие №1',
    status: 'open',
    urgency: 'today',
    paymentType: 'exchange',
    offersCount: 4,
    requesterName: 'Игорь Л.',
    requesterRating: 4.3,
    requesterAvatar: 'ИЛ',
    createdAt: '6 часов назад',
  },
  {
    id: '7',
    title: 'Настроить роутер и Wi-Fi',
    description: 'Купил новый роутер, не могу настроить. Нужна помощь с подключением.',
    category: 'tech',
    categoryIcon: '💻',
    dorm: 'Общежитие №3',
    status: 'open',
    urgency: 'none',
    paymentType: 'money',
    price: 300,
    offersCount: 2,
    requesterName: 'Анна П.',
    requesterRating: 4.6,
    requesterAvatar: 'АП',
    createdAt: '8 часов назад',
  },
  {
    id: '8',
    title: 'Генеральная уборка комнаты',
    description: 'Комната 18 кв.м, нужна полная уборка: пол, окна, пыль.',
    category: 'cleaning',
    categoryIcon: '🧹',
    dorm: 'Общежитие №2',
    status: 'done',
    urgency: 'none',
    paymentType: 'money',
    price: 600,
    offersCount: 5,
    requesterName: 'Виктор Г.',
    requesterRating: 4.4,
    requesterAvatar: 'ВГ',
    createdAt: '1 день назад',
  },
];

export const SAMPLE_TRANSACTIONS: Transaction[] = [
  { id: 't1', category: 'delivery', title: 'Доставка из Ozon', price: 150, date: '12 мар', status: 'done', performer: 'Кирилл А.', rating: 5 },
  { id: 't2', category: 'delivery', title: 'Забрать посылку', price: 200, date: '11 мар', status: 'done', performer: 'Саша М.', rating: 4 },
  { id: 't3', category: 'tutoring', title: 'Репетитор по физике', price: 600, date: '10 мар', status: 'done', performer: 'Ольга В.', rating: 5 },
  { id: 't4', category: 'cleaning', title: 'Уборка кухни', price: 400, date: '9 мар', status: 'done', performer: 'Нина К.', rating: 4 },
  { id: 't5', category: 'repair', title: 'Починить розетку', price: 500, date: '8 мар', status: 'done', performer: 'Павел Д.', rating: 5 },
  { id: 't6', category: 'delivery', title: 'Доставка еды', price: 180, date: '7 мар', status: 'done', performer: 'Кирилл А.', rating: 4 },
  { id: 't7', category: 'printing', title: 'Печать диплома', price: 450, date: '6 мар', status: 'cancelled', performer: 'Лена П.', rating: 0 },
  { id: 't8', category: 'tech', title: 'Настройка ноутбука', price: 350, date: '5 мар', status: 'done', performer: 'Миша Р.', rating: 5 },
  { id: 't9', category: 'moving', title: 'Перенос вещей', price: 700, date: '4 мар', status: 'done', performer: 'Коля Б.', rating: 4 },
  { id: 't10', category: 'food', title: 'Готовка обеда', price: 300, date: '3 мар', status: 'done', performer: 'Света Л.', rating: 5 },
];

export const PRICE_HISTOGRAM = [
  { range: '0-200', count: 12 },
  { range: '200-400', count: 28 },
  { range: '400-600', count: 22 },
  { range: '600-800', count: 15 },
  { range: '800-1000', count: 8 },
  { range: '1000+', count: 4 },
];
