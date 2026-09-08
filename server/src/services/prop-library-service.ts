import prisma from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';

export interface CreatePropData {
  name: string;
  summary?: string;
  primaryImage?: string;
  materialTags?: string[];
  prompt?: string;
  negativePrompt?: string;
  tags?: string[];
}

export class PropLibraryService {
  async createProp(userId: string, data: CreatePropData) {
    return prisma.propLibrary.create({
      data: {
        userId,
        name: data.name,
        summary: data.summary || '',
        primaryImage: data.primaryImage,
        materialTags: data.materialTags ? JSON.stringify(data.materialTags) : '[]',
        prompt: data.prompt || '',
        negativePrompt: data.negativePrompt || '',
        tags: data.tags ? JSON.stringify(data.tags) : '[]',
      },
    });
  }

  async getProps(userId: string, options?: {
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    const where: any = { userId, isActive: true };

    if (options?.search) {
      where.OR = [
        { name: { contains: options.search } },
        { summary: { contains: options.search } },
      ];
    }

    return prisma.propLibrary.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options?.limit || 50,
      skip: options?.offset || 0,
    });
  }

  async getPropById(userId: string, propId: string) {
    const prop = await prisma.propLibrary.findFirst({
      where: { id: propId, userId, isActive: true },
    });

    if (!prop) {
      throw new AppError('道具不存在', 404);
    }

    return prop;
  }

  async updateProp(userId: string, propId: string, data: Partial<CreatePropData>) {
    const prop = await this.getPropById(userId, propId);

    return prisma.propLibrary.update({
      where: { id: prop.id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.summary !== undefined && { summary: data.summary }),
        ...(data.primaryImage !== undefined && { primaryImage: data.primaryImage }),
        ...(data.materialTags !== undefined && { materialTags: JSON.stringify(data.materialTags) }),
        ...(data.prompt !== undefined && { prompt: data.prompt }),
        ...(data.negativePrompt !== undefined && { negativePrompt: data.negativePrompt }),
        ...(data.tags !== undefined && { tags: JSON.stringify(data.tags) }),
      },
    });
  }

  async deleteProp(userId: string, propId: string) {
    const prop = await this.getPropById(userId, propId);

    return prisma.propLibrary.update({
      where: { id: prop.id },
      data: { isActive: false },
    });
  }
}

export const propLibraryService = new PropLibraryService();
