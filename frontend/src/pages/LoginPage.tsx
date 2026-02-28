import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { LoginForm } from '../components/auth/LoginForm';
import { RegisterForm } from '../components/auth/RegisterForm';

export function LoginPage() {
  const { user, loading } = useAuth();
  const [isRegister, setIsRegister] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (user) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-slate-50">
      <h1 className="text-3xl font-bold text-blue-700 mb-8">PRIORI-TRIZE</h1>
      {isRegister ? (
        <RegisterForm onToggle={() => setIsRegister(false)} />
      ) : (
        <LoginForm onToggle={() => setIsRegister(true)} />
      )}
    </div>
  );
}
