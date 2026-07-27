import { useState } from 'react';
import { getTodayStr } from '../lib/api';
import { useDaySummary } from '../hooks/useDaySummary';
import { CurrentBalance } from '../components/day-tracker/CurrentBalance';
import { DateNavigator } from '../components/day-tracker/DateNavigator';
import { YesterdayPrompt } from '../components/day-tracker/YesterdayPrompt';
import { TodosSection } from '../components/day-tracker/TodosSection';
import { GoalsSection } from '../components/day-tracker/GoalsSection';
import { BonusesSection } from '../components/day-tracker/BonusesSection';
import { DeadlinesSection } from '../components/day-tracker/DeadlinesSection';
import { DailyScoreSummary } from '../components/day-tracker/DailyScoreSummary';
import { CompletedToday } from '../components/day-tracker/CompletedToday';
import { CombinedQueueSection } from '../components/day-tracker/CombinedQueueSection';
import { ScratchPad } from '../components/day-tracker/ScratchPad';
import { DailyNotes } from '../components/day-tracker/DailyNotes';

export function DayTrackerPage() {
  const [selectedDate, setSelectedDate] = useState(getTodayStr());
  const [hybridView, setHybridView] = useState(
    () => localStorage.getItem('hybridView') === 'true'
  );
  const { data: summary, isLoading, error } = useDaySummary(selectedDate);

  const isToday = selectedDate === getTodayStr();

  const toggleHybrid = () => {
    setHybridView(prev => {
      localStorage.setItem('hybridView', String(!prev));
      return !prev;
    });
  };

  const goToYesterday = () => {
    const d = new Date(getTodayStr() + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toLocaleDateString('en-CA'));
  };

  return (
    <div>
      <CurrentBalance />
      <DateNavigator selectedDate={selectedDate} onDateChange={setSelectedDate} />

      {isToday && <YesterdayPrompt onGoToYesterday={goToYesterday} />}

      {isLoading && <p className="text-gray-400 text-sm text-center py-8">Loading day...</p>}
      {error && <p className="text-red-600 text-sm text-center py-4">{(error as Error).message}</p>}

      {summary && (
        <>
          <div className="flex justify-end mb-2">
            <button
              onClick={toggleHybrid}
              className={`text-xs px-2 py-1 rounded-lg border transition-colors ${
                hybridView
                  ? 'bg-blue-50 border-blue-200 text-blue-600 font-medium'
                  : 'bg-white border-gray-200 text-gray-400 hover:text-gray-600'
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
            />
          ) : (
            <>
              <DeadlinesSection
                deadlines={summary.deadlines}
                viewedDate={selectedDate}
              />
              <TodosSection
                todos={summary.todos}
                viewedDate={selectedDate}
              />
            </>
          )}
          <GoalsSection
            goals={summary.goals}
            subtotal={Number(summary.goals_subtotal)}
            selectedDate={selectedDate}
          />
          <BonusesSection
            bonuses={summary.bonuses}
            subtotal={Number(summary.bonuses_subtotal)}
            selectedDate={selectedDate}
          />
          <DailyScoreSummary score={Number(summary.daily_score)} />
          <CompletedToday summary={summary} />
        </>
      )}

      <DailyNotes selectedDate={selectedDate} />
      <ScratchPad />
    </div>
  );
}
