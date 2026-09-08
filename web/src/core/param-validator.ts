import type { ParamFieldSchema } from './types/node-manifest';
import { nodeRegistry } from './node-registry';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateParams(
  nodeType: string,
  params: Record<string, unknown>,
): ValidationResult {
  const manifest = nodeRegistry.get(nodeType);
  const schema = manifest?.execution?.requiredParams;
  if (!schema?.length) return { valid: true, errors: [] };

  const errors: string[] = [];

  for (const field of schema) {
    const value = params[field.key];
    const label = field.label || field.key;

    if (field.required && (value === undefined || value === null || value === '')) {
      errors.push(`${label} 不能为空`);
      continue;
    }

    if (value === undefined || value === null) continue;

    // 类型不匹配时报告错误，而非静默跳过
    if (field.type === 'string') {
      if (typeof value !== 'string') {
        errors.push(`${label} 必须是字符串`);
        continue;
      }
      if (field.minLength && value.length < field.minLength) {
        errors.push(`${label} 最少 ${field.minLength} 个字符`);
      }
      if (field.maxLength && value.length > field.maxLength) {
        errors.push(`${label} 最多 ${field.maxLength} 个字符`);
      }
      if (field.pattern) {
        try {
          if (!new RegExp(field.pattern).test(value)) {
            errors.push(`${label} 格式不正确`);
          }
        } catch {
          errors.push(`${label} 校验规则异常`);
        }
      }
    } else if (field.type === 'number') {
      if (typeof value !== 'number' || Number.isNaN(value)) {
        errors.push(`${label} 必须是数字`);
        continue;
      }
      if (field.min !== undefined && value < field.min) {
        errors.push(`${label} 不能小于 ${field.min}`);
      }
      if (field.max !== undefined && value > field.max) {
        errors.push(`${label} 不能大于 ${field.max}`);
      }
    } else if (field.type === 'boolean') {
      if (typeof value !== 'boolean') {
        errors.push(`${label} 必须是布尔值`);
        continue;
      }
    } else if (field.type === 'array') {
      if (!Array.isArray(value)) {
        errors.push(`${label} 必须是数组`);
        continue;
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export function getRequiredParams(nodeType: string): ParamFieldSchema[] {
  const manifest = nodeRegistry.get(nodeType);
  return manifest?.execution?.requiredParams || [];
}
