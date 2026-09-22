import { useTimelineStore } from '@/store/editmaster/useTimelineStore';

export function createOneClickDraftSequence(): string {
  const store = useTimelineStore.getState();
  const sequenceCount = store.sequences.filter((sequence) => sequence.name.startsWith('AI一键成片草稿')).length + 1;
  store.addSequence(`AI一键成片草稿 ${sequenceCount}`);
  return useTimelineStore.getState().activeSequenceId;
}
