import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';

export function RegisterForm({ onToggle }: { onToggle: () => void }) {
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signUp(email, password);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="text-center space-y-4 w-full max-w-sm">
        <h2 className="text-2xl font-bold">Check your email</h2>
        <p className="text-gray-600">We sent a confirmation link to {email}</p>
        <button onClick={onToggle} className="text-blue-600 hover:underline">
          Back to Sign In
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 w-full max-w-sm">
      <h2 className="text-2xl font-bold text-center">Register</h2>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        required
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <input
        type="password"
        placeholder="Password (min 6 characters)"
        value={password}
        onChange={e => setPassword(e.target.value)}
        required
        minLength={6}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <button
        type="submit"
        disabled={loading}
        className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Creating account...' : 'Register'}
      </button>
      <p className="text-center text-sm text-gray-600">
        Already have an account?{' '}
        <button type="button" onClick={onToggle} className="text-blue-600 hover:underline">
          Sign In
        </button>
      </p>
    </form>
  );
}
