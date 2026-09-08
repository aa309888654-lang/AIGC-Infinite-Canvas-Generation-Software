import { useMemo, useState } from 'react';
import { BookUser, Save, Trash2, User, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useAssetLibraryStore } from '@/store/useAssetLibraryStore';
import type { CharacterAsset } from '@/types/asset-library';

export interface CharacterLibraryItem {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  outfitImageUrl?: string;
  prompt?: string;
  negativePrompt?: string;
  tags: string[];
  defaultVoiceAssetId?: string;
}

interface CharacterLibraryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCharacter?: (character: CharacterLibraryItem) => void;
}

interface CharacterFormState {
  name: string;
  summary: string;
  primaryImage: string;
  outfitImage: string;
  prompt: string;
  negativePrompt: string;
  tags: string;
  defaultVoiceAssetId: string;
}

const DEFAULT_FORM: CharacterFormState = {
  name: '',
  summary: '',
  primaryImage: '',
  outfitImage: '',
  prompt: '',
  negativePrompt: '',
  tags: '',
  defaultVoiceAssetId: '',
};

function createCharacterAssetId() {
  return `character-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function parseTags(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function toCharacterLibraryItem(asset: CharacterAsset): CharacterLibraryItem {
  return {
    id: asset.id,
    name: asset.name,
    description: asset.summary,
    imageUrl: asset.primaryImage,
    thumbnailUrl: asset.primaryImage,
    outfitImageUrl: asset.outfitImage,
    prompt: asset.prompt,
    negativePrompt: asset.negativePrompt,
    tags: asset.tags,
    defaultVoiceAssetId: asset.defaultVoiceAssetId,
  };
}

export default function CharacterLibraryPanel({
  isOpen,
  onClose,
  onSelectCharacter,
}: CharacterLibraryPanelProps) {
  const characterAssets = useAssetLibraryStore((state) => state.characterAssets);
  const voiceAssets = useAssetLibraryStore((state) => state.voiceAssets);
  const upsertCharacterAsset = useAssetLibraryStore((state) => state.upsertCharacterAsset);
  const deleteCharacterAsset = useAssetLibraryStore((state) => state.deleteCharacterAsset);

  const [form, setForm] = useState<CharacterFormState>(DEFAULT_FORM);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredAssets = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();
    const sortedAssets = [...characterAssets].sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'));
    if (!keyword) {
      return sortedAssets;
    }

    return sortedAssets.filter((asset) => {
      return [
        asset.name,
        asset.summary,
        asset.prompt,
        asset.tags.join(' '),
      ]
        .join(' ')
        .toLowerCase()
        .includes(keyword);
    });
  }, [characterAssets, searchQuery]);

  if (!isOpen) {
    return null;
  }

  const handleChange = <T extends keyof CharacterFormState>(key: T, value: CharacterFormState[T]) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleSubmit = () => {
    if (!form.name.trim() || !form.primaryImage.trim() || !form.prompt.trim()) {
      return;
    }

    upsertCharacterAsset({
      id: createCharacterAssetId(),
      name: form.name.trim(),
      summary: form.summary.trim(),
      primaryImage: form.primaryImage.trim(),
      outfitImage: form.outfitImage.trim() || undefined,
      prompt: form.prompt.trim(),
      negativePrompt: form.negativePrompt.trim() || undefined,
      tags: parseTags(form.tags),
      defaultVoiceAssetId: form.defaultVoiceAssetId || undefined,
    });

    setForm(DEFAULT_FORM);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex h-[90vh] w-full max-w-7xl flex-col rounded-xl border border-white/10 bg-[#1A1A1D] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500/70 to-fuchsia-500/70 text-white">
              <BookUser className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">角色资产中心</h2>
              <p className="text-xs text-white/50">创建、管理并复用角色参考图与提示词资产。</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="关闭角色资产中心"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid flex-1 gap-4 overflow-hidden p-4 lg:grid-cols-[360px_minmax(0,1fr)]">
          <section className="overflow-y-auto rounded-xl border border-white/10 bg-[#0d0d0d]/95 p-4 shadow-lg backdrop-blur-xl">
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-white">新建角色资产</h3>
              <p className="mt-1 text-xs text-white/50">最小必填项为角色名、主参考图和角色提示词。</p>
            </div>

            <div className="space-y-3">
              <Field label="角色名称">
                <input
                  aria-label="角色名称"
                  value={form.name}
                  onChange={(event) => handleChange('name', event.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-violet-400/50"
                  placeholder="例如：夏宁"
                />
              </Field>

              <Field label="角色简介">
                <textarea
                  aria-label="角色简介"
                  value={form.summary}
                  onChange={(event) => handleChange('summary', event.target.value)}
                  className="min-h-20 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-violet-400/50"
                  placeholder="角色定位、气质、世界观标签"
                />
              </Field>

              <Field label="主参考图">
                <input
                  aria-label="主参考图"
                  value={form.primaryImage}
                  onChange={(event) => handleChange('primaryImage', event.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-violet-400/50"
                  placeholder="图片 URL 或本地持久化键"
                />
              </Field>

              <Field label="服装参考图">
                <input
                  aria-label="服装参考图"
                  value={form.outfitImage}
                  onChange={(event) => handleChange('outfitImage', event.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-violet-400/50"
                  placeholder="可选"
                />
              </Field>

              <Field label="角色提示词">
                <textarea
                  aria-label="角色提示词"
                  value={form.prompt}
                  onChange={(event) => handleChange('prompt', event.target.value)}
                  className="min-h-24 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-violet-400/50"
                  placeholder="black hair, calm heroine, detailed eyes"
                />
              </Field>

              <Field label="负向提示词">
                <textarea
                  aria-label="负向提示词"
                  value={form.negativePrompt}
                  onChange={(event) => handleChange('negativePrompt', event.target.value)}
                  className="min-h-20 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-violet-400/50"
                  placeholder="blur, bad anatomy"
                />
              </Field>

              <Field label="角色标签">
                <input
                  aria-label="角色标签"
                  value={form.tags}
                  onChange={(event) => handleChange('tags', event.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-violet-400/50"
                  placeholder="女主, 校园, 冷静"
                />
              </Field>

              <Field label="默认音色">
                <select
                  aria-label="默认音色"
                  value={form.defaultVoiceAssetId}
                  onChange={(event) => handleChange('defaultVoiceAssetId', event.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-violet-400/50"
                >
                  <option value="">不绑定</option>
                  {voiceAssets.map((voiceAsset) => (
                    <option key={voiceAsset.id} value={voiceAsset.id}>
                      {voiceAsset.name}
                    </option>
                  ))}
                </select>
              </Field>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={!form.name.trim() || !form.primaryImage.trim() || !form.prompt.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-400 disabled:cursor-not-allowed disabled:bg-violet-500/40"
              >
                <Save className="h-4 w-4" />
                保存角色
              </button>
            </div>
          </section>

          <section className="flex min-h-0 flex-col rounded-xl border border-white/10 bg-[#0d0d0d]/95 p-4 shadow-lg backdrop-blur-xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-white">角色资产列表</h3>
                <p className="mt-1 text-xs text-white/50">供视频、图片、分镜与角色一致性节点复用。</p>
              </div>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
                {filteredAssets.length} 个
              </span>
            </div>

            <input
              aria-label="搜索角色"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="mb-4 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-violet-400/50"
              placeholder="搜索角色名、简介或标签"
            />

            {filteredAssets.length === 0 ? (
              <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-white/10 bg-black/20 px-6 text-center text-sm text-white/45">
                还没有可用角色资产。
              </div>
            ) : (
              <div className="grid flex-1 gap-3 overflow-y-auto pr-1 md:grid-cols-2 xl:grid-cols-3">
                {filteredAssets.map((asset) => {
                  const viewModel = toCharacterLibraryItem(asset);

                  return (
                    <article
                      key={asset.id}
                      className="overflow-hidden rounded-xl border border-white/10 bg-black/20 transition-colors hover:border-violet-400/30"
                    >
                      {asset.primaryImage ? (
                        <img
                          src={asset.primaryImage}
                          alt={asset.name}
                          className="h-40 w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-40 w-full items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                          <User className="h-12 w-12 text-gray-600" />
                        </div>
                      )}

                      <div className="space-y-3 p-4">
                        <div>
                          <h4 className="text-sm font-semibold text-white">{asset.name}</h4>
                          <p className="mt-1 line-clamp-2 text-xs text-white/55">
                            {asset.summary || '未填写角色简介'}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {asset.tags.length > 0 ? (
                            asset.tags.map((tag) => <Tag key={tag}>{tag}</Tag>)
                          ) : (
                            <Tag muted>未设置标签</Tag>
                          )}
                          {asset.defaultVoiceAssetId ? <Tag>已绑音色</Tag> : null}
                        </div>

                        <p className={cn('line-clamp-3 text-xs text-white/65', !asset.prompt && 'text-white/40')}>
                          {asset.prompt || '未填写角色提示词'}
                        </p>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => onSelectCharacter?.(viewModel)}
                            className="flex-1 rounded-lg bg-violet-500 px-3 py-2 text-sm text-white transition-colors hover:bg-violet-400"
                            aria-label={`选择 ${asset.name}`}
                          >
                            选择
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteCharacterAsset(asset.id)}
                            className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-red-300 transition-colors hover:bg-red-500/20"
                            aria-label={`删除 ${asset.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
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
        muted ? 'bg-white/5 text-white/45' : 'bg-violet-500/10 text-violet-200',
      )}
    >
      {children}
    </span>
  );
}
