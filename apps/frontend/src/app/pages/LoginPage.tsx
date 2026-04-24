/**
 * LoginPage - Đăng nhập
 */

import { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { useAuth } from '@/api/authContext';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Card } from '@/app/components/ui/card';
import { Brain } from 'lucide-react';
import { AlertError } from '@/app/components/shared/AlertError';

export function LoginPage() {
  const navigate = useNavigate();
  const { login, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('Vui lòng nhập email và mật khẩu');
      return;
    }

    const success = await login(email, password);
    if (success) {
      navigate('/');
    } else {
      setError('Tên đăng nhập hoặc mật khẩu không đúng');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-neutral-900 to-neutral-800">
      <Card className="w-full max-w-md p-8 space-y-6 bg-neutral-900 border-neutral-700">
        {/* Header */}
        <div className="flex flex-col items-center space-y-3">
          <div className="bg-gradient-to-br from-blue-500 to-cyan-500 p-3 rounded-lg">
            <Brain className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">SARa</h1>
          <p className="text-sm text-neutral-400">Smart AI Radiology</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-200 mb-2">
              Email
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Nhập email"
              disabled={isLoading}
              className="bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-200 mb-2">
              Mật khẩu
            </label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nhập mật khẩu"
              disabled={isLoading}
              className="bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-500"
            />
          </div>

          {error && <AlertError message={error} />}

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white"
          >
            {isLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </Button>
        </form>

        <div className="pt-4 border-t border-neutral-700 text-center">
          <p className="text-sm text-neutral-400">
            Chưa có tài khoản?{' '}
            <Link to="/register" className="text-blue-400 hover:underline font-medium">
              Đăng ký
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
}
