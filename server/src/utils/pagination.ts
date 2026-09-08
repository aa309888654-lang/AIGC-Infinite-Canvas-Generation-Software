import { Request } from 'express';
import { safeParseInt } from './parse';

/**
 * P3 修复 #30：统一分页参数结构
 * 两个 parse 函数现在返回完全一致的字段集（page/pageSize/limit/skip/take），
 * 消除原来一个返回 pageSize、另一个返回 limit+offset 的不一致问题。
 * pageSize 与 limit 始终保持相同值，调用方按需取用。
 */
export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
  take: number;
  pageSize: number;
  offset?: number;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function parsePaginationParamsWithNumbers(
  page: number | undefined,
  pageSize: number | undefined,
  defaultPage: number = 1,
  defaultPageSize: number = 20,
  maxPageSize: number = 100
): PaginationParams {
  const p = Math.max(1, page || defaultPage);
  const size = Math.min(maxPageSize, Math.max(1, pageSize || defaultPageSize));

  return {
    page: p,
    pageSize: size,
    limit: size,
    skip: (p - 1) * size,
    take: size,
  };
}

export function parsePaginationParams(
  req: Request,
  options: {
    defaultPage?: number;
    defaultLimit?: number;
    maxLimit?: number;
  } = {}
): PaginationParams {
  const { defaultPage = 1, defaultLimit = 20, maxLimit = 100 } = options;

  let page = safeParseInt(req.query.page as string, defaultPage);
  let limit = safeParseInt(req.query.limit as string,
              safeParseInt(req.query.pageSize as string, defaultLimit));

  const offsetParam = safeParseInt(req.query.offset as string);
  const hasOffset = !isNaN(offsetParam) && offsetParam >= 0;

  if (page < 1) page = 1;
  if (limit < 1) limit = 1;
  if (limit > maxLimit) limit = maxLimit;

  const skip = hasOffset ? offsetParam : (page - 1) * limit;

  return {
    page: hasOffset ? Math.floor(offsetParam / limit) + 1 : page,
    pageSize: limit,
    limit,
    skip,
    take: limit,
    offset: hasOffset ? offsetParam : undefined,
  };
}

export function buildPaginationMeta(
  params: PaginationParams,
  total: number
): PaginationMeta {
  const pageSize = params.pageSize || params.take;
  const totalPages = Math.ceil(total / pageSize);

  return {
    page: params.page,
    pageSize,
    total,
    totalPages,
  };
}
