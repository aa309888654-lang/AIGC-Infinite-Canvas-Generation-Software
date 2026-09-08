const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const sharp = require('sharp');

const root = path.resolve(__dirname, '..', '..');
const envPath = path.join(root, 'backend', '.env');
const outputDir = path.join(root, 'frontend', 'public', 'inspiration', 'music');

function loadEnv(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[match[1]] = value;
  }
}

const tracks = [
  {
    slug: 'neon-heartbeat', title: '霓虹心跳', artist: '小天 AI', style: '城市电子',
    prompt: 'Chinese synth-pop, neon city at night, bright female vocal, crisp electronic drums, energetic bass, catchy modern chorus, polished commercial production',
    lyrics: '[Verse]\n霓虹落在雨后的街\n我听见城市的心跳\n[Chorus]\n跟着光 一起向前跑\n这一刻 梦正在燃烧',
    coverPrompt: 'Square album cover, futuristic neon Chinese city after rain, vivid cyan and magenta reflections, a luminous pulse line through the street, premium electronic music artwork, no text, no logo',
  },
  {
    slug: 'sea-breeze-letter', title: '海风写信', artist: '小天 AI', style: '夏日民谣',
    prompt: 'Chinese summer folk pop, warm female vocal, acoustic guitar, light hand percussion, ocean breeze ambience, intimate and hopeful, clean natural production',
    lyrics: '[Verse]\n海风把云推得很远\n沙滩留下我们的夏天\n[Chorus]\n写一封信 寄给蓝色海面\n说我会在 下一次潮汐出现',
    coverPrompt: 'Square album cover, quiet summer beach at golden hour, handwritten letter beside a seashell, turquoise water and soft breeze, poetic premium folk album photography, no text, no logo',
  },
  {
    slug: 'unfinished-starlight', title: '未完的星光', artist: '小天 AI', style: '电影配乐',
    prompt: 'Chinese cinematic orchestral pop, emotional male vocal, piano opening, sweeping strings, deep cinematic drums, rising heroic finale, spacious film score mix',
    lyrics: '[Verse]\n黑夜收起最后一束光\n远方还有沉默的回响\n[Chorus]\n未完的星光 照亮我的方向\n越过漫长时光 我仍然在路上',
    coverPrompt: 'Square cinematic album cover, lone traveler on a mountain ridge beneath an immense star field, deep indigo sky, silver light breaking through clouds, epic film score artwork, no text, no logo',
  },
  {
    slug: 'getting-better', title: '慢慢变好', artist: '小天 AI', style: '治愈钢琴',
    prompt: 'Chinese healing piano pop, gentle female vocal, felt piano, soft strings and subtle ambient texture, calm reassuring melody, warm intimate studio mix',
    lyrics: '[Verse]\n给疲惫的自己一个拥抱\n窗外的风也放慢了步调\n[Chorus]\n别着急 我们都会慢慢变好\n等清晨来到 再对世界微笑',
    coverPrompt: 'Square healing piano album cover, sunlit white piano beside a quiet window, fresh green leaves and soft morning light, peaceful refined minimalist photography, no text, no logo',
  },
];

async function api(pathname, options = {}) {
  const response = await fetch(`${process.env.MINIMAX_BASE_URL || 'https://api.minimaxi.com'}${pathname}`, {
    ...options,
    headers: { Authorization: `Bearer ${process.env.MINIMAX_API_KEY}`, 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`MiniMax ${pathname} failed (${response.status}): ${text.slice(0, 300)}`);
  const data = JSON.parse(text);
  if (data.base_resp && data.base_resp.status_code !== 0) throw new Error(data.base_resp.status_msg || `MiniMax business error ${data.base_resp.status_code}`);
  return data;
}

function dataObject(result) {
  return result.data && typeof result.data === 'object' ? result.data : result.output && typeof result.output === 'object' ? result.output : result;
}

async function generateAudio(track) {
  let result = await api('/v1/music_generation', { method: 'POST', body: JSON.stringify({ model: 'music-2.6', prompt: track.prompt, lyrics: track.lyrics, instrumental: false, audio_setting: { format: 'mp3', sample_rate: 44100, bitrate: 256000 } }) });
  let data = dataObject(result);
  const taskId = data.task_id || result.task_id;
  for (let attempt = 0; !data.audio && !data.audio_url && taskId && attempt < 90; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    result = await api(`/v1/query/music_generation?task_id=${encodeURIComponent(taskId)}`, { method: 'GET', headers: {} });
    data = dataObject(result);
    if (data.status === 'fail' || data.status === 'Fail' || data.status === 3) throw new Error(data.status_msg || `${track.title} generation failed`);
  }
  const rawPath = path.join(outputDir, `${track.slug}-raw.mp3`);
  if (data.audio && /^[0-9a-f]+$/i.test(data.audio)) fs.writeFileSync(rawPath, Buffer.from(data.audio, 'hex'));
  else if (data.audio_url) {
    const response = await fetch(data.audio_url);
    if (!response.ok) throw new Error(`Audio download failed: ${response.status}`);
    fs.writeFileSync(rawPath, Buffer.from(await response.arrayBuffer()));
  } else throw new Error(`${track.title} returned no audio`);
  const finalPath = path.join(outputDir, `${track.slug}.mp3`);
  const trimmed = spawnSync(ffmpegPath, ['-y', '-i', rawPath, '-t', '30', '-codec:a', 'libmp3lame', '-b:a', '192k', finalPath], { stdio: 'pipe' });
  if (trimmed.status !== 0) throw new Error(`ffmpeg failed for ${track.title}: ${trimmed.stderr.toString().slice(-500)}`);
  fs.unlinkSync(rawPath);
}

async function generateCover(track) {
  const result = await api('/v1/image_generation', { method: 'POST', body: JSON.stringify({ model: 'image-01', prompt: track.coverPrompt, aspect_ratio: '1:1', response_format: 'url', n: 1 }) });
  const data = dataObject(result);
  const imageUrl = data.image_urls?.[0] || data.image_url || result.image_url;
  if (!imageUrl) throw new Error(`${track.title} returned no cover image`);
  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error(`Cover download failed: ${response.status}`);
  await sharp(Buffer.from(await response.arrayBuffer())).resize(1024, 1024, { fit: 'cover' }).png({ quality: 92 }).toFile(path.join(outputDir, `${track.slug}.png`));
}

async function main() {
  loadEnv(envPath);
  if (!process.env.MINIMAX_API_KEY) throw new Error('MINIMAX_API_KEY is missing');
  fs.mkdirSync(outputDir, { recursive: true });
  for (const track of tracks) {
    console.log(`Generating ${track.title}...`);
    await generateAudio(track);
    await generateCover(track);
    console.log(`Completed ${track.title}`);
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
