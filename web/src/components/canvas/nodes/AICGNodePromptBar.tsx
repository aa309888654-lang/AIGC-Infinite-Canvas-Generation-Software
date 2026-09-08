import {
  memo,
  useCallback,
  useRef,
  useState,
  type CompositionEvent,
  type ClipboardEventHandler,
  type FocusEventHandler,
  type FormEventHandler,
  type KeyboardEvent,
  type KeyboardEventHandler,
  type MouseEventHandler,
  type PointerEventHandler,
  type ReactNode,
  type RefObject,
  type SyntheticEvent,
  type WheelEventHandler,
} from 'react';
import { cn } from '@/lib/utils';
import { useNodeMention, type NodeMentionItem } from '@/hooks/useNodeMention';
import { Maximize2, Send } from 'lucide-react';
import { aicgGlass } from './aicg-node-glass';

interface AICGNodePromptBarProps {
  nodeId: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** 底部 slash 菜单插槽 */
  slashMenu?: ReactNode;
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  onKeyDownCapture?: KeyboardEventHandler<HTMLTextAreaElement>;
  onKeyUp?: KeyboardEventHandler<HTMLTextAreaElement>;
  onCopyCapture?: ClipboardEventHandler<HTMLTextAreaElement>;
  onCutCapture?: ClipboardEventHandler<HTMLTextAreaElement>;
  onPasteCapture?: ClipboardEventHandler<HTMLTextAreaElement>;
  onPaste?: ClipboardEventHandler<HTMLTextAreaElement>;
  onInput?: FormEventHandler<HTMLTextAreaElement>;
  onBeforeInput?: FormEventHandler<HTMLTextAreaElement>;
  onCompositionStart?: () => void;
  onCompositionEnd?: (e: CompositionEvent<HTMLTextAreaElement>) => void;
  onFocus?: () => void;
  onBlur?: FocusEventHandler<HTMLTextAreaElement>;
  inputRef?: RefObject<HTMLTextAreaElement | null>;
  rows?: number;
  /** 禁用内置节点 @，改由 mentionOverlay 接管（如视频节点素材引用） */
  disableBuiltInMention?: boolean;
  /** 外部 @ 菜单（视频参考图等） */
  mentionOverlay?: ReactNode;
  /** 输入框上方插槽（引用 chips 等） */
  beforeInput?: ReactNode;
  /** 输入框内浮动操作（优化、复制等） */
  inputOverlay?: ReactNode;
  hideExpandButton?: boolean;
  textareaClassName?: string;
  onPointerDownCapture?: PointerEventHandler<HTMLDivElement>;
  onMouseDownCapture?: MouseEventHandler<HTMLDivElement>;
  onWheelCapture?: WheelEventHandler<HTMLTextAreaElement>;
  /** 外部 mention 同步（caret 位置） */
  onMentionSync?: (value: string, caret: number | null) => void;
}

