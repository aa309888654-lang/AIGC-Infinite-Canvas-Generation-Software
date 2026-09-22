import React, { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { RefreshCw } from 'lucide-react';
import DOMPurify from 'dompurify';

interface CaptchaProps {
  onValidate?: (code: string) => boolean;
  onChange?: (code: string) => void;
  error?: boolean;
  length?: number;
  width?: number;
  height?: number;
  svgData?: string;
}

export interface CaptchaRef {
  refresh: () => void;
  getCode: () => string;
  validate: (inputCode: string) => boolean;
}

const Captcha = forwardRef<CaptchaRef, CaptchaProps>(({
  onValidate,
  onChange,
  error = false,
  length = 4,
  width = 120,
  height = 40,
  svgData
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const svgRef = useRef<HTMLDivElement>(null);
  const [captchaCode, setCaptchaCode] = useState<string>('');
  const [inputValue, setInputValue] = useState<string>('');

  const generateCode = useCallback(() => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let code = '';
    for (let i = 0; i < length; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }, [length]);

  const drawCaptcha = useCallback((code: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = width;
    canvas.height = height;

    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, width, height);

    for (let i = 0; i < 4; i++) {
      ctx.strokeStyle = `rgba(${Math.random() * 100 + 100}, ${Math.random() * 100 + 100}, ${Math.random() * 100 + 100}, 0.6)`;
      ctx.beginPath();
      ctx.moveTo(Math.random() * width, Math.random() * height);
      ctx.lineTo(Math.random() * width, Math.random() * height);
      ctx.stroke();
    }

    for (let i = 0; i < 80; i++) {
      ctx.fillStyle = `rgba(${Math.random() * 255}, ${Math.random() * 255}, ${Math.random() * 255}, 0.5)`;
      ctx.beginPath();
      ctx.arc(Math.random() * width, Math.random() * height, 1, 0, 2 * Math.PI);
      ctx.fill();
    }

    const fontSize = height * 0.6;
    ctx.font = `bold ${fontSize}px Arial, sans-serif`;
    ctx.textBaseline = 'middle';

    for (let i = 0; i < code.length; i++) {
      const x = (width / length) * i + (width / length / 4);
      const y = height / 2 + (Math.random() - 0.5) * 8;
      
      ctx.fillStyle = `rgb(${Math.random() * 80 + 50}, ${Math.random() * 80 + 50}, ${Math.random() * 80 + 50})`;
      
      ctx.save();
      ctx.translate(x + fontSize / 4, y);
      ctx.rotate((Math.random() - 0.5) * 0.4);
      ctx.fillText(code[i], 0, 0);
      ctx.restore();
    }
  }, [width, height, length]);

  const refresh = useCallback(() => {
    if (!svgData) {
      const code = generateCode();
      setCaptchaCode(code);
      drawCaptcha(code);
      onChange?.(code);
    } else {
      setCaptchaCode('');
      setInputValue('');
      onChange?.('');
    }
  }, [generateCode, drawCaptcha, onChange, svgData]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, length);
    setInputValue(value);
    onChange?.(value);
  }, [onChange, length]);

  useImperativeHandle(ref, () => ({
    refresh,
    getCode: () => captchaCode,
    validate: (inputCode: string) => {
      return inputCode.toLowerCase() === captchaCode.toLowerCase();
    }
  }));

  useEffect(() => {
    if (!svgData) {
      const code = generateCode();
      setCaptchaCode(code);
      drawCaptcha(code);
      onChange?.(code);
    }
  }, [drawCaptcha, generateCode, onChange, svgData]);

  useEffect(() => {
    if (svgData && svgRef.current) {
      try {
        const svgContent = atob(svgData);
        // SEC M-5 修复：使用 DOMPurify 清洗 base64 解码后的 SVG，防止 XSS。
        // 安全最佳实践：svgData 来自外部输入，base64 解码后直接赋值 innerHTML 可注入
        // <script>、onload/onerror 事件处理器、<foreignObject> 内嵌 HTML 等。DOMPurify
        // 在 SVG profile 下剥离脚本与事件处理器，FORBID_TAGS 进一步防御性拦截 foreignObject。
        const cleanSvg = DOMPurify.sanitize(svgContent, {
          USE_PROFILES: { svg: true, svgFilters: true },
          FORBID_TAGS: ['foreignObject', 'script'],
        });
        svgRef.current.innerHTML = cleanSvg;
        setCaptchaCode('');
        setInputValue('');
      } catch (err) {
        console.error('Failed to decode SVG data:', err);
      }
    }
  }, [svgData]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <div className="relative">
          {svgData ? (
            <div
              ref={svgRef}
              className={`rounded-lg cursor-pointer border-2 transition-all ${
                error ? 'border-red-500' : 'border-gray-300 hover:border-gray-400'
              }`}
              onClick={refresh}
              title="点击刷新验证码"
              style={{ width: `${width}px`, height: `${height}px` }}
            />
          ) : (
            <canvas
              ref={canvasRef}
              className={`rounded-lg cursor-pointer border-2 transition-all ${
                error ? 'border-red-500' : 'border-gray-300 hover:border-gray-400'
              }`}
              onClick={refresh}
              title="点击刷新验证码"
            />
          )}
        </div>
        <button
          type="button"
          onClick={refresh}
          className="flex items-center justify-center p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          title="刷新验证码"
        >
          <RefreshCw className="w-5 h-5 text-gray-600" />
        </button>
      </div>
      <input
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        placeholder="请输入右侧验证码"
        className={`w-full px-3 py-2 bg-gray-800/50 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-all ${
          error ? 'border-red-500 focus:ring-red-500' : 'border-gray-600 focus:ring-gray-500'
        }`}
        maxLength={length}
        autoComplete="off"
      />
    </div>
  );
});

Captcha.displayName = 'Captcha';

export default Captcha;
