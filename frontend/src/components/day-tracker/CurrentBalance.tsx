import { useBalance } from '../../hooks/useBalance';

export function CurrentBalance() {
  const { data, isLoading } = useBalance();

  if (isLoading || !data) return null;

  const balance = Number(data.current_balance);
  const color = balance >= 0 ? 'text-green-600' : 'text-red-600';
  const bg = balance >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200';

  return (
    <div className={`mb-4 p-3 rounded-lg border ${bg} text-center`}>
      <span className="text-sm text-gray-600">Current Balance</span>
      <p className={`text-2xl font-bold ${color}`}>
        {balance >= 0 ? '+' : ''}{balance.toFixed(1)}
      </p>
    </div>
  );
}
