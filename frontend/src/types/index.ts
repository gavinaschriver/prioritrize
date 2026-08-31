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
  /** How many timeblocks this single entry represents. */
  quantity: number;
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
  due_date: string | null;
  /** What to accomplish and how. */
  description: string | null;
  /** How the doing of it actually went. */
  comment: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TodoSummary {
  id: string;
  name: string;
  point_value: number;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  score: number;
  is_upcoming: boolean;
  /** What to accomplish and how. */
  description: string | null;
  /** How the doing of it actually went. */
  comment: string | null;
  // The due date this day was actually scored against; differs from due_date only
  // when the item was deferred out from under this day.
  effective_due_date: string | null;
  // This day's dock is owed to that deferral, not to the item's current due date.
  deferred: boolean;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  point_value: number | null;
  due_date: string | null;
  overview: string | null;
  /** Manual position on the Projects page, low to high. */
  sort_order: number;
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

export interface ProjectTask {
  id: string;
  project_id: string;
  user_id: string;
  name: string;
  point_value: number;
  due_date: string | null;
  /** What to accomplish and how. */
  description: string | null;
  /** How the doing of it actually went. */
  comment: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectDetail extends Project {
  updates: ProjectUpdate[];
  tasks: ProjectTask[];
}

export interface DeadlineSummary {
  id: string;
  type: 'project' | 'task';
  name: string;
  project_id: string | null;
  project_name: string | null;
  point_value: number | null;
  due_date: string | null;
  created_at: string;
  completed_at: string | null;
  score: number;
  is_upcoming: boolean;
  /** What to accomplish and how. */
  description: string | null;
  /** How the doing of it actually went. */
  comment: string | null;
  // The due date this day was actually scored against; differs from due_date only
  // when the item was deferred out from under this day.
  effective_due_date: string | null;
  // This day's dock is owed to that deferral, not to the item's current due date.
  deferred: boolean;
}

export interface DaySummary {
  date: string;
  timezone: string;
  goals: DayPrioritrySummary[];
  bonuses: DayPrioritrySummary[];
  todos: TodoSummary[];
  deadlines: DeadlineSummary[];
  // Undated projects completed today. They have no due date to sort by, so they
  // are kept out of `deadlines` and scored in their own subtotal.
  rolling: DeadlineSummary[];
  goals_subtotal: number;
  bonuses_subtotal: number;
  todos_subtotal: number;
  deadlines_subtotal: number;
  rolling_subtotal: number;
  daily_score: number;
}

export interface Balance {
  past_total: number;
  today_score: number;
  current_balance: number;
}

export interface PrioritryStats {
  prioritry_id: string;
  name: string;
  type_name: 'Goal' | 'Bonus';
  timeblock: number | null;
  entry_count: number;
  total_minutes: number | null;
}

export interface TodoStats {
  id: string;
  name: string;
  completed_in_range: boolean;
}

export interface TagStats {
  tag: string;
  count: number;
}

/** Same shape as TagStats, but unscoped by date — feeds tag autocomplete. */
export interface TagSuggestion {
  tag: string;
  count: number;
}

export interface DashboardData {
  start: string;
  end: string;
  prioritry_stats: PrioritryStats[];
  todo_stats: TodoStats[];
  tag_stats: TagStats[];
}

// amount/total arrive as strings — Pydantic serializes Decimal to string.
export interface Spend {
  id: string;
  user_id: string;
  amount: string;
  comment: string | null;
  created_at: string;
}

export interface SpendDay {
  items: Spend[];
  total: string;
}
