export interface ApiErrorShape {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
  detail?: string;
}

export interface UniversityShort {
  id: number;
  name: string;
}

export interface DormitoryShort {
  id: number;
  name: string;
}

export interface UserShort {
  id: number;
  full_name: string;
  rating_avg?: number;
  avatar_url?: string | null;
  completed_tasks_count?: number;
}

export interface RoleMetricsDto {
  rating_avg: number;
  reviews_count: number;
  completed_tasks_count: number;
}

export interface MeUser {
  id: number;
  email: string;
  full_name: string;
  role: string;
  university?: UniversityShort | null;
  dormitory?: DormitoryShort | null;
  profile_completed?: boolean;
  room_label?: string | null;
  bio?: string | null;
}

export interface AuthLoginResponse {
  access_token: string;
  refresh_token: string;
  user: MeUser;
}

export interface AuthRequestCodeResponse {
  status: string;
  expires_in_sec: number;
}

export type ApiTaskStatus = "open" | "offers" | "in_progress" | "completed" | "cancelled";
export type ApiUrgency = "urgent" | "today" | "this_week" | "flexible";
export type ApiPaymentType = "fixed_price" | "negotiable" | "barter";

export interface TaskListItemDto {
  id: number;
  title: string;
  description: string;
  category: string;
  urgency: ApiUrgency;
  payment_type: ApiPaymentType;
  price_amount: number | null;
  barter_description?: string | null;
  status: ApiTaskStatus;
  visibility?: "dormitory" | "university";
  offers_count?: number;
  created_at: string;
  customer?: UserShort;
  university?: UniversityShort;
  dormitory?: DormitoryShort | null;
}

export interface TaskListResponse {
  items: TaskListItemDto[];
  total: number;
  limit: number;
  offset: number;
}

export interface TaskDetailDto extends TaskListItemDto {
  accepted_offer?: OfferDto | null;
  can_respond?: boolean;
  can_choose_performer?: boolean;
  analytics?: CategoryAnalyticsDto | null;
  chat_id?: number | null;
  completion_confirmation_status?: string | null;
  completion_confirmed_by_me?: boolean;
  review_summary?: TaskReviewSummaryDto | null;
}

export interface CreateTaskPayload {
  title: string;
  description: string;
  category: string;
  urgency: ApiUrgency;
  payment_type: ApiPaymentType;
  price_amount: number | null;
  barter_description: string | null;
  visibility: "dormitory" | "university";
  dormitory_id: number | null;
}

export interface OfferDto {
  id: number;
  task_id: number;
  performer?: UserShort;
  message: string;
  price_amount: number | null;
  payment_type: ApiPaymentType;
  barter_description: string | null;
  status: "pending" | "accepted" | "rejected" | "withdrawn";
  created_at: string;
}

export interface CreateOfferPayload {
  message: string;
  price_amount: number | null;
  payment_type: ApiPaymentType;
  barter_description: string | null;
}

export interface UpdateOfferPayload extends Partial<CreateOfferPayload> {
  message?: string;
}

export interface CounterOfferDto {
  id: number;
  offer_id: number;
  author_user_id: number;
  message: string | null;
  payment_type: ApiPaymentType;
  price_amount: number | null;
  barter_description: string | null;
  status: "pending" | "accepted" | "rejected" | "superseded";
  created_at: string;
  updated_at?: string;
}

export interface CreateCounterOfferPayload {
  message: string | null;
  payment_type: ApiPaymentType;
  price_amount: number | null;
  barter_description: string | null;
}

export interface TaskReviewDto {
  id: number;
  task_id: number;
  task_assignment_id: number;
  rating: number;
  comment: string | null;
  is_visible: boolean;
  moderation_status: string;
  created_at: string;
  updated_at: string;
  author: {
    id: number;
    full_name: string;
    role: "customer" | "performer";
  };
  target: {
    id: number;
    full_name: string;
    role: "customer" | "performer";
  };
}

export interface TaskReviewSummaryDto {
  assignment_id: number;
  status: string;
  my_role: "customer" | "performer" | null;
  counterpart_user: {
    id: number;
    full_name: string;
    role: "customer" | "performer";
  } | null;
  can_leave_review: boolean;
  pending_by_me: boolean;
  pending_by_counterpart: boolean;
  my_review: TaskReviewDto | null;
  counterpart_review: TaskReviewDto | null;
  customer_review: TaskReviewDto | null;
  performer_review: TaskReviewDto | null;
}

export interface NotificationDto {
  id: number;
  type: string;
  title: string;
  body: string;
  entity_type?: string | null;
  entity_id?: number | null;
  payload?: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
}

export interface NotificationsResponse {
  items: NotificationDto[];
  unread_count: number;
  limit: number;
  offset: number;
}

export interface UnreadCountResponse {
  unread_count: number;
}

export interface ChatDto {
  id: number;
  task_id?: number;
  customer_id: number;
  performer_id: number;
  created_at: string;
  updated_at: string;
}

export interface ChatMessageDto {
  id: number;
  chat_id: number;
  sender_id: number;
  message_type: string;
  body: string;
  created_at: string;
  read_at: string | null;
}

export interface ChatMessagesResponse {
  items?: ChatMessageDto[];
  messages?: ChatMessageDto[];
  limit?: number;
  before_message_id?: number;
}

export interface CategoryAnalyticsDto {
  category: string;
  completed_tasks_count: number;
  avg_price_amount: number;
  median_price_amount: number;
  min_price_amount: number;
  max_price_amount: number;
  avg_completion_minutes: number;
  price_histogram: Array<{ range: string; count: number }>;
}

export interface UserProfileDto {
  id: number;
  full_name: string;
  avatar_url: string | null;
  dormitory?: {
    id: number;
    name: string;
  } | null;
  rating_avg: number;
  reviews_count: number;
  completed_tasks_count: number;
  created_tasks_count: number;
  customer_metrics?: RoleMetricsDto;
  performer_metrics?: RoleMetricsDto;
  badges?: string[];
}

export interface UserReviewDto {
  id?: number;
  rating: number;
  comment?: string | null;
  created_at?: string;
  task_id?: number;
  task_title?: string;
  author_role?: "customer" | "performer";
  target_role?: "customer" | "performer";
  author?: {
    id?: number;
    full_name?: string;
  } | null;
  author_name?: string;
}

export interface UserTaskDto {
  id: number;
  title?: string;
  description?: string;
  category?: string;
  urgency?: ApiUrgency;
  payment_type?: ApiPaymentType;
  price_amount?: number | null;
  status?: ApiTaskStatus;
  offers_count?: number;
  created_at?: string;
  completed_at?: string | null;
  cancelled_at?: string | null;
  role?: "customer" | "performer";
  dormitory?: {
    id: number;
    name: string;
  } | null;
  customer?: {
    id?: number;
    full_name?: string;
  } | null;
  performer?: {
    id?: number;
    full_name?: string;
  } | null;
  review_summary?: TaskReviewSummaryDto | null;
}
