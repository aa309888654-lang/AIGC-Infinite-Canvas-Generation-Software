export type CreativeChatRole = 'user' | 'assistant' | 'system';

export interface CreativeChatMessage {
  id: string;
  role: CreativeChatRole;
  content: string;
  createdAt: string;
}

export interface CreativeDecisionRecord {
  id: string;
  title: string;
  detail: string;
  planIds: string[];
  createdAt: string;
}

export interface CreativeAppliedParams {
  planId: string;
  applied: number;
  skipped: number;
  failed: number;
  createdAt: string;
}

export interface CreativeSession {
  id: string;
  createdAt: string;
  updatedAt: string;
  selectedSkillId?: string;
  messages: CreativeChatMessage[];
  decisions: CreativeDecisionRecord[];
  appliedParams: CreativeAppliedParams[];
}

const STORAGE_KEY = 'creative-agent-session';
const HISTORY_LIMIT = 24;

const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

function nowIso(): string {
  return new Date().toISOString();
}

function hasStorage(): boolean {
  return typeof window !== 'undefined' && Boolean(window.localStorage);
}

function trimSession(session: CreativeSession): CreativeSession {
  return {
    ...session,
    messages: session.messages.slice(-HISTORY_LIMIT),
    decisions: session.decisions.slice(-HISTORY_LIMIT),
    appliedParams: session.appliedParams.slice(-HISTORY_LIMIT),
  };
}

export class CreativeSessionMemory {
  createNew(selectedSkillId?: string): CreativeSession {
    const timestamp = nowIso();
    return {
      id: createId('creative_session'),
      createdAt: timestamp,
      updatedAt: timestamp,
      selectedSkillId,
      messages: [
        {
          id: createId('creative_msg'),
          role: 'assistant',
          content: '智能创作 Agent 已就绪。',
          createdAt: timestamp,
        },
      ],
      decisions: [],
      appliedParams: [],
    };
  }

  load(): CreativeSession {
    if (!hasStorage()) return this.createNew();

    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return this.createNew();

    try {
      const parsed = JSON.parse(raw) as CreativeSession;
      if (!parsed.id || !Array.isArray(parsed.messages)) {
        return this.createNew();
      }
      return trimSession({
        ...parsed,
        decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
        appliedParams: Array.isArray(parsed.appliedParams) ? parsed.appliedParams : [],
      });
    } catch {
      return this.createNew();
    }
  }

  save(session: CreativeSession): CreativeSession {
    const next = trimSession({ ...session, updatedAt: nowIso() });
    if (hasStorage()) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
    return next;
  }

  clear(): CreativeSession {
    if (hasStorage()) {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    return this.createNew();
  }

  appendMessage(
    session: CreativeSession,
    message: Omit<CreativeChatMessage, 'id' | 'createdAt'>
  ): CreativeSession {
    return this.save({
      ...session,
      messages: [
        ...session.messages,
        {
          id: createId('creative_msg'),
          createdAt: nowIso(),
          ...message,
        },
      ],
    });
  }

  appendDecision(
    session: CreativeSession,
    decision: Omit<CreativeDecisionRecord, 'id' | 'createdAt'>
  ): CreativeSession {
    return this.save({
      ...session,
      decisions: [
        ...session.decisions,
        {
          id: createId('creative_decision'),
          createdAt: nowIso(),
          ...decision,
        },
      ],
    });
  }

  appendAppliedParams(
    session: CreativeSession,
    record: Omit<CreativeAppliedParams, 'createdAt'>
  ): CreativeSession {
    return this.save({
      ...session,
      appliedParams: [
        ...session.appliedParams,
        {
          ...record,
          createdAt: nowIso(),
        },
      ],
    });
  }
}

export const creativeSessionMemory = new CreativeSessionMemory();
