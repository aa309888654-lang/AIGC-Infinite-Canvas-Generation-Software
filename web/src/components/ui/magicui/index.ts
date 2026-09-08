/**
 * Magic UI Components
 * 高级 UI 组件库 - 适用于小天AICG平台
 *
 * 包含组件:
 * - ShimmerButton: 闪光按钮
 * - AnimatedGradientText: 动画渐变文字
 * - Marquee: 无限滚动跑马灯
 * - BorderBeam: 边框光束动画
 * - GlareHover: 悬停眩光效果
 * - NumberTicker: 数字滚动动画
 */

// ShimmerButton - 闪光按钮
export { ShimmerButton, type ShimmerButtonProps } from './ShimmerButton';

// AnimatedGradientText - 动画渐变文字
export {
  AnimatedGradientText,
  gradientPresets,
  type AnimatedGradientTextProps,
} from './AnimatedGradientText';

// Marquee - 无限滚动跑马灯
export {
  Marquee,
  MarqueeItem,
  type MarqueeProps,
  type MarqueeItemProps,
} from './Marquee';

// BorderBeam - 边框光束动画
export {
  BorderBeam,
  BorderBeamCard,
  type BorderBeamProps,
  type BorderBeamCardProps,
} from './BorderBeam';

// GlareHover - 悬停眩光效果
export {
  GlareHover,
  GlareCard,
  type GlareHoverProps,
  type GlareCardProps,
} from './GlareHover';

// NumberTicker - 数字滚动动画
export {
  NumberTicker,
  MultiNumberTicker,
  formatters as numberFormatters,
  type NumberTickerProps,
  type MultiNumberTickerProps,
} from './NumberTicker';
