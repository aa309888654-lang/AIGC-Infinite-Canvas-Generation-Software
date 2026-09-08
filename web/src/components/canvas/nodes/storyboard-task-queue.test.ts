import { useTaskStore } from '@/store/useTaskStore';
import { startStoryboardQueueTask, updateStoryboardQueueTask } from './storyboard-task-queue';

describe('storyboard task queue', () => {
  beforeEach(() => {
    useTaskStore.setState({ tasks: {} });
  });

  it('allows only one active storyboard sheet generation at a time', () => {
    const first = startStoryboardQueueTask({
      nodeId: 'segment-1', modelId: 'model', modelProvider: 'provider', modelName: 'Model', promptPreview: '第一段',
    });
    expect(first).not.toBeNull();
    expect(startStoryboardQueueTask({
      nodeId: 'segment-2', modelId: 'model', modelProvider: 'provider', modelName: 'Model', promptPreview: '第二段',
    })).toBeNull();

    updateStoryboardQueueTask(first!.id, { status: 'completed', progress: 100 });
    expect(startStoryboardQueueTask({
      nodeId: 'segment-2', modelId: 'model', modelProvider: 'provider', modelName: 'Model', promptPreview: '第二段',
    })).not.toBeNull();
  });
});
