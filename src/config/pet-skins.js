export const PET_SKINS = [
    {
        id: 'default',
        name: '默认',
        description: '像素蓝',
        unlockAffinity: 0,
        baseTint: 0xffffff,
        accentColor: '#6b7280',
        accessory: 'none',
        eyeStyle: 'dot',
    },
    {
        id: 'sunshine',
        name: '阳光',
        description: '橘色温暖',
        unlockAffinity: 20,
        baseTint: 0xffd4cc,
        accentColor: '#f59e0b',
        accessory: 'bow',
        eyeStyle: 'round',
    },
    {
        id: 'sakura',
        name: '樱花',
        description: '粉色浪漫',
        unlockAffinity: 40,
        baseTint: 0xffccdd,
        accentColor: '#ec4899',
        glowColor: 0xffe4ec,
        accessory: 'star',
        eyeStyle: 'star',
    },
    {
        id: 'ocean',
        name: '深海',
        description: '蓝色深邃',
        unlockAffinity: 60,
        baseTint: 0xccd4ff,
        accentColor: '#3b82f6',
        glowColor: 0x4169e1,
        accessory: 'glasses',
        eyeStyle: 'round',
    },
    {
        id: 'galaxy',
        name: '星空',
        description: '紫色神秘',
        unlockAffinity: 80,
        baseTint: 0xe6ccff,
        accentColor: '#8b5cf6',
        glowColor: 0x9333ea,
        accessory: 'crown',
        eyeStyle: 'heart',
    },
    {
        id: 'rainbow',
        name: '彩虹',
        description: '五彩斑斓',
        unlockAffinity: 100,
        baseTint: 0xffffff,
        accentColor: '#06b6d4',
        glowColor: 0xffffff,
        accessory: 'crown',
        eyeStyle: 'star',
    },
];
export function getSkinById(id) {
    return PET_SKINS.find((s) => s.id === id) || PET_SKINS[0];
}
export function getUnlockedSkins(affinity) {
    return PET_SKINS.filter((s) => affinity >= s.unlockAffinity);
}
