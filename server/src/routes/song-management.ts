import { Router } from 'express';
import prisma from '../lib/prisma';
import { requireAuth, type AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const router = Router();

router.use(requireAuth);

// 1. 保存歌曲
router.post('/songs/save', async (req: AuthRequest, res, next) => {
  try {
    const { title, lyrics, lrc, audioUrl, coverImageUrl, songInfo } = req.body;
    
    if (!title || !audioUrl) {
      throw new AppError('歌曲标题和音频URL不能为空', 400);
    }

    const song = await prisma.song.create({
      data: {
        userId: req.userId!,
        title,
        lyrics: lyrics || '',
        lrc: lrc || '',
        audioUrl,
        coverImageUrl: coverImageUrl || null,
        artist: songInfo?.artist || '',
        composer: songInfo?.composer || '',
        lyricist: songInfo?.lyricist || '',
        arranger: songInfo?.arranger || '',
        producer: songInfo?.producer || '',
        album: songInfo?.album || '',
        genre: songInfo?.genre || '',
        year: songInfo?.year || '',
        comment: songInfo?.comment || '',
      },
    });

    res.status(201).json({
      success: true,
      data: {
        id: song.id,
        title: song.title,
      },
    });
  } catch (error) {
    next(error);
  }
});

// 2. 获取歌曲历史
router.get('/songs/history', async (req: AuthRequest, res, next) => {
  try {
    const { page = 1, limit = 20, sort = 'newest' } = req.query;

    const songs = await prisma.song.findMany({
      where: { userId: req.userId! },
      orderBy: sort === 'oldest' 
        ? { createdAt: 'asc' } 
        : sort === 'title' 
          ? { title: 'asc' } 
          : { createdAt: 'desc' },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
    });

    const total = await prisma.song.count({
      where: { userId: req.userId! },
    });

    res.json({
      success: true,
      data: songs.map(song => ({
        id: song.id,
        title: song.title,
        lyrics: song.lyrics,
        lrc: song.lrc,
        audioUrl: song.audioUrl,
        coverImageUrl: song.coverImageUrl,
        songInfo: {
          artist: song.artist,
          composer: song.composer,
          lyricist: song.lyricist,
          arranger: song.arranger,
          producer: song.producer,
          album: song.album,
          genre: song.genre,
          year: song.year,
          comment: song.comment,
        },
        createdAt: song.createdAt,
      })),
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
});

// 3. 收藏歌曲
router.post('/songs/favorite', async (req: AuthRequest, res, next) => {
  try {
    const { songId, action } = req.body;

    if (!songId || !action) {
      throw new AppError('缺少参数', 400);
    }

    if (action === 'add') {
      await prisma.favorite.create({
        data: {
          userId: req.userId!,
          songId,
        },
      });
    } else if (action === 'remove') {
      await prisma.favorite.deleteMany({
        where: {
          userId: req.userId!,
          songId,
        },
      });
    }

    res.json({ success: true });
  } catch (error) {
    if ((error as any).code === 'P2002') {
      return res.json({ success: true, message: '已经收藏过了' });
    }
    next(error);
  }
});

// 4. 获取收藏列表
router.get('/songs/favorites', async (req: AuthRequest, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const favorites = await prisma.favorite.findMany({
      where: { userId: req.userId! },
      include: {
        song: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
    });

    const total = await prisma.favorite.count({
      where: { userId: req.userId! },
    });

    res.json({
      success: true,
      data: favorites.map(fav => ({
        id: fav.song.id,
        title: fav.song.title,
        lyrics: fav.song.lyrics,
        lrc: fav.song.lrc,
        audioUrl: fav.song.audioUrl,
        coverImageUrl: fav.song.coverImageUrl,
        songInfo: {
          artist: fav.song.artist,
          composer: fav.song.composer,
          lyricist: fav.song.lyricist,
          arranger: fav.song.arranger,
          producer: fav.song.producer,
          album: fav.song.album,
          genre: fav.song.genre,
          year: fav.song.year,
          comment: fav.song.comment,
        },
        createdAt: fav.song.createdAt,
        favoritedAt: fav.createdAt,
      })),
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
});

// 5. 添加播放历史
router.post('/songs/play-history', async (req: AuthRequest, res, next) => {
  try {
    const { songId, duration, completion } = req.body;

    if (!songId) {
      throw new AppError('歌曲ID不能为空', 400);
    }

    await prisma.playHistory.create({
      data: {
        userId: req.userId!,
        songId,
        duration: duration || null,
        completion: completion || 0,
      },
    });

    await prisma.song.updateMany({
      where: { id: songId, userId: req.userId! },
      data: {
        playCount: { increment: 1 },
      },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// 6. 获取播放历史
router.get('/songs/play-history', async (req: AuthRequest, res, next) => {
  try {
    const { page = 1, limit = 50 } = req.query;

    const history = await prisma.playHistory.findMany({
      where: { userId: req.userId! },
      include: {
        song: true,
      },
      orderBy: { playedAt: 'desc' },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
    });

    const total = await prisma.playHistory.count({
      where: { userId: req.userId! },
    });

    res.json({
      success: true,
      data: history.map(h => ({
        id: h.song.id,
        title: h.song.title,
        lyrics: h.song.lyrics,
        lrc: h.song.lrc,
        audioUrl: h.song.audioUrl,
        coverImageUrl: h.song.coverImageUrl,
        songInfo: {
          artist: h.song.artist,
          composer: h.song.composer,
          lyricist: h.song.lyricist,
          arranger: h.song.arranger,
          producer: h.song.producer,
          album: h.song.album,
          genre: h.song.genre,
          year: h.song.year,
          comment: h.song.comment,
        },
        playedAt: h.playedAt,
        duration: h.duration,
        completion: h.completion,
      })),
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
});

// 7. 删除歌曲
router.delete('/songs/:id', async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    await prisma.song.deleteMany({
      where: {
        id,
        userId: req.userId!,
      },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// 8. 生成分享链接
router.post('/songs/share', async (req: AuthRequest, res, next) => {
  try {
    const { songId } = req.body;

    if (!songId) {
      throw new AppError('歌曲ID不能为空', 400);
    }

    const song = await prisma.song.findFirst({
      where: {
        id: songId,
        OR: [
          { userId: req.userId! },
          { isPublic: true },
        ],
      },
    });

    if (!song) {
      throw new AppError('歌曲不存在或无权分享', 404);
    }

    const shareToken = Buffer.from(`${songId}:${Date.now()}`).toString('base64');
    const shareUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/shared/${shareToken}`;

    res.json({
      success: true,
      data: {
        shareUrl,
        qrCode: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(shareUrl)}`,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
