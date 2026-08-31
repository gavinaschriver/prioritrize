import { useState } from "react";
import { getTodayStr } from "../lib/api";
import { useDaySummary } from "../hooks/useDaySummary";
import { CurrentBalance } from "../components/day-tracker/CurrentBalance";
import { DateNavigator } from "../components/day-tracker/DateNavigator";
import { YesterdayPrompt } from "../components/day-tracker/YesterdayPrompt";
import { TodosSection } from "../components/day-tracker/TodosSection";
import { GoalsSection } from "../components/day-tracker/GoalsSection";
import { BonusesSection } from "../components/day-tracker/BonusesSection";
import { DeadlinesSection } from "../components/day-tracker/DeadlinesSection";
import { DailyScoreSummary } from "../components/day-tracker/DailyScoreSummary";
import { AppliedDeferrals } from "../components/day-tracker/AppliedDeferrals";
import { CompletedToday } from "../components/day-tracker/CompletedToday";
import { SpendingInput } from "../components/day-tracker/SpendingInput";
import { SpendingLog } from "../components/day-tracker/SpendingLog";
import { CombinedQueueSection } from "../components/day-tracker/CombinedQueueSection";
import { DailyNotes } from "../components/day-tracker/DailyNotes";

type SectionKey = "queue" | "deadlines" | "todos" | "goals" | "bonuses";

export function DayTrackerPage() {
  const [selectedDate, setSelectedDate] = useState(getTodayStr());
  const [hybridView, setHybridView] = useState(
    () => localStorage.getItem("hybridView") === "true",
  );
  // Collapse state lives here so Expand All can drive every section at once.
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>(
    {
      queue: true,
      deadlines: false,
      todos: false,
      goals: false,
      bonuses: false,
    },
  );
  const { data: summary, isLoading, error } = useDaySummary(selectedDate);

  const isToday = selectedDate === getTodayStr();

  const toggleHybrid = () => {
    setHybridView((prev) => {
      localStorage.setItem("hybridView", String(!prev));
      return !prev;
    });
  };

  const toggleSection = (key: SectionKey) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  // Only the sections actually on screen count — the hybrid toggle hides the others.
  const visibleSections: SectionKey[] = hybridView
    ? ["queue", "goals", "bonuses"]
    : ["deadlines", "todos", "goals", "bonuses"];
  const allOpen = visibleSections.every((key) => openSections[key]);

  const toggleAll = () =>
    setOpenSections((prev) => ({
      ...prev,
      ...Object.fromEntries(visibleSections.map((key) => [key, !allOpen])),
    }));

  const goToYesterday = () => {
    const d = new Date(getTodayStr() + "T12:00:00");
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toLocaleDateString("en-CA"));
  };

  return (
    <div>
      <CurrentBalance />
      <DateNavigator
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
      />

      {isToday && <YesterdayPrompt onGoToYesterday={goToYesterday} />}

      {isLoading && (
        <p className="text-gray-500 text-sm text-center py-8">Loading day...</p>
      )}
      {error && (
        <p className="text-red-600 text-sm text-center py-4">
          {(error as Error).message}
        </p>
      )}

      {summary && (
        <>
          <div className="flex justify-end gap-2 mb-2">
            <button
              onClick={toggleAll}
              className="text-xs px-2 py-1 rounded-lg border bg-white border-gray-200 text-gray-500 hover:text-gray-600 transition-colors"
              title={allOpen ? "Collapse every section" : "Open every section"}
            >
              {allOpen ? "Hide All" : "Expand All"}
            </button>
            <button
              onClick={toggleHybrid}
              className={`text-xs px-2 py-1 rounded-lg border transition-colors ${
                hybridView
                  ? "bg-blue-50 border-blue-200 text-blue-600 font-medium"
                  : "bg-white border-gray-200 text-gray-500 hover:text-gray-600"
              }`}
              title="Show tasks and todos as one list"
            >
              Hybrid View
            </button>
          </div>

          {hybridView ? (
            <CombinedQueueSection
              todos={summary.todos}
              deadlines={summary.deadlines}
              viewedDate={selectedDate}
              open={openSections.queue}
              onToggle={() => toggleSection("queue")}
            />
          ) : (
            <>
              <DeadlinesSection
                deadlines={summary.deadlines}
                viewedDate={selectedDate}
                open={openSections.deadlines}
                onToggle={() => toggleSection("deadlines")}
              />
              <TodosSection
                todos={summary.todos}
                viewedDate={selectedDate}
                open={openSections.todos}
                onToggle={() => toggleSection("todos")}
              />
            </>
          )}
          <GoalsSection
            goals={summary.goals}
            subtotal={Number(summary.goals_subtotal)}
            selectedDate={selectedDate}
            open={openSections.goals}
            onToggle={() => toggleSection("goals")}
          />
          <BonusesSection
            bonuses={summary.bonuses}
            subtotal={Number(summary.bonuses_subtotal)}
            selectedDate={selectedDate}
            open={openSections.bonuses}
            onToggle={() => toggleSection("bonuses")}
          />
          <SpendingInput selectedDate={selectedDate} />
          <CompletedToday summary={summary} />
          <SpendingLog selectedDate={selectedDate} />

          <AppliedDeferrals summary={summary} />

          <DailyScoreSummary score={Number(summary.daily_score)} />
        </>
      )}

      <DailyNotes selectedDate={selectedDate} />
    </div>
  );
}
