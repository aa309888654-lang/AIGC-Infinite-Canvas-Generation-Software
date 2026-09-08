import prisma from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';

export interface CreateCharacterData {
  name: string;
  description?: string;
  appearance?: string;
  personality?: string;
  outfit?: string;
  traits?: string[];
  imageUrl?: string;
  thumbnailUrl?: string;
  groupType?: 'MAIN' | 'SUPPORTING' | 'EXTRA' | 'ANTAGONIST';
}

export interface CreateVariantData {
  variantType: 'EXPRESSION' | 'POSE' | 'OUTFIT' | 'ANGLE';
  variantName: string;
  expression?: string;
  pose?: string;
  outfit?: string;
  angle?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  prompt?: string;
}

export class CharacterLibraryService {
  async createCharacter(userId: string, data: CreateCharacterData) {
    return prisma.characterLibrary.create({
      data: {
        userId,
        name: data.name,
        description: data.description || '',
        appearance: data.appearance || '',
        personality: data.personality || '',
        outfit: data.outfit || '',
        traits: data.traits ? JSON.stringify(data.traits) : '[]',
        imageUrl: data.imageUrl,
        thumbnailUrl: data.thumbnailUrl,
        groupType: data.groupType || 'MAIN',
      },
      include: {
        variants: true,
      },
    });
  }

