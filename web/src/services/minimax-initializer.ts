import useUnifiedAPIConfigStore from '@/store/useUnifiedAPIConfigStore';
import { logger } from '@/lib/logger';

/**
 * 初始化 MiniMax Image-01 模型的默认 API KEY
 * 确保用户不需要手动填写 API KEY
 */
export function initializeMinimaxAPIKey() {
  const store = useUnifiedAPIConfigStore.getState();
  const minimaxConfig = store.getConfig('minimax');

  if (!minimaxConfig?.apiKey) {
    store.setProviderEnabled('minimax', true);
    store.setSelectedModel('minimax', 'MiniMax-M2.7-highspeed');

    logger.info('✅ MiniMax M2.7-highspeed 模型已启用，密钥由后端统一管理');
  }
}

/**
 * 初始化豆包（Doubao）视频生成模型的默认 API KEY
 * 确保视频生成功能可以正常使用
 */
export function initializeDoubaoAPIKey() {
  const store = useUnifiedAPIConfigStore.getState();
  const doubaoConfig = store.getConfig('doubao');

  if (!doubaoConfig?.apiKey) {
    store.setProviderEnabled('doubao', true);
    store.setSelectedModel('doubao', 'Doubao-Seedance-1.5-pro-251215');

    logger.info('✅ 豆包 Seedance 1.5 Pro 模型已启用，密钥由后端统一管理');
  }

  const doubaoVideoConfig = store.getConfig('doubao-video');
  if (!doubaoVideoConfig?.apiKey) {
    store.setProviderEnabled('doubao-video', true);
    store.setSelectedModel('doubao-video', 'Doubao-Seedance-1.5-pro-251215');
    logger.info('✅ 豆包视频配置（doubao-video）已启用');
  }
}

/**
 * 检查并确保 MiniMax 配置正确
 */
export function ensureMinimaxConfig() {
  const store = useUnifiedAPIConfigStore.getState();
  const minimaxConfig = store.getConfig('minimax');

  if (!minimaxConfig) {
    logger.info('⚠️ MiniMax 配置不存在，正在初始化...');
    initializeMinimaxAPIKey();
  } else if (!minimaxConfig.apiKey) {
    logger.info('⚠️ MiniMax 配置已存在但 API KEY 为空，正在设置默认 API KEY...');
    initializeMinimaxAPIKey();
  } else if (!minimaxConfig.model) {
    logger.info('⚠️ MiniMax 配置已存在但未选择模型，正在设置默认模型...');
    store.setSelectedModel('minimax', 'MiniMax-M2.7-highspeed');
  } else {
    logger.info('✅ MiniMax 配置已正确设置');
  }
}

/**
 * 重置 MiniMax 配置为默认值
 */
export function resetMinimaxConfig() {
  const store = useUnifiedAPIConfigStore.getState();
  store.clearConfig('minimax');
  initializeMinimaxAPIKey();
  logger.info('🔄 MiniMax 配置已重置为默认值');
}

/**
 * 初始化 Vidu Q2 视频生成模型的默认 API KEY
 * 基于Vidu官方API服务
 * 支持所有Vidu Q2/Q3系列模型：Q1, Q2, Q2 Pro, Q3 Turbo, Q3 Pro
 */
export function initializeViduQ2APIKey() {
  const store = useUnifiedAPIConfigStore.getState();

  const viduModels = [
    { id: 'viduq3-pro', name: 'Vidu Q3 Pro' },
    { id: 'viduq3-turbo', name: 'Vidu Q3 Turbo' },
    { id: 'viduq3-pro-fast', name: 'Vidu Q3 Pro Fast' },
    { id: 'viduq2-pro', name: 'Vidu Q2 Pro' },
    { id: 'viduq2', name: 'Vidu Q2' },
  ];

  for (const model of viduModels) {
    const config = store.getAllConfigs()[model.id];
    if (!config?.apiKey) {
      store.setProviderEnabled(model.id, true);
    }
  }

  const viduConfig = store.getConfig('vidu');
  if (!viduConfig?.apiKey) {
    store.setProviderEnabled('vidu', true);
    store.setSelectedModel('vidu', 'viduq3-pro');
  }

  logger.info('✅ Vidu Q3/Q2/Q1 系列模型已启用');
  logger.info('   模型列表:', viduModels.map(m => m.name).join(', '));
  logger.info('   密钥由后端统一管理');
}
