import type { ClipIntelligenceReport } from './clip-intelligence-service';
import type {
  AddClipAction,
  AddMarkerAction,
  TimelinePlan,
  TimelinePlanAction,
  UpdateClipDurationAction,
  UpdateParamAction,
} from './timeline-plan-service';
import { getParamDef } from '@/lib/params/utils';

export type CreativeReflectionSeverity = 'info' | 'warning' | 'error';

export interface CreativeReflectionIssue {
  id: string;
  severity: CreativeReflectionSeverity;
  planId?: string;
  actionId?: string;
  message: string;
}

export interface CreativeReflectionResult {
  fixed: boolean;
  rounds: number;
  plans: TimelinePlan[];
  remainingIssues: CreativeReflectionIssue[];
  notes: string[];
}

const createIssueId = (index: number) => `creative_reflection_${Date.now()}_${index}`;

function signatureForAction(action: TimelinePlanAction): string {
  if (action.type === 'update-param') {
    return `update:${action.clipId}:${action.paramId}:${JSON.stringify(action.value)}`;
  }
  if (action.type === 'add-marker') {
    return `marker:${Math.round(action.frame)}:${action.label}:${action.color}`;
  }
  if (action.type === 'add-clip') {
    return `clip:${action.trackType}:${action.kind}:${Math.round(action.startFrame)}:${Math.round(action.durationFrames)}:${action.name}:${action.sourceId ?? ''}`;
  }
  if (action.type === 'update-clip-duration') {
    return `duration:${action.clipId}:${Math.round(action.startFrame)}:${Math.round(action.durationFrames)}`;
  }
  return `remove:${action.clipId}`;
}

