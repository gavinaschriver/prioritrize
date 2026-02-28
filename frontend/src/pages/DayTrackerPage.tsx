import { useState } from 'react';
import { getTodayStr } from '../lib/api';
import { useDaySummary } from '../hooks/useDaySummary';
import { CurrentBalance } from '../components/day-tracker/CurrentBalance';
import { DateNavigator } from '../components/day-tracker/DateNavigator';
import { YesterdayPrompt } from '../components/day-tracker/YesterdayPrompt';
import { GoalsSection } from '../components/day-tracker/GoalsSection';
import { BonusesSection } from '../components/day-tracker/BonusesSection';
import { DailyScoreSummary } from '../components/day-tracker/DailyScoreSummary';
import { EntryList } from '../components/day-tracker/EntryList';

export function DayTrackerPage() {
  const [selectedDate, setSelectedDate] = useState(getTodayStr());
  const { data: summary, isLoading, error } = useDaySummary(selectedDate);

  const isToday = selectedDate === getTodayStr();

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
          <EntryList summary={summary} />
        </>
      )}
    </div>
  );
}
