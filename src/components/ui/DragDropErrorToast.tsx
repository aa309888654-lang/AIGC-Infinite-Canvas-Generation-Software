import { useEffect} from 'react';
import { XCircle, AlertCircle, CheckCircle } from 'lucide-react';

interface DragDropError {
  id: string;
  type: 'error' | 'success' | 'warning';
  message: string;
  fileName?: string;
}

interface DragDropErrorToastProps {
  errors: DragDropError[];
  onRemove: (id: string) => void;
}

const DragDropErrorToast = ({ errors, onRemove }: DragDropErrorToastProps) => {
  useEffect(() => {
    const timers = errors.map((error) =>
      setTimeout(() => {
        onRemove(error.id);
      }, 5000)
    );
    return () => {
      timers.forEach(clearTimeout);
    };
  }, [errors, onRemove]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'error':
        return <XCircle className="w-5 h-5 text-red-400" />;
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-yellow-400" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-400" />;
    }
  };

  const getBgColor = (type: string) => {
    switch (type) {
      case 'error':
        return 'bg-red-500/20 border-red-500/50';
      case 'success':
        return 'bg-green-500/20 border-green-500/50';
      case 'warning':
        return 'bg-yellow-500/20 border-yellow-500/50';
      default:
        return 'bg-gray-500/20 border-gray-500/50';
    }
  };

  return (
    <div className="fixed top-20 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {errors.map((error) => (
        <div
          key={error.id}
          className={`pointer-events-auto flex items-start gap-3 p-4 rounded-lg border shadow-xl backdrop-blur-sm animate-slide-in ${getBgColor(error.type)}`}
        >
          {getIcon(error.type)}
          <div className="flex-1 min-w-0">
            {error.fileName && (
              <p className="text-sm font-medium text-white mb-1">{error.fileName}</p>
            )}
            <p className="text-sm text-white/80">{error.message}</p>
          </div>
          <button
            onClick={() => onRemove(error.id)}
            className="p-1 hover:bg-white/10 rounded transition-colors"
          >
            <XCircle className="w-4 h-4 text-white/60" />
          </button>
        </div>
      ))}
    </div>
  );
};

export default DragDropErrorToast;
