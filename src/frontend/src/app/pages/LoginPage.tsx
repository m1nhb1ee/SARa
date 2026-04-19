/**
 * LoginPage - Đăng nhập
 */

import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '@/api/authContext';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Card } from '@/app/components/ui/card';
import { Brain, AlertCircle } from 'lucide-react';

export function LoginPage() {
  const navigate = useNavigate();
  const { login, isLoading } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('Vui lòng nhập tên đăng nhập và mật khẩu');
      return;
    }

    const success = await login(username, password);
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
              Tên đăng nhập
            </label>
            <Input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Nhập tên đăng nhập"
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

          {error && (
            <div className="flex gap-2 items-start p-3 bg-red-900/20 border border-red-700 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white"
          >
            {isLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </Button>
        </form>

        {/* Test Accounts */}
        <div className="pt-4 border-t border-neutral-700">
          <p className="text-xs text-neutral-400 mb-3">Tài khoản test:</p>
          <div className="space-y-2 text-xs">
            <div className="bg-neutral-800 p-2 rounded">
              <p className="text-neutral-300">
                <span className="text-green-400">admin</span> / <span className="text-green-400">adminpass123</span>
              </p>
            </div>
            <div className="bg-neutral-800 p-2 rounded">
              <p className="text-neutral-300">
                <span className="text-blue-400">student1</span> / <span className="text-blue-400">testpass123</span>
              </p>
            </div>
            <div className="bg-neutral-800 p-2 rounded">
              <p className="text-neutral-300">
                <span className="text-blue-400">student2</span> / <span className="text-blue-400">testpass123</span>
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
