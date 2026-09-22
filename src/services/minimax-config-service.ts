import useUnifiedAPIConfigStore from '@/store/useUnifiedAPIConfigStore';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

const MINIMAX_PROVIDER_ID = 'minimax';
const MINIMAX_MODEL_ID = 'MiniMax-M2.7-highspeed';

export interface MinMaxConfigResult {
  success: boolean;
  message: string;
  providerId?: string;
  modelId?: string;
}

function doLocalConfig(store: ReturnType<typeof useUnifiedAPIConfigStore.getState>): void {
  store.setConfig(MINIMAX_PROVIDER_ID, {
    model: MINIMAX_MODEL_ID,
  });
  store.setProviderEnabled(MINIMAX_PROVIDER_ID, true);
  store.setSelectedModel(MINIMAX_PROVIDER_ID, MINIMAX_MODEL_ID);
}

export async function configureMinimaxProvider(): Promise<MinMaxConfigResult> {
  try {
    const store = useUnifiedAPIConfigStore.getState();
    await store.fetchProviderConfigs({ force: true });
    if (!store.providerConfigs[MINIMAX_PROVIDER_ID]?.hasApiKey) {
      logger.warn('[MinimaxConfig] 后端未配置 MiniMax Provider');
      return {
        success: false,
        message: 'MiniMax 服务未在后端配置，请联系管理员配置 Provider',
      };
    }

    doLocalConfig(store);

    logger.info('[MinimaxConfig] 已启用后端托管 MiniMax Provider');

    return {
      success: true,
      message: 'MiniMax 后端服务已启用',
      providerId: MINIMAX_PROVIDER_ID,
      modelId: MINIMAX_MODEL_ID,
    };
  } catch (error) {
    console.error('[MinimaxConfig] 配置失败:', error);
    return {
      success: false,
      message: `配置失败: ${error instanceof Error ? error.message : '未知错误'}`,
    };
  }
}

export function getMinimaxDefaultModel(): { modelId: string; provider: string } {
  return {
    modelId: MINIMAX_MODEL_ID,
    provider: MINIMAX_PROVIDER_ID,
  };
}

export async function ensureMinimaxConfigured(): Promise<boolean> {
  try {
    const configStore = useUnifiedAPIConfigStore.getState();
    await configStore.fetchProviderConfigs();
    if (configStore.providerConfigs[MINIMAX_PROVIDER_ID]?.hasApiKey) {
      return true;
    }

    const result = await configureMinimaxProvider();
    if (!result.success) {
      toast.error(result.message);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[MinimaxConfig] ensureMinimaxConfigured 失败:', error);
    return false;
  }
}
