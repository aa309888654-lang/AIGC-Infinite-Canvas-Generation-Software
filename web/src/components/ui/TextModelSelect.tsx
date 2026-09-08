import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
import { getTextModelIcon, TEXT_MODEL_GROUPS, TEXT_MODEL_LABELS } from '@/config/text-model-icons';
import { PROMPT_OPTIMIZER_MODELS, type PromptOptimizerModelId } from '@/config/prompt-optimizer-models';

interface TextModelSelectProps {
  value: string;
  onChange: (value: string) => void;
  title?: string;
  ariaLabel?: string;
}

const modelInfoById = new Map<PromptOptimizerModelId, (typeof PROMPT_OPTIMIZER_MODELS)[number]>(PROMPT_OPTIMIZER_MODELS.map((model) => [model.id, model]));

function getTextModelDisplay(modelId: string) {
  const info = modelInfoById.get(modelId as PromptOptimizerModelId);
  const name = modelId === 'auto' ? '智能路由' : info?.model || TEXT_MODEL_LABELS[modelId] || modelId;
  const description =
    info?.desc ||
    info?.displayModel ||
    (modelId === 'auto' ? '按质量、速度与稳定性自动选择最合适的推理模型' : '模型能力信息');

  return {
    name,
    model: info?.model || modelId,
    displayModel: description,
    desc: description,
  };
}

function DropdownCheck({ selected }: { selected: boolean }) {
  return (
    <span className="jimeng-text-model-dropdown-check" aria-hidden={!selected}>
      {selected && (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#007AFF"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m5 12 5 5L20 7" />
        </svg>
      )}
    </span>
  );
}

export const TextModelSelect = memo<TextModelSelectProps>(
  ({ value, onChange, title, ariaLabel }) => {
    const [open, setOpen] = useState(false);
    const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const selectedIcon = getTextModelIcon(value);
    const selectedDisplay = getTextModelDisplay(value);

    const updateDropdownPosition = useCallback(() => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(360, Math.max(260, rect.width));
      setDropdownStyle({
        position: 'fixed',
        left: rect.left,
        top: rect.top - 8,
        transform: 'translateY(-100%)',
        zIndex: 2147483647,
        width: 'max-content',
        minWidth: width,
        maxWidth: 360,
      });
    }, []);

    const handleClickOutside = useCallback((e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        !dropdownRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    }, []);

    useEffect(() => {
      if (!open) return;
      updateDropdownPosition();
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('resize', updateDropdownPosition);
      window.addEventListener('scroll', updateDropdownPosition, true);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        window.removeEventListener('resize', updateDropdownPosition);
        window.removeEventListener('scroll', updateDropdownPosition, true);
      };
    }, [open, handleClickOutside, updateDropdownPosition]);

    const handleSelect = useCallback(
      (modelId: string) => {
        onChange(modelId);
        setOpen(false);
      },
      [onChange]
    );

    const stopPointerEvent = useCallback((e: React.SyntheticEvent) => {
      e.stopPropagation();
    }, []);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }, []);

    return (
      <div
        ref={containerRef}
        className="jimeng-text-model-select inline-flex max-w-full items-center gap-1.5"
        title={title}
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        tabIndex={0}
        onPointerDown={stopPointerEvent}
        onMouseDown={stopPointerEvent}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        onKeyDown={handleKeyDown}
      >
        <span className="flex shrink-0 items-center justify-center leading-none">
          <selectedIcon.component size={16} />
        </span>
        <span className="jimeng-text-model-select-copy min-w-0 flex flex-col gap-0.5 leading-none">
          <span className="jimeng-text-model-select-label min-w-0 truncate leading-none">
            {selectedDisplay.name}
          </span>
          <span className="jimeng-text-model-select-meta min-w-0 truncate leading-none">
            {selectedDisplay.displayModel}
          </span>
        </span>
        <svg
          className="jimeng-text-model-select-chevron ml-auto shrink-0"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#007AFF"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d={open ? 'm18 15-6-6-6 6' : 'm6 9 6 6 6-6'} />
        </svg>

        {open &&
          dropdownStyle &&
          createPortal(
            <div
              ref={dropdownRef}
              className="jimeng-text-model-dropdown nodrag nowheel"
              role="listbox"
              style={dropdownStyle}
              onPointerDown={stopPointerEvent}
              onMouseDown={stopPointerEvent}
              onClick={stopPointerEvent}
            >
              <div
                className={`jimeng-text-model-dropdown-option ${value === 'auto' ? 'selected' : ''}`}
                role="option"
                aria-selected={value === 'auto'}
                onPointerDown={stopPointerEvent}
                onMouseDown={stopPointerEvent}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelect('auto');
                }}
              >
                {(() => {
                  const icon = getTextModelIcon('auto');
                  const display = getTextModelDisplay('auto');
                  return (
                    <>
                      <span className="jimeng-text-model-dropdown-icon"><icon.component size={18} /></span>
                      <span className="jimeng-text-model-dropdown-copy">
                        <span className="jimeng-text-model-dropdown-title">{display.name}</span>
                        <span className="jimeng-text-model-dropdown-desc">{display.desc}</span>
                      </span>
                    </>
                  );
                })()}
                <DropdownCheck selected={value === 'auto'} />
              </div>
              {TEXT_MODEL_GROUPS.map((group) => (
                <div key={group.label} className="jimeng-text-model-dropdown-group">
                  <div className="jimeng-text-model-dropdown-group-label">{group.label}</div>
                  {group.models.map((modelId) => (
                    <div
                      key={modelId}
                      className={`jimeng-text-model-dropdown-option ${value === modelId ? 'selected' : ''}`}
                      role="option"
                      aria-selected={value === modelId}
                      onPointerDown={stopPointerEvent}
                      onMouseDown={stopPointerEvent}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelect(modelId);
                      }}
                    >
                      {(() => {
                        const icon = getTextModelIcon(modelId);
                        const display = getTextModelDisplay(modelId);
                        return (
                          <>
                            <span className="jimeng-text-model-dropdown-icon"><icon.component size={18} /></span>
                            <span className="jimeng-text-model-dropdown-copy">
                              <span className="jimeng-text-model-dropdown-title">{display.name}</span>
                              <span className="jimeng-text-model-dropdown-desc">{display.desc}</span>
                            </span>
                          </>
                        );
                      })()}
                      <DropdownCheck selected={value === modelId} />
                    </div>
                  ))}
                </div>
              ))}
            </div>,
            document.body
          )}
      </div>
    );
  }
);

TextModelSelect.displayName = 'TextModelSelect';
