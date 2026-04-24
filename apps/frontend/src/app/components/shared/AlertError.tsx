import { AlertCircle } from 'lucide-react';

interface Props {
  message: string;
}

export function AlertError({ message }: Props) {
  return (
    <div className="flex gap-2 items-start p-3 bg-red-900/20 border border-red-700 rounded-lg">
      <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
      <p className="text-sm text-red-400">{message}</p>
    </div>
  );
}
