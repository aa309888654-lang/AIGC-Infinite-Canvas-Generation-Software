import { useMemo, useState } from 'react';
import { Mic2, Music2, Save, Trash2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useAssetLibraryStore } from '@/store/useAssetLibraryStore';
import type { VoiceAsset } from '@/types/asset-library';

interface VoiceAssetFormState {
  name: string;
  provider: string;
  voiceId: string;
  language: string;
  genderStyle: string;
  styleTags: string;
  previewText: string;
  previewAudioUrl: string;
  defaultRate: string;
  defaultEmotion: string;
}

const DEFAULT_FORM: VoiceAssetFormState = {
  name: '',
  provider: '',
  voiceId: '',
  language: 'zh-CN',
  genderStyle: '',
  styleTags: '',
  previewText: '你好，这是一段音色试听文本。',
  previewAudioUrl: '',
  defaultRate: '1',
  defaultEmotion: '',
};

function createVoiceAssetId() {
  return `voice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function parseTags(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeRate(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export default function VoiceAssetCenterPanel() {
  const voiceAssets = useAssetLibraryStore((state) => state.voiceAssets);
  const upsertVoiceAsset = useAssetLibraryStore((state) => state.upsertVoiceAsset);
  const deleteVoiceAsset = useAssetLibraryStore((state) => state.deleteVoiceAsset);

  const [form, setForm] = useState<VoiceAssetFormState>(DEFAULT_FORM);

  const sortedVoiceAssets = useMemo(
    () => [...voiceAssets].sort((left, right) => left.name.localeCompare(right.name, 'zh-CN')),
    [voiceAssets],
  );

  const handleChange = <T extends keyof VoiceAssetFormState>(key: T, value: VoiceAssetFormState[T]) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleSubmit = () => {
    if (!form.name.trim() || !form.provider.trim() || !form.voiceId.trim()) {
      return;
    }

    const nextAsset: VoiceAsset = {
      id: createVoiceAssetId(),
      name: form.name.trim(),
      provider: form.provider.trim(),
      voiceId: form.voiceId.trim(),
      language: form.language.trim() || 'zh-CN',
      genderStyle: form.genderStyle.trim(),
      styleTags: parseTags(form.styleTags),
      previewText: form.previewText.trim(),
      previewAudioUrl: form.previewAudioUrl.trim() || undefined,
      defaultRate: normalizeRate(form.defaultRate),
      defaultEmotion: form.defaultEmotion.trim() || undefined,
    };

    upsertVoiceAsset(nextAsset);
    setForm(DEFAULT_FORM);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
      <section className="rounded-xl border border-white/10 bg-[#0d0d0d]/95 p-4 shadow-lg backdrop-blur-xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-300">
            <Mic2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">音色资产中心</h2>
            <p className="text-xs text-white/50">保存常用音色配置，供配音节点与项目复用。</p>
          </div>
        </div>

        <div className="space-y-3">
          <Field label="音色名称">
            <input
              aria-label="音色名称"
              value={form.name}
              onChange={(event) => handleChange('name', event.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-cyan-400/50"
              placeholder="例如：旁白男声"
            />
          </Field>

          <Field label="提供商">
            <input
              aria-label="提供商"
              value={form.provider}
              onChange={(event) => handleChange('provider', event.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-cyan-400/50"
              placeholder="例如：minimax"
            />
          </Field>

          <Field label="Voice ID">
            <input
              aria-label="Voice ID"
              value={form.voiceId}
              onChange={(event) => handleChange('voiceId', event.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-cyan-400/50"
              placeholder="例如：voice-001"
            />
          </Field>

          <Field label="语言">
            <input
              aria-label="语言"
              value={form.language}
              onChange={(event) => handleChange('language', event.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-cyan-400/50"
            />
          </Field>

          <Field label="音色风格">
            <input
              aria-label="音色风格"
              value={form.genderStyle}
              onChange={(event) => handleChange('genderStyle', event.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-cyan-400/50"
              placeholder="例如：成熟男声 / 少女音"
            />
          </Field>

          <Field label="风格标签">
            <input
              aria-label="风格标签"
              value={form.styleTags}
              onChange={(event) => handleChange('styleTags', event.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-cyan-400/50"
              placeholder="温柔, 旁白, 沉稳"
            />
          </Field>

          <Field label="试听文本">
            <textarea
              aria-label="试听文本"
              value={form.previewText}
              onChange={(event) => handleChange('previewText', event.target.value)}
              className="min-h-24 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-cyan-400/50"
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="试听音频链接">
              <input
                aria-label="试听音频链接"
                value={form.previewAudioUrl}
                onChange={(event) => handleChange('previewAudioUrl', event.target.value)}
                className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-cyan-400/50"
                placeholder="https://..."
              />
            </Field>

            <Field label="默认语速">
              <input
                aria-label="默认语速"
                value={form.defaultRate}
                onChange={(event) => handleChange('defaultRate', event.target.value)}
                className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-cyan-400/50"
              />
            </Field>
          </div>

          <Field label="默认情绪">
            <input
              aria-label="默认情绪"
              value={form.defaultEmotion}
              onChange={(event) => handleChange('defaultEmotion', event.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-cyan-400/50"
              placeholder="例如：温柔"
            />
          </Field>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!form.name.trim() || !form.provider.trim() || !form.voiceId.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-cyan-500/40"
          >
            <Save className="h-4 w-4" />
            保存音色
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-white/10 bg-[#0d0d0d]/95 p-4 shadow-lg backdrop-blur-xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/20 text-violet-300">
              <Music2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">已保存音色</h3>
              <p className="text-xs text-white/50">当前项目可直接复用的本地音色资产。</p>
            </div>
          </div>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
            {sortedVoiceAssets.length} 个
          </span>
        </div>

        {sortedVoiceAssets.length === 0 ? (
          <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed border-white/10 bg-black/20 px-6 text-center text-sm text-white/45">
            还没有保存任何音色资产。
          </div>
        ) : (
          <div className="grid gap-3">
            {sortedVoiceAssets.map((asset) => (
              <article
                key={asset.id}
                className="rounded-xl border border-white/10 bg-black/20 p-4 transition-colors hover:border-cyan-400/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="truncate text-sm font-semibold text-white">{asset.name}</h4>
                    <p className="mt-1 text-xs text-white/55">
                      {asset.provider} / {asset.voiceId} / {asset.language}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteVoiceAsset(asset.id)}
                    className="rounded-lg border border-red-500/20 bg-red-500/10 p-2 text-red-300 transition-colors hover:bg-red-500/20"
                    aria-label={`删除 ${asset.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {asset.genderStyle ? (
                    <Tag>{asset.genderStyle}</Tag>
                  ) : (
                    <Tag muted>未设置风格</Tag>
                  )}
                  {asset.defaultEmotion ? <Tag>{asset.defaultEmotion}</Tag> : null}
                  {asset.styleTags.map((tag) => (
                    <Tag key={tag}>{tag}</Tag>
                  ))}
                </div>

                <p className={cn('mt-3 text-sm text-white/70', !asset.previewText && 'text-white/40')}>
                  {asset.previewText || '未提供试听文本'}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs text-white/60">{label}</span>
      {children}
    </label>
  );
}

function Tag({
  children,
  muted = false,
}: {
  children: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <span
      className={cn(
        'rounded-full px-2.5 py-1 text-xs',
        muted ? 'bg-white/5 text-white/45' : 'bg-cyan-500/10 text-cyan-200',
      )}
    >
      {children}
    </span>
  );
}
