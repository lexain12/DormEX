export type TaskStatus = "open" | "offers" | "progress" | "done" | "cancelled";
export type Urgency = "urgent" | "today" | "week" | "none";
export type PaymentType = "money" | "exchange" | "offers";

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
  status: "done" | "cancelled";
  performer: string;
  rating: number;
}

export const STATUS_LABELS: Record<TaskStatus, string> = {
  open: "Открыта",
  offers: "Есть предложения",
  progress: "В работе",
  done: "Завершена",
  cancelled: "Отменена",
};

export const URGENCY_LABELS: Record<Urgency, string> = {
  urgent: "Срочно",
  today: "Сегодня",
  week: "На неделе",
  none: "Без срока",
};

export const PAYMENT_LABELS: Record<PaymentType, string> = {
  money: "Деньги",
  exchange: "Услуга взамен",
  offers: "Договорная",
};

export const CATEGORIES = [
  { id: "all", label: "Все", icon: "📋" },
  { id: "delivery", label: "Доставка", icon: "🚀" },
  { id: "moving", label: "Перенос вещей", icon: "📦" },
  { id: "cleaning", label: "Уборка", icon: "🧹" },
  { id: "tech_help", label: "Техпомощь", icon: "💻" },
  { id: "study_help", label: "Учебная помощь", icon: "📚" },
  { id: "other", label: "Другое", icon: "✨" },
];

export const SAMPLE_TASKS: Task[] = [
  {
    id: "1",
    title: "Помочь перенести мебель с 3 на 7 этаж",
    description: "Нужна помощь с переносом стола и двух стульев. Лифт не работает.",
    category: "moving",
    categoryIcon: "📦",
    dorm: "Общежитие №4",
    status: "open",
    urgency: "urgent",
    paymentType: "money",
    price: 800,
    offersCount: 3,
    requesterName: "Алексей М.",
    requesterRating: 4.8,
    requesterAvatar: "АМ",
    createdAt: "15 мин назад",
  },
  {
    id: "2",
    title: "Забрать заказ из пункта выдачи",
    description: "Нужно забрать заказ и принести в общежитие до 18:00.",
    category: "delivery",
    categoryIcon: "🚀",
    dorm: "Общежитие №2",
    status: "offers",
    urgency: "today",
    paymentType: "money",
    price: 200,
    offersCount: 2,
    requesterName: "Мария К.",
    requesterRating: 4.9,
    requesterAvatar: "МК",
    createdAt: "1 час назад",
  },
  {
    id: "3",
    title: "Починить Wi-Fi в комнате",
    description: "Новый роутер, нужна помощь с настройкой и подключением устройств.",
    category: "tech_help",
    categoryIcon: "💻",
    dorm: "Общежитие №3",
    status: "open",
    urgency: "week",
    paymentType: "offers",
    offersCount: 1,
    requesterName: "Анна П.",
    requesterRating: 4.6,
    requesterAvatar: "АП",
    createdAt: "2 часа назад",
  },
  {
    id: "4",
    title: "Генеральная уборка комнаты",
    description: "Нужна полная уборка комнаты 18 кв.м.",
    category: "cleaning",
    categoryIcon: "🧹",
    dorm: "Общежитие №1",
    status: "done",
    urgency: "none",
    paymentType: "money",
    price: 650,
    offersCount: 4,
    requesterName: "Виктор Г.",
    requesterRating: 4.4,
    requesterAvatar: "ВГ",
    createdAt: "1 день назад",
  },
];

export const SAMPLE_TRANSACTIONS: Transaction[] = [
  { id: "t1", category: "delivery", title: "Доставка из Ozon", price: 150, date: "12 мар", status: "done", performer: "Кирилл А.", rating: 5 },
  { id: "t2", category: "delivery", title: "Забрать посылку", price: 200, date: "11 мар", status: "done", performer: "Саша М.", rating: 4 },
  { id: "t3", category: "study_help", title: "Печать курсовой", price: 600, date: "10 мар", status: "done", performer: "Ольга В.", rating: 5 },
  { id: "t4", category: "cleaning", title: "Уборка кухни", price: 400, date: "9 мар", status: "done", performer: "Нина К.", rating: 4 },
  { id: "t5", category: "moving", title: "Перенос вещей", price: 700, date: "8 мар", status: "done", performer: "Павел Д.", rating: 5 },
  { id: "t6", category: "tech_help", title: "Настройка ноутбука", price: 350, date: "7 мар", status: "done", performer: "Миша Р.", rating: 5 },
  { id: "t7", category: "other", title: "Помощь по бытовому вопросу", price: 450, date: "6 мар", status: "cancelled", performer: "Лена П.", rating: 0 },
  { id: "t8", category: "moving", title: "Поднять холодильник", price: 900, date: "5 мар", status: "done", performer: "Коля Б.", rating: 4 },
  { id: "t9", category: "study_help", title: "Помощь с презентацией", price: 300, date: "4 мар", status: "done", performer: "Света Л.", rating: 5 },
  { id: "t10", category: "delivery", title: "Доставка продуктов", price: 180, date: "3 мар", status: "done", performer: "Кирилл А.", rating: 4 },
];

export const PRICE_HISTOGRAM = [
  { range: "0-200", count: 12 },
  { range: "200-400", count: 28 },
  { range: "400-600", count: 22 },
  { range: "600-800", count: 15 },
  { range: "800-1000", count: 8 },
  { range: "1000+", count: 4 },
];
