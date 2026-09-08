import { splitStoryboardScript } from './storyboard-script-segments';

describe('splitStoryboardScript', () => {
  it('groups every 12 scene blocks into a storyboard segment', () => {
    const script = Array.from({ length: 25 }, (_, index) => `第${index + 1}场\n场景内容 ${index + 1}`).join('\n\n');
    const segments = splitStoryboardScript(script);
    expect(segments).toHaveLength(3);
    expect(segments[0].title).toBe('12宫格分镜段落 1');
    expect(segments.map((item) => item.script).join('\n')).toContain('场景内容 25');
  });

  it('never creates more than 20 segments', () => {
    const script = Array.from({ length: 300 }, (_, index) => `第${index + 1}场\n内容`).join('\n\n');
    expect(splitStoryboardScript(script)).toHaveLength(20);
  });

  it('splits a long unstructured script without losing its ending', () => {
    const script = Array.from({ length: 500 }, (_, index) => `这是第${index}句剧情。`).join('');
    const segments = splitStoryboardScript(script);
    expect(segments.length).toBeGreaterThan(1);
    expect(segments.map((item) => item.script).join('')).toContain('这是第499句剧情。');
  });
});
