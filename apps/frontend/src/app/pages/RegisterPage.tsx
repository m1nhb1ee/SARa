import { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Card } from '@/app/components/ui/card';
import { Brain, CheckCircle2 } from 'lucide-react';
import { AlertError } from '@/app/components/shared/AlertError';

export function RegisterPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    setError('');
    setInfo('');

    if (!email.trim() || !password.trim()) {
      setError('Vui lòng nhập email và mật khẩu');
      return;
    }
    if (password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự');
      return;
    }
    if (password !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp');
      return;
    }

    setIsLoading(true);
    try {
      const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
      const res = await fetch(`${baseURL}/auth/register/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, full_name: fullName }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Đăng ký thất bại');
        return;
      }

      if (data.requires_confirmation) {
        setInfo(data.message);
        return;
      }

      // Auto sign-in with returned token
      localStorage.setItem('sara_token', data.access_token);
      localStorage.setItem('sara_auth_state', 'true');
      localStorage.setItem('sara_user', JSON.stringify(data.user));
      navigate('/');
    } finally {
      setIsLoading(false);
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
          <p className="text-sm text-neutral-400">Tạo tài khoản mới</p>
        </div>

        {info ? (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <CheckCircle2 className="w-10 h-10 text-green-400" />
            <p className="text-sm text-neutral-300">{info}</p>
            <Link to="/login" className="text-sm text-blue-400 hover:underline">
              Quay lại đăng nhập
            </Link>
          </div>
        ) : (
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-200 mb-2">
                Họ tên <span className="text-neutral-500">(tùy chọn)</span>
              </label>
              <Input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nhập họ tên"
                disabled={isLoading}
                className="bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-500"
              />
            </div>

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
                placeholder="Ít nhất 6 ký tự"
                disabled={isLoading}
                className="bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-200 mb-2">
                Xác nhận mật khẩu
              </label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Nhập lại mật khẩu"
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
              {isLoading ? 'Đang tạo tài khoản...' : 'Tạo tài khoản'}
            </Button>
          </form>
        )}

        <div className="pt-4 border-t border-neutral-700 text-center">
          <p className="text-sm text-neutral-400">
            Đã có tài khoản?{' '}
            <Link to="/login" className="text-blue-400 hover:underline font-medium">
              Đăng nhập
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
}
