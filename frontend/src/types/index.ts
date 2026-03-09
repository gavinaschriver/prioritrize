export interface Prioritry {
  id: string;
  user_id: string;
  name: string;
  type_id: number;
  type_name: 'Goal' | 'Bonus';
  point_value: number;
  can_repeat: boolean;
  timeblock: number | null;
  comments_enabled: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PrioritryCreate {
  name: string;
  type_id: number;
  point_value: number;
  can_repeat: boolean;
  timeblock: number | null;
  comments_enabled: boolean;
}

export interface Entry {
  id: string;
  prioritry_id: string;
  user_id: string;
  prioritry_name?: string;
  comment: string | null;
  created_at: string;
}

export interface EntryBrief {
  id: string;
  comment: string | null;
  created_at: string;
}

export interface DayPrioritrySummary {
  prioritry_id: string;
  name: string;
  point_value: number;
  can_repeat: boolean;
  comments_enabled: boolean;
  timeblock: number | null;
  entry_count: number;
  total_value: number;
  entries: EntryBrief[];
}

export interface Todo {
  id: string;
  user_id: string;
  name: string;
  point_value: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TodoSummary {
  id: string;
  name: string;
  point_value: number;
  completed_at: string | null;
  created_at: string;
  score: number;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  point_value: number;
  due_date: string;
  overview: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectUpdate {
  id: string;
  project_id: string;
  user_id: string;
  body: string;
  created_at: string;
}

export interface ProjectDetail extends Project {
  updates: ProjectUpdate[];
}

export interface ProjectSummary {
  id: string;
  name: string;
  point_value: number;
  due_date: string;
  completed_at: string | null;
  score: number;
  is_upcoming: boolean;
}

export interface DaySummary {
  date: string;
  timezone: string;
  goals: DayPrioritrySummary[];
  bonuses: DayPrioritrySummary[];
  todos: TodoSummary[];
  projects: ProjectSummary[];
  goals_subtotal: number;
  bonuses_subtotal: number;
  todos_subtotal: number;
  projects_subtotal: number;
  daily_score: number;
}

export interface Balance {
  past_total: number;
  today_score: number;
  current_balance: number;
}