function isFiniteFrame(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

export class CreativeReflectionService {
  reflectPlans(plans: TimelinePlan[], report: ClipIntelligenceReport): CreativeReflectionResult {
    const issues: CreativeReflectionIssue[] = [];
    const notes: string[] = [];
    const itemByClipId = new Map(report.items.map((item) => [item.clipId, item]));
    let fixed = false;
    let issueIndex = 0;

    const nextPlans = plans.map((plan) => {
      const seen = new Set<string>();
      const actions: TimelinePlanAction[] = [];

      for (const action of plan.actions) {
        const signature = signatureForAction(action);
        if (seen.has(signature)) {
          fixed = true;
          issues.push({
            id: createIssueId(issueIndex++),
            severity: 'info',
            planId: plan.id,
            actionId: action.id,
            message: `已移除重复动作：${action.title}`,
          });
          continue;
        }
        seen.add(signature);

        if (!this.isActionUsable(action, report, itemByClipId, plan.id, issues, () => issueIndex++)) {
          fixed = true;
          continue;
        }

        actions.push(action);
      }

      if (plan.actions.length > 0 && actions.length === 0) {
        issues.push({
          id: createIssueId(issueIndex++),
          severity: 'warning',
          planId: plan.id,
          message: `${plan.title} 的动作在校验后全部不可用。`,
        });
      }

      return { ...plan, actions };
    });

    if (plans.length === 0) {
      issues.push({
        id: createIssueId(issueIndex++),
        severity: 'error',
        message: '未生成可执行草案。',
      });
    }

    if (report.summary.totalClips === 0) {
      issues.push({
        id: createIssueId(issueIndex++),
        severity: 'error',
        message: '当前时间线没有可分析片段。',
      });
    }

    if (report.visualItems.length === 0 && nextPlans.some((plan) => ['ai-lut', 'ai-effect', 'ai-sticker', 'ai-text'].includes(plan.source))) {
      issues.push({
        id: createIssueId(issueIndex++),
        severity: 'warning',
        message: '没有视觉片段，画面类草案不会产生有效动作。',
      });
    }

    const totalActions = nextPlans.reduce((sum, plan) => sum + plan.actions.length, 0);
    if (totalActions > 64) {
      issues.push({
        id: createIssueId(issueIndex++),
        severity: 'warning',
        message: `本轮草案包含 ${totalActions} 个动作，建议分批应用。`,
      });
    }

    notes.push(
      fixed ? '已完成一次规则反思并清理不可用动作。' : '已完成一次规则反思，未发现需要自动修正的动作。'
    );
    notes.push(`时间线：${report.summary.totalClips} 个片段，${report.summary.visualClips} 个视觉片段，${report.summary.audioClips} 个音频片段。`);

    return {
      fixed,
      rounds: 1,
      plans: nextPlans,
      remainingIssues: issues.filter((issue) => issue.severity !== 'info'),
      notes,
    };
  }

  private isActionUsable(
    action: TimelinePlanAction,
    report: ClipIntelligenceReport,
    itemByClipId: Map<string, ClipIntelligenceReport['items'][number]>,
    planId: string,
    issues: CreativeReflectionIssue[],
    nextIssueIndex: () => number
  ): boolean {
    if (action.type === 'update-param') {
      return this.isUpdateParamUsable(action as UpdateParamAction, itemByClipId, planId, issues, nextIssueIndex);
    }

    if (action.type === 'add-marker') {
      return this.isMarkerUsable(action as AddMarkerAction, planId, issues, nextIssueIndex);
    }

    if (action.type === 'add-clip') {
      return this.isAddClipUsable(action as AddClipAction, planId, issues, nextIssueIndex);
    }

    if (action.type === 'update-clip-duration') {
      return this.isDurationUsable(action as UpdateClipDurationAction, itemByClipId, planId, issues, nextIssueIndex);
    }

    return report.items.some((item) => item.clipId === action.clipId);
  }

  private isUpdateParamUsable(
    action: UpdateParamAction,
    itemByClipId: Map<string, ClipIntelligenceReport['items'][number]>,
    planId: string,
    issues: CreativeReflectionIssue[],
    nextIssueIndex: () => number
  ): boolean {
    const paramDef = getParamDef(action.paramId);
    if (!paramDef) {
      issues.push({
        id: createIssueId(nextIssueIndex()),
        severity: 'warning',
        planId,
        actionId: action.id,
        message: `参数不存在：${action.paramId}`,
      });
      return false;
    }

    const item = itemByClipId.get(action.clipId);
    if (item && !paramDef.appliesTo.includes(item.kind)) {
      issues.push({
        id: createIssueId(nextIssueIndex()),
        severity: 'warning',
        planId,
        actionId: action.id,
        message: `参数 ${action.paramId} 不适用于 ${item.kind} 片段。`,
      });
      return false;
    }

    return true;
  }

  private isMarkerUsable(
    action: AddMarkerAction,
    planId: string,
    issues: CreativeReflectionIssue[],
    nextIssueIndex: () => number
  ): boolean {
    if (!isFiniteFrame(action.frame)) {
      issues.push({
        id: createIssueId(nextIssueIndex()),
        severity: 'warning',
        planId,
        actionId: action.id,
        message: '标记帧位置无效。',
      });
      return false;
    }
    return true;
  }

  private isAddClipUsable(
    action: AddClipAction,
    planId: string,
    issues: CreativeReflectionIssue[],
    nextIssueIndex: () => number
  ): boolean {
    if (!isFiniteFrame(action.startFrame) || !Number.isFinite(action.durationFrames) || action.durationFrames <= 0) {
      issues.push({
        id: createIssueId(nextIssueIndex()),
        severity: 'warning',
        planId,
        actionId: action.id,
        message: `新增片段时间无效：${action.name}`,
      });
      return false;
    }
    return true;
  }

  private isDurationUsable(
    action: UpdateClipDurationAction,
    itemByClipId: Map<string, ClipIntelligenceReport['items'][number]>,
    planId: string,
    issues: CreativeReflectionIssue[],
    nextIssueIndex: () => number
  ): boolean {
    if (!itemByClipId.has(action.clipId)) {
      issues.push({
        id: createIssueId(nextIssueIndex()),
        severity: 'warning',
        planId,
        actionId: action.id,
        message: `找不到要调整的片段：${action.clipId}`,
      });
      return false;
    }
    if (!isFiniteFrame(action.startFrame) || !Number.isFinite(action.durationFrames) || action.durationFrames <= 0) {
      issues.push({
        id: createIssueId(nextIssueIndex()),
        severity: 'warning',
        planId,
        actionId: action.id,
        message: '片段时长调整参数无效。',
      });
      return false;
    }
    return true;
  }
}

export const creativeReflectionService = new CreativeReflectionService();
