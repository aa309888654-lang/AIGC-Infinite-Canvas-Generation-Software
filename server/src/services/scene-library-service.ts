import prisma from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';

export interface CreateSceneData {
  name: string;
  summary?: string;
  primaryImage?: string;
  lightingPrompt?: string;
  environmentPrompt?: string;
  prompt?: string;
  negativePrompt?: string;
  tags?: string[];
}

export class SceneLibraryService {
  async createScene(userId: string, data: CreateSceneData) {
    return prisma.sceneLibrary.create({
      data: {
        userId,
        name: data.name,
        summary: data.summary || '',
        primaryImage: data.primaryImage,
        lightingPrompt: data.lightingPrompt || '',
        environmentPrompt: data.environmentPrompt || '',
        prompt: data.prompt || '',
        negativePrompt: data.negativePrompt || '',
        tags: data.tags ? JSON.stringify(data.tags) : '[]',
      },
    });
  }

  async getScenes(userId: string, options?: {
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

    return prisma.sceneLibrary.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options?.limit || 50,
      skip: options?.offset || 0,
    });
  }

  async getSceneById(userId: string, sceneId: string) {
    const scene = await prisma.sceneLibrary.findFirst({
      where: { id: sceneId, userId, isActive: true },
    });

    if (!scene) {
      throw new AppError('场景不存在', 404);
    }

    return scene;
  }

  async updateScene(userId: string, sceneId: string, data: Partial<CreateSceneData>) {
    const scene = await this.getSceneById(userId, sceneId);

    return prisma.sceneLibrary.update({
      where: { id: scene.id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.summary !== undefined && { summary: data.summary }),
        ...(data.primaryImage !== undefined && { primaryImage: data.primaryImage }),
        ...(data.lightingPrompt !== undefined && { lightingPrompt: data.lightingPrompt }),
        ...(data.environmentPrompt !== undefined && { environmentPrompt: data.environmentPrompt }),
        ...(data.prompt !== undefined && { prompt: data.prompt }),
        ...(data.negativePrompt !== undefined && { negativePrompt: data.negativePrompt }),
        ...(data.tags !== undefined && { tags: JSON.stringify(data.tags) }),
      },
    });
  }

  async deleteScene(userId: string, sceneId: string) {
    const scene = await this.getSceneById(userId, sceneId);

    return prisma.sceneLibrary.update({
      where: { id: scene.id },
      data: { isActive: false },
    });
  }
}

export const sceneLibraryService = new SceneLibraryService();
