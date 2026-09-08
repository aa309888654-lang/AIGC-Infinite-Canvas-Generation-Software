import { useCanvasStore } from '@/store/useCanvasStore';
import { PUBLIC_URLS } from '@/config/resources';

const Toolbar = () => {
  const { resetCanvas } = useCanvasStore();

  return (
    <div className="h-14 bg-bg-node border-b border-border-gray flex items-center justify-between px-4">
      {/* 左侧：Logo 和标题 */}
      <div className="flex items-center gap-3">
        <img src={PUBLIC_URLS.logo} alt="小天AICG" style={{ width: 32, height: 32, borderRadius: 6 }} />
        <div>
          <h1 className="text-sm font-semibold text-white">小天AICG</h1>
          <p className="text-xs text-white">aextiam（vx)</p>
        </div>
      </div>

      {/* 右侧：操作按钮（无图标） */}
      <div className="flex items-center gap-2">
        <button className="px-3 py-1.5 text-sm text-white hover:text-white hover:bg-bg-dark rounded-md transition-colors">
          保存
        </button>
        <button className="px-3 py-1.5 text-sm text-white hover:text-white hover:bg-bg-dark rounded-md transition-colors">
          导入
        </button>
        <button
          onClick={resetCanvas}
          className="px-3 py-1.5 text-sm text-white hover:text-white hover:bg-bg-dark rounded-md transition-colors"
        >
          清空
        </button>
      </div>
    </div>
  );
};

export default Toolbar;