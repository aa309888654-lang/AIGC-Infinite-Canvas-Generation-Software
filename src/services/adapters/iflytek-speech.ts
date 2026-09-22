/**
 * 科大讯飞(iFlytek) 语音识别与语音合成适配器
 * 语音听写(iat): wss://iat-api.xf-yun.com/v2/iat
 * 在线语音合成(tts): wss://tts-api.xf-yun.com/v2/tts
 */

// ===== WebSocket 鉴权签名 =====

async function generateAuthUrl(
  appId: string,
  apiKey: string,
  apiSecret: string,
  host: string,
  path: string
): Promise<string> {
  const date = new Date().toUTCString();
  const signatureOrigin = `host: "${host}"\ndate: ${date}\nGET ${path} HTTP/1.1`;

  const encoder = new TextEncoder();
  const keyData = encoder.encode(apiSecret);
  const messageData = encoder.encode(signatureOrigin);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)));

  const authorizationOrigin = `api_key="${apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signatureB64}"`;
  const authorization = btoa(authorizationOrigin);

  return `wss://${host}${path}?authorization=${encodeURIComponent(authorization)}&date=${encodeURIComponent(date)}&host=${encodeURIComponent(host)}`;
}

// ===== 语音听写 (iat) =====

export interface IATOptions {
  language?: string;      // 语种: zh_cn, en_us 等
  domain?: string;        // 领域: iat(普通话), medical 等
  accent?: string;        // 方言
  ptt?: number;           // 标点: 1(添加), 0(不添加)
}

export interface IATResult {
  text: string;
  isEnd: boolean;
}

export class iFlytekIAT {
  private appId: string;
  private apiKey: string;
  private apiSecret: string;
  private ws: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private stream: MediaStream | null = null;
  private onResult: (result: IATResult) => void;
  private onError: (error: string) => void;
  private isRecording = false;

  constructor(
    appId: string,
    apiKey: string,
    apiSecret: string,
    onResult: (result: IATResult) => void,
    onError: (error: string) => void
  ) {
    this.appId = appId;
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.onResult = onResult;
    this.onError = onError;
  }

  async start(options: IATOptions = {}) {
    if (this.isRecording) return;
    this.isRecording = true;

    try {
      // 1. 获取麦克风
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // 2. 建立 WebSocket
      const wsUrl = await generateAuthUrl(
        this.appId,
        this.apiKey,
        this.apiSecret,
        'iat-api.xf-yun.com',
        '/v2/iat'
      );
      this.ws = new WebSocket(wsUrl);

      await new Promise<void>((resolve, reject) => {
        if (!this.ws) return reject('WebSocket 未创建');

        this.ws!.onopen = () => {
          // 发送第一帧
          this.sendFirstFrame(options);
          resolve();
        };
        this.ws!.onerror = (e) => reject('WebSocket 连接失败');
        this.ws!.onmessage = (e) => this.handleMessage(e.data);
      });

      // 3. 初始化音频处理
      this.audioContext = new AudioContext({ sampleRate: 16000 });
      this.source = this.audioContext.createMediaStreamSource(this.stream);
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

      this.processor.onaudioprocess = (e) => {
        if (!this.isRecording || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const pcmData = floatTo16BitPCM(inputData);
        const base64Audio = arrayBufferToBase64(new Uint8Array(pcmData).buffer);

        const frame = {
          data: { audio: base64Audio, status: 1, format: 'audio/L16;rate=16000', encoding: 'raw' },
        };
        this.ws.send(JSON.stringify(frame));
      };

      this.source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);
    } catch (error) {
      this.isRecording = false;
      this.onError(error instanceof Error ? error.message : String(error));
    }
  }