  async getCharacters(userId: string, options?: {
    groupType?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    const where: any = { userId, isActive: true };

    if (options?.groupType) {
      where.groupType = options.groupType;
    }

    if (options?.search) {
      where.OR = [
        { name: { contains: options.search } },
        { description: { contains: options.search } },
      ];
    }

    return prisma.characterLibrary.findMany({
      where,
      include: {
        variants: true,
        usageHistory: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: options?.limit || 50,
      skip: options?.offset || 0,
    });
  }

  async getCharacter(userId: string, characterId: string) {
    const character = await prisma.characterLibrary.findFirst({
      where: { id: characterId, userId, isActive: true },
      include: {
        variants: {
          orderBy: { createdAt: 'desc' },
        },
        usageHistory: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });

    if (!character) {
      throw new AppError('Character not found', 404);
    }

    return character;
  }

  async updateCharacter(userId: string, characterId: string, data: Partial<CreateCharacterData>) {
    const character = await prisma.characterLibrary.findFirst({
      where: { id: characterId, userId, isActive: true },
    });

    if (!character) {
      throw new AppError('Character not found', 404);
    }

    return prisma.characterLibrary.update({
      where: { id: characterId },
      data: {
        name: data.name,
        description: data.description,
        appearance: data.appearance,
        personality: data.personality,
        outfit: data.outfit,
        traits: data.traits ? JSON.stringify(data.traits) : undefined,
        imageUrl: data.imageUrl,
        thumbnailUrl: data.thumbnailUrl,
        groupType: data.groupType,
      },
      include: {
        variants: true,
      },
    });
  }

  async deleteCharacter(userId: string, characterId: string) {
    const character = await prisma.characterLibrary.findFirst({
      where: { id: characterId, userId, isActive: true },
    });

    if (!character) {
      throw new AppError('Character not found', 404);
    }

    return prisma.characterLibrary.update({
      where: { id: characterId },
      data: { isActive: false },
    });
  }

  async duplicateCharacter(userId: string, characterId: string, newName?: string) {
    const original = await this.getCharacter(userId, characterId);

    return prisma.characterLibrary.create({
      data: {
        userId,
        name: newName || `${original.name} (副本)`,
        description: original.description,
        appearance: original.appearance,
        personality: original.personality,
        outfit: original.outfit,
        traits: original.traits,
        imageUrl: original.imageUrl,
        thumbnailUrl: original.thumbnailUrl,
        groupType: original.groupType as any,
      },
      include: {
        variants: true,
      },
    });
  }

  async createVariant(userId: string, characterId: string, data: CreateVariantData) {
    const character = await prisma.characterLibrary.findFirst({
      where: { id: characterId, userId, isActive: true },
    });

    if (!character) {
      throw new AppError('Character not found', 404);
    }

    return prisma.characterVariant.create({
      data: {
        characterId,
        variantType: data.variantType,
        variantName: data.variantName,
        expression: data.expression,
        pose: data.pose,
        outfit: data.outfit,
        angle: data.angle,
        imageUrl: data.imageUrl,
        thumbnailUrl: data.thumbnailUrl,
        prompt: data.prompt || '',
      },
    });
  }

  async getVariants(userId: string, characterId: string, variantType?: string) {
    const character = await prisma.characterLibrary.findFirst({
      where: { id: characterId, userId, isActive: true },
    });

    if (!character) {
      throw new AppError('Character not found', 404);
    }

    return prisma.characterVariant.findMany({
      where: {
        characterId,
        ...(variantType ? { variantType } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateVariant(userId: string, characterId: string, variantId: string, data: Partial<CreateVariantData>) {
    const character = await prisma.characterLibrary.findFirst({
      where: { id: characterId, userId, isActive: true },
    });

    if (!character) {
      throw new AppError('Character not found', 404);
    }

    const variant = await prisma.characterVariant.findFirst({
      where: { id: variantId, characterId },
    });

    if (!variant) {
      throw new AppError('Variant not found', 404);
    }

    return prisma.characterVariant.update({
      where: { id: variantId },
      data: {
        variantName: data.variantName,
        expression: data.expression,
        pose: data.pose,
        outfit: data.outfit,
        angle: data.angle,
        imageUrl: data.imageUrl,
        thumbnailUrl: data.thumbnailUrl,
        prompt: data.prompt,
      },
    });
  }

  async deleteVariant(userId: string, characterId: string, variantId: string) {
    const character = await prisma.characterLibrary.findFirst({
      where: { id: characterId, userId, isActive: true },
    });

    if (!character) {
      throw new AppError('Character not found', 404);
    }

    const variant = await prisma.characterVariant.findFirst({
      where: { id: variantId, characterId },
    });

    if (!variant) {
      throw new AppError('Variant not found', 404);
    }

    return prisma.characterVariant.delete({
      where: { id: variantId },
    });
  }

  async recordUsage(userId: string, characterId: string, sceneId?: string, sceneName?: string, usageContext?: string, generatedImage?: string) {
    const character = await prisma.characterLibrary.findFirst({
      where: { id: characterId, userId, isActive: true },
    });

    if (!character) {
      throw new AppError('Character not found', 404);
    }

    await prisma.characterLibrary.update({
      where: { id: characterId },
      data: { useCount: { increment: 1 } },
    });

    return prisma.characterUsage.create({
      data: {
        characterId,
        sceneId,
        sceneName,
        usageContext,
        generatedImage,
      },
    });
  }

  async getTemplates(category?: string) {
    return prisma.characterTemplate.findMany({
      where: {
        OR: [
          { isPublic: true },
          { userId: null },
        ],
        ...(category ? { category } : {}),
      },
      orderBy: { useCount: 'desc' },
    });
  }

  async createTemplate(userId: string, data: {
    name: string;
    category?: string;
    description?: string;
    prompt: string;
    thumbnailUrl?: string;
    isPublic?: boolean;
  }) {
    return prisma.characterTemplate.create({
      data: {
        userId,
        name: data.name,
        category: data.category || 'custom',
        description: data.description || '',
        prompt: data.prompt,
        thumbnailUrl: data.thumbnailUrl,
        isPublic: data.isPublic || false,
      },
    });
  }

  async updateGroup(userId: string, characterId: string, groupType: 'MAIN' | 'SUPPORTING' | 'EXTRA' | 'ANTAGONIST') {
    const character = await prisma.characterLibrary.findFirst({
      where: { id: characterId, userId, isActive: true },
    });

    if (!character) {
      throw new AppError('Character not found', 404);
    }

    return prisma.characterLibrary.update({
      where: { id: characterId },
      data: { groupType },
    });
  }

  async getCharacterStats(userId: string) {
    const [total, main, supporting, extra, antagonist] = await Promise.all([
      prisma.characterLibrary.count({ where: { userId, isActive: true } }),
      prisma.characterLibrary.count({ where: { userId, isActive: true, groupType: 'MAIN' } }),
      prisma.characterLibrary.count({ where: { userId, isActive: true, groupType: 'SUPPORTING' } }),
      prisma.characterLibrary.count({ where: { userId, isActive: true, groupType: 'EXTRA' } }),
      prisma.characterLibrary.count({ where: { userId, isActive: true, groupType: 'ANTAGONIST' } }),
    ]);

    const totalUsage = await prisma.characterLibrary.aggregate({
      where: { userId, isActive: true },
      _sum: { useCount: true },
    });

    return {
      total,
      byGroup: {
        main,
        supporting,
        extra,
        antagonist,
      },
      totalUsage: totalUsage._sum.useCount || 0,
    };
  }
}

export const characterLibraryService = new CharacterLibraryService();
