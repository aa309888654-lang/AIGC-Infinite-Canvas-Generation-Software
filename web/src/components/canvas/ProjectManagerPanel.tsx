import { useState, useEffect, useCallback } from 'react';
import { Node, Edge } from '@xyflow/react';
import { X, Plus, Trash2, FolderOpen, Star, Search, Loader2, Cloud, HardDrive } from 'lucide-react';
import { canvasProjectService } from '@/services/canvas-project-service';
import { useCanvasStore } from '@/store/useCanvasStore';
import { cn } from '@/lib/utils';

interface CanvasProjectMeta {
  id: string;
  name: string;
  description?: string;
  thumbnail?: string;
  isFavorite: boolean;
  nodeCount: number;
  createdAt: string;
  updatedAt: string;
}

interface ProjectManagerPanelProps {
  onClose: () => void;
}

const ProjectManagerPanel: React.FC<ProjectManagerPanelProps> = ({ onClose }) => {
  const [projects, setProjects] = useState<CanvasProjectMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeId, setActiveId] = useState<string | null>(canvasProjectService.getCurrentProjectId());
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const list = await canvasProjectService.listProjects();
      setProjects(list);
    } catch {
      setProjects(canvasProjectService.listLocal());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  const handleNewProject = useCallback(() => {
    const id = canvasProjectService.initProject();
    canvasProjectService.saveNow();
    setActiveId(id);
    const { setNodes, setEdges } = useCanvasStore.getState();
    setNodes([]);
    setEdges([]);
    loadProjects();
  }, [loadProjects]);

  const handleLoadProject = useCallback(async (id: string) => {
    const project = await canvasProjectService.loadProject(id);
    if (project) {
      const { setNodes, setEdges } = useCanvasStore.getState();
      setNodes((project.nodes || []) as any as Node[]);
      setEdges((project.edges || []) as any as Edge[]);
      setActiveId(id);
    }
  }, []);

  const handleDeleteProject = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('确定删除此工程？')) return;
    await canvasProjectService.deleteProject(id);
    if (activeId === id) {
      setActiveId(null);
    }
    loadProjects();
  }, [activeId, loadProjects]);

  const handleToggleFavorite = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const projects = canvasProjectService.getLocalStore();
    const project = projects.find(p => p.id === id);
    if (project) {
      project.isFavorite = !project.isFavorite;
      canvasProjectService.saveLocal(project);
      loadProjects();
    }
  }, [loadProjects]);

  const handleStartRename = useCallback((id: string, currentName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingId(id);
    setRenameValue(currentName);
  }, []);

  const handleConfirmRename = useCallback(() => {
    if (renamingId && renameValue.trim()) {
      canvasProjectService.renameProject(renamingId, renameValue.trim());
      setRenamingId(null);
      loadProjects();
    }
  }, [renamingId, renameValue, loadProjects]);

  const filtered = projects.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase())
  );

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60_000) return '刚刚';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}分钟前`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}小时前`;
    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-[560px] max-h-[80vh] bg-[#1a1a2e] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
              <FolderOpen size={16} className="text-violet-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">工程管理</h3>
              <p className="text-[10px] text-white/80">本地 {Math.min(projects.length, 900)} / 900 · 云端 50</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="flex items-center gap-2 px-5 py-3 border-b border-white/5">
          <div className="flex-1 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索工程..."
              className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500/50"
            />
          </div>
          <button
            onClick={handleNewProject}
            className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-sm text-white transition-colors"
          >
            <Plus size={14} />
            新建
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={20} className="animate-spin text-white/40" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-white/80">
              <FolderOpen size={32} className="mb-2" />
              <p className="text-sm">{search ? '没有匹配的工程' : '暂无工程，点击新建开始创作'}</p>
            </div>
          ) : (
            filtered.map((project) => (
              <div
                key={project.id}
                onClick={() => handleLoadProject(project.id)}
                className={cn(
                  'group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all',
                  activeId === project.id
                    ? 'bg-violet-500/15 border border-violet-500/30'
                    : 'hover:bg-white/5 border border-transparent'
                )}
              >
                <div className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0',
                  activeId === project.id ? 'bg-violet-500/30 text-violet-300' : 'bg-white/10 text-white/40'
                )}>
                  {project.nodeCount}
                </div>

                <div className="flex-1 min-w-0">
                  {renamingId === project.id ? (
                    <input
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={handleConfirmRename}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleConfirmRename(); if (e.key === 'Escape') setRenamingId(null); }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full px-2 py-0.5 bg-white/10 border border-violet-500/50 rounded text-sm text-white focus:outline-none"
                      autoFocus
                    />
                  ) : (
                    <p
                      className="text-sm text-white truncate"
                      onDoubleClick={(e) => handleStartRename(project.id, project.name, e)}
                    >
                      {project.name}
                    </p>
                  )}
                  <p className="text-[10px] text-white/30 mt-0.5">
                    {formatTime(project.updatedAt)} · {project.nodeCount} 个节点
                  </p>
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => handleToggleFavorite(project.id, e)}
                    className={cn('p-1 rounded hover:bg-white/10 transition-colors', project.isFavorite ? 'text-yellow-400' : 'text-white/30')}
                  >
                    <Star size={12} fill={project.isFavorite ? 'currentColor' : 'none'} />
                  </button>
                  <button
                    onClick={(e) => handleDeleteProject(project.id, e)}
                    className="p-1 rounded hover:bg-red-500/20 text-white/30 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>

                {activeId === project.id && (
                  <div className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
                )}
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-t border-white/5 bg-[#141418]/50">
          <div className="flex items-center gap-3 text-[10px] text-white/30">
            <span className="flex items-center gap-1"><HardDrive size={10} /> 本地 1分钟</span>
            <span className="flex items-center gap-1"><Cloud size={10} /> 云端 5分钟</span>
          </div>
          <p className="text-[10px] text-white/20">双击重命名 · 自动保存中</p>
        </div>
      </div>
    </div>
  );
};

export default ProjectManagerPanel;
