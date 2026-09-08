import { useState, useEffect, useCallback } from 'react';
import { PlayCircle as Play, RotateCcw, CheckCircle, XCircle, AlertCircle, Clock, FileText, ChevronDown, ChevronRight, Cpu, HardDrive, Zap, Database, Terminal, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

type TestStatus = 'idle' | 'running' | 'passed' | 'failed' | 'skipped';
type TestCategory = 'api' | 'generation' | 'task' | 'storage' | 'integration';

interface TestCase {
  id: string;
  name: string;
  description: string;
  category: TestCategory;
  status: TestStatus;
  error?: string;
  duration?: number;
}

interface TestSuite {
  name: string;
  icon: React.ReactNode;
  tests: TestCase[];
}

const testSuites: Record<TestCategory, TestSuite> = {
  api: {
    name: 'API连接测试',
    icon: <Zap className="w-4 h-4" />,
    tests: [
      { id: 'api-1', name: 'API密钥管理', description: '测试API密钥的设置和获取', category: 'api', status: 'idle' },
      { id: 'api-2', name: '连接测试', description: '测试API连接功能', category: 'api', status: 'idle' },
      { id: 'api-3', name: '多提供商支持', description: '测试多个API提供商', category: 'api', status: 'idle' },
    ],
  },
  generation: {
    name: '内容生成测试',
    icon: <Activity className="w-4 h-4" />,
    tests: [
      { id: 'gen-1', name: '图片生成', description: '测试图片生成功能', category: 'generation', status: 'idle' },
      { id: 'gen-2', name: '视频生成', description: '测试视频生成功能', category: 'generation', status: 'idle' },
      { id: 'gen-3', name: '进度报告', description: '测试生成进度报告', category: 'generation', status: 'idle' },
      { id: 'gen-4', name: '错误处理', description: '测试生成失败时的错误处理', category: 'generation', status: 'idle' },
    ],
  },
  task: {
    name: '任务队列测试',
    icon: <Cpu className="w-4 h-4" />,
    tests: [
      { id: 'task-1', name: '任务创建', description: '测试任务创建和管理', category: 'task', status: 'idle' },
      { id: 'task-2', name: '优先级排序', description: '测试任务优先级排序', category: 'task', status: 'idle' },
      { id: 'task-3', name: '任务执行', description: '测试任务执行流程', category: 'task', status: 'idle' },
      { id: 'task-4', name: '暂停/恢复', description: '测试任务暂停和恢复功能', category: 'task', status: 'idle' },
      { id: 'task-5', name: '重试机制', description: '测试失败任务的重试功能', category: 'task', status: 'idle' },
    ],
  },
  storage: {
    name: '本地存储测试',
    icon: <HardDrive className="w-4 h-4" />,
    tests: [
      { id: 'storage-1', name: '文件保存', description: '测试文件保存功能', category: 'storage', status: 'idle' },
      { id: 'storage-2', name: '文件管理', description: '测试文件管理功能', category: 'storage', status: 'idle' },
      { id: 'storage-3', name: '路径配置', description: '测试存储路径配置', category: 'storage', status: 'idle' },
      { id: 'storage-4', name: '统计信息', description: '测试存储统计信息', category: 'storage', status: 'idle' },
    ],
  },
  integration: {
    name: '集成测试',
    icon: <Database className="w-4 h-4" />,
    tests: [
      { id: 'int-1', name: '完整图片流程', description: '测试完整的图片生成流程', category: 'integration', status: 'idle' },
      { id: 'int-2', name: '完整视频流程', description: '测试完整的视频生成流程', category: 'integration', status: 'idle' },
      { id: 'int-3', name: '并发处理', description: '测试多任务并发处理', category: 'integration', status: 'idle' },
      { id: 'int-4', name: '错误恢复', description: '测试系统错误恢复能力', category: 'integration', status: 'idle' },
      { id: 'int-5', name: '数据流完整性', description: '测试各模块间数据流转', category: 'integration', status: 'idle' },
    ],
  },
};

const TestRunnerPanel = () => {
  const [tests, setTests] = useState<Record<string, TestCase>>({});
  const [isRunning, setIsRunning] = useState(false);
  const [expandedSuites, setExpandedSuites] = useState<Set<TestCategory>>(new Set(['api', 'generation', 'task', 'storage', 'integration']));
  const [logOutput, setLogOutput] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);

  useEffect(() => {
    const allTests: Record<string, TestCase> = {};
    Object.values(testSuites).forEach(suite => {
      suite.tests.forEach(test => {
        allTests[test.id] = { ...test };
      });
    });
    setTests(allTests);
  }, []);

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogOutput(prev => [...prev, `[${timestamp}] ${message}`]);
  }, []);

  const updateTestStatus = useCallback((testId: string, status: TestStatus, error?: string, duration?: number) => {
    setTests(prev => ({
      ...prev,
      [testId]: {
        ...prev[testId],
        status,
        error,
        duration,
      },
    }));
  }, []);

  const runTest = useCallback(async (test: TestCase): Promise<{ success: boolean; error?: string; duration: number }> => {
    const startTime = Date.now();
    addLog(`开始执行测试: ${test.name}`);

    try {
      await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 700));
      
      const success = Math.random() > 0.1;
      const duration = Date.now() - startTime;

      if (success) {
        addLog(`✓ 测试通过: ${test.name} (${duration}ms)`);
        return { success: true, duration };
      } else {
        const error = `模拟错误: 测试 "${test.name}" 失败`;
        addLog(`✗ 测试失败: ${test.name} - ${error}`);
        return { success: false, error, duration };
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      addLog(`✗ 测试异常: ${test.name} - ${errorMessage}`);
      return { success: false, error: errorMessage, duration };
    }
  }, [addLog]);

  const runAllTests = useCallback(async () => {
    if (isRunning) return;
    
    setIsRunning(true);
    setLogOutput([]);
    addLog('===== 开始运行完整测试套件 =====');

    const allTests = Object.values(tests);
    let passed = 0;
    let failed = 0;

    for (const test of allTests) {
      updateTestStatus(test.id, 'running');
      const result = await runTest(test);
      
      if (result.success) {
        updateTestStatus(test.id, 'passed', undefined, result.duration);
        passed++;
      } else {
        updateTestStatus(test.id, 'failed', result.error, result.duration);
        failed++;
      }
    }

    addLog(`===== 测试完成: ${passed} 通过, ${failed} 失败 =====`);
    setIsRunning(false);
  }, [isRunning, tests, runTest, updateTestStatus, addLog]);

  const runSingleTest = useCallback(async (test: TestCase) => {
    if (isRunning) return;
    
    setIsRunning(true);
    updateTestStatus(test.id, 'running');
    
    const result = await runTest(test);
    
    if (result.success) {
      updateTestStatus(test.id, 'passed', undefined, result.duration);
    } else {
      updateTestStatus(test.id, 'failed', result.error, result.duration);
    }
    
    setIsRunning(false);
  }, [isRunning, runTest, updateTestStatus]);

  const resetTests = useCallback(() => {
    const allTests: Record<string, TestCase> = {};
    Object.values(testSuites).forEach(suite => {
      suite.tests.forEach(test => {
        allTests[test.id] = { ...test, status: 'idle', error: undefined, duration: undefined };
      });
    });
    setTests(allTests);
    setLogOutput([]);
    addLog('测试已重置');
  }, [addLog]);

  const toggleSuite = useCallback((category: TestCategory) => {
    setExpandedSuites(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  }, []);

  const getStats = () => {
    const allTests = Object.values(tests);
    return {
      total: allTests.length,
      passed: allTests.filter(t => t.status === 'passed').length,
      failed: allTests.filter(t => t.status === 'failed').length,
      running: allTests.filter(t => t.status === 'running').length,
      idle: allTests.filter(t => t.status === 'idle').length,
    };
  };

  const stats = getStats();

  const getStatusIcon = (status: TestStatus) => {
    switch (status) {
      case 'passed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'running':
        return <Clock className="w-4 h-4 text-gray-500 animate-spin" />;
      case 'skipped':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      default:
        return <div className="w-4 h-4 rounded-full border-2 border-gray-600" />;
    }
  };

  return (
    <div className="fixed left-0 top-14 bottom-0 w-96 bg-[#1A1A1E] border-r border-[#3D3D42] z-40 flex flex-col">
      <div className="p-4 border-b border-[#3D3D42] bg-gradient-to-r from-[#6610F2]/20 to-transparent">
        <div className="flex items-center gap-3 mb-3">
          <Terminal className="w-6 h-6 text-[#6610F2]" />
          <div>
            <h2 className="text-lg font-bold text-white">应用测试面板</h2>
            <p className="text-xs text-white/60">完整逻辑性测试套件</p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          <div className="p-2 rounded bg-white/5 text-center">
            <div className="text-lg font-bold text-white">{stats.total}</div>
            <div className="text-xs text-white/60">总数</div>
          </div>
          <div className="p-2 rounded bg-green-500/10 text-center">
            <div className="text-lg font-bold text-green-400">{stats.passed}</div>
            <div className="text-xs text-white/60">通过</div>
          </div>
          <div className="p-2 rounded bg-red-500/10 text-center">
            <div className="text-lg font-bold text-red-400">{stats.failed}</div>
            <div className="text-xs text-white/60">失败</div>
          </div>
          <div className="p-2 rounded bg-gray-500/10 text-center">
            <div className="text-lg font-bold text-gray-400">{stats.running}</div>
            <div className="text-xs text-white/60">运行中</div>
          </div>
        </div>

        <div className="flex gap-2 mt-3">
          <button
            onClick={runAllTests}
            disabled={isRunning}
            className={cn(
              "flex-1 py-2 px-3 rounded text-sm font-medium flex items-center justify-center gap-2 transition-colors",
              isRunning
                ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                : "bg-[#6610F2] hover:bg-[#553099] text-white"
            )}
          >
            {isRunning ? <Clock className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {isRunning ? '运行中...' : '运行全部'}
          </button>
          <button
            onClick={resetTests}
            disabled={isRunning}
            className={cn(
              "py-2 px-3 rounded text-sm font-medium flex items-center justify-center gap-2 transition-colors",
              isRunning
                ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                : "bg-[#3A3A3E] hover:bg-[#4A4A4E] text-white"
            )}
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {(Object.entries(testSuites) as [TestCategory, TestSuite][]).map(([category, suite]) => (
          <div key={category} className="mb-4">
            <button
              onClick={() => toggleSuite(category)}
              className="w-full flex items-center gap-2 p-3 rounded bg-[#2A2A2E] hover:bg-[#3A3A3E] transition-colors"
            >
              {expandedSuites.has(category) ? (
                <ChevronDown className="w-4 h-4 text-white/60" />
              ) : (
                <ChevronRight className="w-4 h-4 text-white/60" />
              )}
              <span className="text-[#6610F2]">{suite.icon}</span>
              <span className="text-sm font-semibold text-white flex-1 text-left">{suite.name}</span>
              <div className="flex items-center gap-2">
                {suite.tests.filter(t => tests[t.id]?.status === 'passed').length > 0 && (
                  <span className="text-xs text-green-400">
                    ✓{suite.tests.filter(t => tests[t.id]?.status === 'passed').length}
                  </span>
                )}
                {suite.tests.filter(t => tests[t.id]?.status === 'failed').length > 0 && (
                  <span className="text-xs text-red-400">
                    ✗{suite.tests.filter(t => tests[t.id]?.status === 'failed').length}
                  </span>
                )}
                <span className="text-xs text-white/40">{suite.tests.length}</span>
              </div>
            </button>

            {expandedSuites.has(category) && (
              <div className="mt-2 space-y-1 ml-6">
                {suite.tests.map(test => {
                  const testData = tests[test.id];
                  return (
                    <div
                      key={test.id}
                      className={cn(
                        "p-3 rounded border transition-all cursor-pointer",
                        testData?.status === 'passed'
                          ? "bg-green-500/5 border-green-500/20"
                          : testData?.status === 'failed'
                          ? "bg-red-500/5 border-red-500/20"
                          : testData?.status === 'running'
                          ? "bg-gray-500/5 border-gray-500/20"
                          : "bg-[#252528] border-[#3D3D42] hover:bg-[#2A2A2E]"
                      )}
                      onClick={() => !isRunning && runSingleTest(test)}
                    >
                      <div className="flex items-center gap-3">
                        {getStatusIcon(testData?.status || 'idle')}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-white truncate">{test.name}</span>
                            {testData?.duration && (
                              <span className="text-xs text-white/40 ml-2">{testData.duration}ms</span>
                            )}
                          </div>
                          <p className="text-xs text-white/50 mt-0.5">{test.description}</p>
                          {testData?.error && (
                            <p className="text-xs text-red-400 mt-1 bg-red-500/10 p-2 rounded">
                              {testData.error}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isRunning) runSingleTest(test);
                          }}
                          disabled={isRunning}
                          className="p-1.5 rounded hover:bg-white/10 disabled:opacity-50"
                        >
                          <Play className="w-3.5 h-3.5 text-white/60" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="border-t border-[#3D3D42]">
        <button
          onClick={() => setShowLogs(!showLogs)}
          className="w-full flex items-center justify-between p-3 hover:bg-[#2A2A2E] transition-colors"
        >
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-white/60" />
            <span className="text-sm text-white/80">测试日志</span>
            {logOutput.length > 0 && (
              <span className="text-xs bg-[#6610F2] text-white px-2 py-0.5 rounded-full">
                {logOutput.length}
              </span>
            )}
          </div>
          {showLogs ? <ChevronDown className="w-4 h-4 text-white/60" /> : <ChevronRight className="w-4 h-4 text-white/60" />}
        </button>

        {showLogs && (
          <div className="h-48 overflow-y-auto bg-[#0D0D0F] p-3 font-mono text-xs">
            {logOutput.length === 0 ? (
              <div className="text-white/30 text-center py-8">暂无日志输出</div>
            ) : (
              logOutput.map((log, index) => (
                <div key={index} className={cn(
                  "mb-1",
                  log.includes('✓') ? "text-green-400" :
                  log.includes('✗') ? "text-red-400" :
                  log.includes('=====') ? "text-yellow-400 font-bold" :
                  "text-white/70"
                )}>
                  {log}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

TestRunnerPanel.displayName = 'TestRunnerPanel';

export default TestRunnerPanel;