  stop() {
    this.isRecording = false;

    // 发送结束帧
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const endFrame = {
        data: { status: 2, audio: '', format: 'audio/L16;rate=16000', encoding: 'raw' },
      };
      this.ws.send(JSON.stringify(endFrame));
      setTimeout(() => this.close(), 500);
    } else {
      this.close();
    }
  }

  private sendFirstFrame(options: IATOptions) {
    if (!this.ws) return;
    const frame = {
      common: { app_id: this.appId },
      business: {
        language: options.language || 'zh_cn',
        domain: options.domain || 'iat',
        accent: options.accent || 'mandarin',
        ptt: options.ptt ?? 1,
        vinfo: 1,
      },
      data: { status: 0, format: 'audio/L16;rate=16000', encoding: 'raw', audio: '' },
    };
    this.ws.send(JSON.stringify(frame));
  }

  private handleMessage(data: string) {
    try {
      const result = JSON.parse(data);
      if (result.code !== 0) {
        this.onError(result.message || '识别错误');
        return;
      }

      const ws = result.data;
      if (!ws) return;

      let text = '';
      const isEnd = ws.status === 2;

      if (ws.result) {
        const rt = ws.result.ws || [];
        for (const item of rt) {
          const cw = item.cw || [];
          for (const w of cw) {
            text += w.w;
          }
        }
      }

      if (text || isEnd) {
        this.onResult({ text, isEnd });
      }

      if (isEnd) {
        setTimeout(() => this.close(), 100);
      }
    } catch {
      // ignore parse error
    }
  }

  private close() {
    if (this.ws) {
      try { this.ws.close(); } catch { /* noop */ }
      this.ws = null;
    }
    if (this.processor) {
      try { this.processor.disconnect(); } catch { /* noop */ }
      this.processor = null;
    }
    if (this.source) {
      try { this.source.disconnect(); } catch { /* noop */ }
      this.source = null;
    }
    if (this.audioContext) {
      try { this.audioContext.close(); } catch { /* noop */ }
      this.audioContext = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    this.isRecording = false;
  }
}

// ===== 在线语音合成 (tts) =====

export interface TTSOptions {
  vcn?: string;        // 发音人
  speed?: number;      // 语速: 0-100
  volume?: number;     // 音量: 0-100
  pitch?: number;      // 音调: 0-100
  bgs?: number;        // 合成音频的背景音: 0(无), 1(有)
}

export class iFlytekTTS {
  private appId: string;
  private apiKey: string;
  private apiSecret: string;

  constructor(appId: string, apiKey: string, apiSecret: string) {
    this.appId = appId;
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
  }

  async synthesize(text: string, options: TTSOptions = {}): Promise<string> {
    const wsUrl = await generateAuthUrl(
      this.appId,
      this.apiKey,
      this.apiSecret,
      'tts-api.xf-yun.com',
      '/v2/tts'
    );

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      const audioChunks: Uint8Array[] = [];
      let hasError = false;

      ws.onopen = () => {
        const frame = {
          common: { app_id: this.appId },
          business: {
            aue: 'lame',
            sfl: 1,
            auf: 'audio/L16;rate=16000',
            vcn: options.vcn || 'xiaoyan',
            speed: options.speed ?? 50,
            volume: options.volume ?? 50,
            pitch: options.pitch ?? 50,
            bgs: options.bgs ?? 0,
            tte: 'UTF8',
          },
          data: { status: 2, text: btoa(unescape(encodeURIComponent(text))) },
        };
        ws.send(JSON.stringify(frame));
      };

      ws.onmessage = (e) => {
        const response = JSON.parse(e.data);
        if (response.code !== 0) {
          hasError = true;
          reject(response.message || '合成失败');
          ws.close();
          return;
        }

        if (response.data && response.data.audio) {
          const chunk = base64ToUint8Array(response.data.audio);
          audioChunks.push(chunk);
        }

        if (response.data && response.data.status === 2) {
          ws.close();
        }
      };

      ws.onerror = () => {
        hasError = true;
        reject('TTS WebSocket 连接失败');
      };

      ws.onclose = () => {
        if (!hasError) {
          if (audioChunks.length === 0) {
            reject('未收到音频数据');
            return;
          }
          const totalLength = audioChunks.reduce((sum, c) => sum + c.length, 0);
          const merged = new Uint8Array(totalLength);
          let offset = 0;
          for (const chunk of audioChunks) {
            merged.set(chunk, offset);
            offset += chunk.length;
          }
          const blob = new Blob([merged], { type: 'audio/mpeg' });
          resolve(URL.createObjectURL(blob));
        }
      };
    });
  }
}

// ===== 工具函数 =====

function floatTo16BitPCM(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return output;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
