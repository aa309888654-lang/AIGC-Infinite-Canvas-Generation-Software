import * as React from 'react';
import { motion, useSpring, useTransform, useInView, type HTMLMotionProps, type SpringOptions } from 'framer-motion';
import { cn } from '@/lib/utils';

interface NumberTickerProps extends Omit<HTMLMotionProps<'span'>, 'children'> {
  value: number;
  direction?: 'up' | 'down';
  duration?: number;
  delay?: number;
  formatFn?: (value: number) => string;
  springOptions?: SpringOptions;
  decimalPlaces?: number;
  prefix?: string;
  suffix?: string;
}

/**
 * NumberTicker - 数字滚动动画组件
 * 使用 framer-motion 从 0 动画到目标值
 */
const NumberTicker = React.forwardRef<HTMLSpanElement, NumberTickerProps>(
  (
    {
      value,
      direction = 'up',
      duration: _duration = 2,
      delay = 0,
      formatFn,
      springOptions = { stiffness: 100, damping: 30 },
      decimalPlaces = 0,
      prefix = '',
      suffix = '',
      className,
      style,
      ...props
    },
    ref
  ) => {
    const spanRef = React.useRef<HTMLSpanElement>(null);
    const isInView = useInView(spanRef, { once: true, margin: '0px' });

    // 合并 ref
    React.useImperativeHandle(ref, () => spanRef.current!);

    const initialValue = direction === 'up' ? 0 : value;
    const targetValue = direction === 'up' ? value : 0;

    const springValue = useSpring(initialValue, springOptions);
    const displayValue = useTransform(springValue, (latest) => {
      const formatted = formatFn
        ? formatFn(latest)
        : latest.toFixed(decimalPlaces);
      return `${prefix}${formatted}${suffix}`;
    });

    React.useEffect(() => {
      if (isInView) {
        const timer = setTimeout(() => {
          springValue.set(targetValue);
        }, delay * 1000);
        return () => clearTimeout(timer);
      }
    }, [isInView, springValue, targetValue, delay]);

    return (
      <motion.span
        ref={spanRef}
        className={cn('tabular-nums', className)}
        style={style}
        {...props}
      >
        <motion.span>{displayValue}</motion.span>
      </motion.span>
    );
  }
);

NumberTicker.displayName = 'NumberTicker';

// 格式化函数预设
const formatters = {
  // 千分位格式化
  withCommas: (value: number): string => {
    return Math.round(value).toLocaleString('en-US');
  },

  // 中文数字格式化（万、亿）
  chinese: (value: number): string => {
    if (value >= 100000000) {
      return `${(value / 100000000).toFixed(1)}亿`;
    }
    if (value >= 10000) {
      return `${(value / 10000).toFixed(1)}万`;
    }
    return Math.round(value).toLocaleString('zh-CN');
  },

  // 百分比格式化
  percentage: (value: number): string => {
    return `${value.toFixed(1)}%`;
  },

  // 货币格式化
  currency: (currency: string = '¥') => (value: number): string => {
    return `${currency}${Math.round(value).toLocaleString('en-US')}`;
  },
};

// 多数字滚动组件
interface MultiNumberTickerProps {
  values: Array<{
    value: number;
    label?: string;
    prefix?: string;
    suffix?: string;
    decimalPlaces?: number;
  }>;
  duration?: number;
  delay?: number;
  staggerDelay?: number;
  className?: string;
  itemClassName?: string;
}

const MultiNumberTicker: React.FC<MultiNumberTickerProps> = ({
  values,
  duration = 2,
  delay = 0,
  staggerDelay = 0.1,
  className,
  itemClassName,
}) => {
  return (
    <div className={cn('flex flex-wrap gap-6', className)}>
      {values.map((item, index) => (
        <div key={index} className={cn('text-center', itemClassName)}>
          <NumberTicker
            value={item.value}
            duration={duration}
            delay={delay + index * staggerDelay}
            prefix={item.prefix}
            suffix={item.suffix}
            decimalPlaces={item.decimalPlaces ?? 0}
            className="text-3xl font-bold text-[#3B82F6]"
          />
          {item.label && (
            <p className="mt-1 text-sm text-white/60">{item.label}</p>
          )}
        </div>
      ))}
    </div>
  );
};

export { NumberTicker, MultiNumberTicker, formatters, type NumberTickerProps, type MultiNumberTickerProps };