/** 统一提示词输入条：@ 引用 + 发送（AICG 式） */
function AICGNodePromptBar({
  nodeId,
  value,
  onChange,
  onSubmit,
  placeholder = '输入提示词，@ 引用节点…',
  disabled,
  className,
  slashMenu,
  onKeyDown,
  onKeyDownCapture,
  onKeyUp,
  onCopyCapture,
  onCutCapture,
  onPasteCapture,
  onPaste,
  onInput,
  onBeforeInput,
  onCompositionStart,
  onCompositionEnd,
  onFocus,
  onBlur,
  inputRef,
  rows = 3,
  disableBuiltInMention,
  mentionOverlay,
  beforeInput,
  inputOverlay,
  hideExpandButton = false,
  textareaClassName,
  onPointerDownCapture,
  onMouseDownCapture,
  onWheelCapture,
  onMentionSync,
}: AICGNodePromptBarProps) {
  const internalRef = useRef<HTMLTextAreaElement>(null);
  const textareaRef = inputRef || internalRef;
  const [isInternalComposing, setIsInternalComposing] = useState(false);
  const [isInputExpanded, setIsInputExpanded] = useState(false);
  const { mentionState, filteredMentions, syncMentionState, applyMention } = useNodeMention(nodeId);

  const syncCaret = useCallback(
    (nextValue: string, caret: number | null) => {
      if (disableBuiltInMention) {
        onMentionSync?.(nextValue, caret);
        return;
      }
      syncMentionState(nextValue, caret);
    },
    [disableBuiltInMention, onMentionSync, syncMentionState],
  );

  const handleSelectMention = useCallback(
    (item: NodeMentionItem) => {
      const next = applyMention(value, item);
      onChange(next);
      requestAnimationFrame(() => textareaRef.current?.focus());
    },
    [applyMention, onChange, value, textareaRef],
  );

  const stopInputEventPropagation = useCallback((event: SyntheticEvent<HTMLTextAreaElement>) => {
    event.stopPropagation();
  }, []);

  const handleTextareaKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      event.stopPropagation();
      if (event.nativeEvent.isComposing || isInternalComposing || event.key === 'Process') {
        return;
      }
      onKeyDown?.(event);
    },
    [isInternalComposing, onKeyDown],
  );

  const handleCompositionStart = useCallback(
    (event: CompositionEvent<HTMLTextAreaElement>) => {
      event.stopPropagation();
      setIsInternalComposing(true);
      onCompositionStart?.();
    },
    [onCompositionStart],
  );

  const handleCompositionEnd = useCallback(
    (event: CompositionEvent<HTMLTextAreaElement>) => {
      event.stopPropagation();
      setIsInternalComposing(false);
      onCompositionEnd?.(event);
      syncCaret(event.currentTarget.value, event.currentTarget.selectionStart);
    },
    [onCompositionEnd, syncCaret],
  );

  return (
    <div
      className={cn('relative', className)}
      onPointerDownCapture={onPointerDownCapture}
      onMouseDownCapture={onMouseDownCapture}
    >
      {slashMenu}
      {!disableBuiltInMention && mentionState.open && filteredMentions.length > 0 && (
        <div className="absolute bottom-full left-0 z-30 mb-1 max-h-40 w-full overflow-y-auto rounded-xl border border-white/10 bg-[#101012] py-1 custom-scrollbar backdrop-blur-xl">
          {filteredMentions.map((item) => (
            <button
              key={item.id}
              type="button"
              data-mention-item="true"
              className="flex w-full flex-col gap-0.5 px-3 py-2 text-left hover:bg-white/[0.06]"
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelectMention(item);
              }}
            >
              <span className="text-[11px] text-white">{item.label}</span>
              <span className="text-[9px] text-white/35">
                {item.token} · {item.type}
              </span>
            </button>
          ))}
        </div>
      )}
      {mentionOverlay}
      {beforeInput}
      <div className="flex items-end gap-2">
        <div className={cn(aicgGlass.promptContainer, 'aicg-text-input-shell relative min-w-0 flex-1')}>
          <textarea
            ref={textareaRef}
            data-node-text-input="true"
            name={`node-prompt-${nodeId}`}
            aria-label="节点提示词输入框"
            value={value}
            disabled={disabled}
            onChange={(e) => {
              e.stopPropagation();
              onChange(e.target.value);
              syncCaret(e.target.value, e.target.selectionStart);
            }}
            onKeyDownCapture={(e) => {
              e.stopPropagation();
              onKeyDownCapture?.(e);
            }}
            onKeyDown={handleTextareaKeyDown}
            onKeyUp={(e) => {
              e.stopPropagation();
              syncCaret(value, e.currentTarget.selectionStart);
              onKeyUp?.(e);
            }}
            onCopyCapture={(e) => {
              e.stopPropagation();
              onCopyCapture?.(e);
            }}
            onCutCapture={(e) => {
              e.stopPropagation();
              onCutCapture?.(e);
            }}
            onPasteCapture={(e) => {
              e.stopPropagation();
              onPasteCapture?.(e);
            }}
            onPaste={(e) => {
              e.stopPropagation();
              onPaste?.(e);
            }}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            onFocus={(e) => {
              e.stopPropagation();
              onFocus?.();
            }}
            onBlur={(e) => {
              e.stopPropagation();
              onBlur?.(e);
            }}
            onClick={(e) => {
              e.stopPropagation();
              syncCaret(value, e.currentTarget.selectionStart);
            }}
            onInput={(e) => {
              e.stopPropagation();
              onInput?.(e);
            }}
            onBeforeInput={(e) => {
              e.stopPropagation();
              onBeforeInput?.(e);
            }}
            onPointerDownCapture={stopInputEventPropagation}
            onMouseDownCapture={stopInputEventPropagation}
            onWheelCapture={onWheelCapture}
            placeholder={placeholder}
            rows={rows}
            maxLength={2000}
            className={cn(
              aicgGlass.promptTextarea,
              'transition-[min-height] duration-200',
              !isInputExpanded && 'min-h-[72px]',
              textareaClassName,
              isInputExpanded && 'min-h-[220px]',
            )}
          />
          {!hideExpandButton ? (
          <button
            type="button"
            aria-label={isInputExpanded ? '收起输入框' : '原地展开输入框'}
            title={isInputExpanded ? '收起输入框' : '原地展开输入框'}
            onClick={(e) => {
              e.stopPropagation();
              setIsInputExpanded((open) => !open);
            }}
            className="nodrag nowheel absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-lg border border-white/12 bg-black/30 text-white/55 transition-all hover:border-white/24 hover:bg-white/10 hover:text-white"
          >
            <Maximize2 className={cn('h-3.5 w-3.5 transition-transform', isInputExpanded && 'rotate-180')} />
          </button>
          ) : null}
          {inputOverlay}
          {value ? <span className={aicgGlass.promptCounter}>{value.length}/2000</span> : null}
        </div>
        {onSubmit ? (
          <button
            type="button"
            disabled={disabled}
            onClick={onSubmit}
            className="mb-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/24 bg-white/[0.08] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_4px_12px_rgba(0,0,0,0.28)] transition-all hover:border-white/36 hover:bg-white/[0.12] active:scale-95 disabled:cursor-not-allowed disabled:border-white/15 disabled:bg-white/[0.03] disabled:text-white/20 disabled:shadow-none"
          >
            <Send className="h-4 w-4" />
          </button>
        ) : null}
      </div>

    </div>
  );
}

export default memo(AICGNodePromptBar);
