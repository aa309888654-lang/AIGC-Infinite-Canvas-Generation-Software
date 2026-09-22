// @ts-nocheck
import { EvaluatedClip } from './types';
import { normalizeCropRegion } from '../lib/crop-region';

const VERTEX_SHADER = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  
  uniform vec2 u_resolution;
  uniform vec2 u_translation;
  uniform vec2 u_scale;
  uniform float u_rotation;

  varying vec2 v_texCoord;

  void main() {
    // Pass the texCoord to the fragment shader
    v_texCoord = a_texCoord;

    // Apply scale
    vec2 scaledPosition = a_position * u_scale;

    // Apply rotation
    float s = sin(u_rotation);
    float c = cos(u_rotation);
    vec2 rotatedPosition = vec2(
      scaledPosition.x * c - scaledPosition.y * s,
      scaledPosition.x * s + scaledPosition.y * c
    );

    // Apply translation
    vec2 position = rotatedPosition + u_translation;

    // Convert from pixels to 0.0 to 1.0 (u_resolution contains actual canvas size)
    vec2 zeroToOne = position / u_resolution;

    // Convert from 0->1 to 0->2
    vec2 zeroToTwo = zeroToOne * 2.0;

    // Convert from 0->2 to -1->+1 (clipspace)
    vec2 clipSpace = zeroToTwo - 1.0;

    // flip Y
    gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
  }
`;

const FRAGMENT_SHADER = `
  precision mediump float;
  uniform vec4 u_color;
  uniform sampler2D u_texture;
  uniform bool u_use_texture;

  // Effects Uniforms
  uniform float u_blurAmount;
  uniform float u_grayscale;
  uniform float u_glitchIntensity;
  uniform float u_brightness;
  uniform float u_contrast;
  uniform float u_saturation;
  uniform vec2 u_resolution;
  uniform vec2 u_cropCenter;
  uniform vec2 u_cropSize;

  // Mask Uniforms
  uniform int u_maskType; // 0=none, 1=rect, 2=circle
  uniform vec2 u_maskCenter;
  uniform vec2 u_maskSize;
  uniform float u_maskFeather;
  uniform bool u_maskInvert;

  varying vec2 v_texCoord;

  // Simple pseudo-random function for glitch
  float rand(vec2 co) {
      return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
  }

  void main() {
    if (u_use_texture) {
      vec2 texCoord = u_cropCenter + (v_texCoord - vec2(0.5)) * u_cropSize;

      // 1. Glitch Effect
      if (u_glitchIntensity > 0.0) {
        float noise = rand(vec2(texCoord.y, u_glitchIntensity)) * 2.0 - 1.0; // -1 to 1
        // Only glitch some scanlines
        if (rand(vec2(texCoord.y, 0.0)) > 0.8) {
           texCoord.x += noise * (u_glitchIntensity / 100.0) * 0.1;
        }
      }

      vec4 texColor = texture2D(u_texture, texCoord);

      // 2. Simple Box Blur Effect (Fake Gaussian for performance)
      if (u_blurAmount > 0.0) {
        vec4 colorSum = vec4(0.0);
        float blurSize = (u_blurAmount / 100.0) * 0.02;
        int count = 0;
        for (float x = -2.0; x <= 2.0; x++) {
          for (float y = -2.0; y <= 2.0; y++) {
            vec2 offset = vec2(x, y) * blurSize;
            colorSum += texture2D(u_texture, texCoord + offset);
            count++;
          }
        }
        texColor = colorSum / float(count);
      }

      // Apply base color tint
      texColor *= u_color;

      // 3. Grayscale Effect
      if (u_grayscale > 0.0) {
        float luma = dot(texColor.rgb, vec3(0.299, 0.587, 0.114));
        vec3 gray = vec3(luma);
        texColor.rgb = mix(texColor.rgb, gray, u_grayscale / 100.0);
      }

      // 4. Brightness
      if (u_brightness != 0.0) {
        texColor.rgb = texColor.rgb + u_brightness / 100.0;
      }

      // 5. Contrast
      if (u_contrast != 0.0) {
        float factor = (100.0 + u_contrast) / 100.0;
        texColor.rgb = (texColor.rgb - 0.5) * factor + 0.5;
      }

      // 6. Saturation
      if (u_saturation != 0.0) {
        float luma = dot(texColor.rgb, vec3(0.299, 0.587, 0.114));
        vec3 gray = vec3(luma);
        float satFactor = (100.0 + u_saturation) / 100.0;
        texColor.rgb = mix(gray, texColor.rgb, satFactor);
      }

      // 7. Masking Logic (SDF)
      float maskAlpha = 1.0;
      if (u_maskType > 0) {
        vec2 p = v_texCoord; // 0.0 to 1.0
        vec2 center = u_maskCenter;
        vec2 size = u_maskSize;
        float feather = u_maskFeather + 0.0001; // Avoid div by zero

        if (u_maskType == 2) {
          // Circle Mask
          // Adjust for aspect ratio if needed, here we assume square texture coords for simplicity
          // or we can just do raw distance
          float d = length(p - center);
          float radius = size.x / 2.0; // Use width as radius
          // smoothstep(edge0, edge1, x)
          maskAlpha = 1.0 - smoothstep(radius - feather, radius, d);
        } else if (u_maskType == 1) {
          // Rectangle Mask
          vec2 d = abs(p - center) - (size / 2.0);
          float dist = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
          // SDF for rect: dist <= 0 is inside
          maskAlpha = 1.0 - smoothstep(-feather, 0.0, dist);
        }

        if (u_maskInvert) {
          maskAlpha = 1.0 - maskAlpha;
        }
        
        texColor.a *= maskAlpha;
      }

      gl_FragColor = texColor;
    } else {
      gl_FragColor = u_color;
    }
  }
`;

function createShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(gl: WebGLRenderingContext, vs: WebGLShader, fs: WebGLShader) {
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

export class WebGLRenderer {
  private gl: WebGLRenderingContext;
  private canvas: HTMLCanvasElement;
  private program: WebGLProgram | null = null;
  private positionBuffer: WebGLBuffer | null = null;
  private texCoordBuffer: WebGLBuffer | null = null;
  
  private locations: Record<string, WebGLUniformLocation | null> = {};

  private textCanvas: HTMLCanvasElement;
  private textCtx: CanvasRenderingContext2D;
  private texture: WebGLTexture | null = null;

  private videoPool: Map<string, HTMLVideoElement> = new Map();
  private videoTextures: Map<string, WebGLTexture> = new Map();

  private imagePool: Map<string, HTMLImageElement> = new Map();
  private imageTextures: Map<string, WebGLTexture> = new Map();

  private contextLost: boolean = false;
  private onContextLost: ((e: Event) => void) | null = null;
  private onContextRestored: (() => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl', { alpha: false, antialias: true, premultipliedAlpha: false });
    if (!gl) throw new Error('WebGL not supported');
    this.gl = gl;
    this.canvas = canvas;

    this.onContextLost = (e: Event) => {
      e.preventDefault();
      this.contextLost = true;
      this.program = null;
      this.positionBuffer = null;
      this.texCoordBuffer = null;
      this.texture = null;
      this.videoTextures.clear();
      this.imageTextures.clear();
      this.locations = {};
    };

    this.onContextRestored = () => {
      this.contextLost = false;
      this.initGLResources();
      this.rebuildTexturePools();
    };

    canvas.addEventListener('webglcontextlost', this.onContextLost);
    canvas.addEventListener('webglcontextrestored', this.onContextRestored);
    
    this.textCanvas = document.createElement('canvas');
    this.textCanvas.width = 1920;
    this.textCanvas.height = 1080;
    this.textCtx = this.textCanvas.getContext('2d')!;

    this.initGLResources();
  }

  private initGLResources() {
    const gl = this.gl;

    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const vs = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (vs && fs) {
      this.program = createProgram(gl, vs, fs);
    }

    if (this.program) {
      this.locations = {
        position: gl.getAttribLocation(this.program, 'a_position'),
        texCoord: gl.getAttribLocation(this.program, 'a_texCoord'),
        resolution: gl.getUniformLocation(this.program, 'u_resolution'),
        translation: gl.getUniformLocation(this.program, 'u_translation'),
        scale: gl.getUniformLocation(this.program, 'u_scale'),
        rotation: gl.getUniformLocation(this.program, 'u_rotation'),
        color: gl.getUniformLocation(this.program, 'u_color'),
        useTexture: gl.getUniformLocation(this.program, 'u_use_texture'),
        texture: gl.getUniformLocation(this.program, 'u_texture'),
        blurAmount: gl.getUniformLocation(this.program, 'u_blurAmount'),
        grayscale: gl.getUniformLocation(this.program, 'u_grayscale'),
        glitchIntensity: gl.getUniformLocation(this.program, 'u_glitchIntensity'),
        brightness: gl.getUniformLocation(this.program, 'u_brightness'),
        contrast: gl.getUniformLocation(this.program, 'u_contrast'),
        saturation: gl.getUniformLocation(this.program, 'u_saturation'),
        cropCenter: gl.getUniformLocation(this.program, 'u_cropCenter'),
        cropSize: gl.getUniformLocation(this.program, 'u_cropSize'),
        maskType: gl.getUniformLocation(this.program, 'u_maskType'),
        maskCenter: gl.getUniformLocation(this.program, 'u_maskCenter'),
        maskSize: gl.getUniformLocation(this.program, 'u_maskSize'),
        maskFeather: gl.getUniformLocation(this.program, 'u_maskFeather'),
        maskInvert: gl.getUniformLocation(this.program, 'u_maskInvert'),
      };

      this.positionBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
      const w = 1920 / 2;
      const h = 1080 / 2;
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([
          -w, -h,
           w, -h,
          -w,  h,
          -w,  h,
           w, -h,
           w,  h,
        ]),
        gl.STATIC_DRAW
      );

      this.texCoordBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([
          0.0, 0.0,
          1.0, 0.0,
          0.0, 1.0,
          0.0, 1.0,
          1.0, 0.0,
          1.0, 1.0,
        ]),
        gl.STATIC_DRAW
      );
    }
  }

  private rebuildTexturePools() {
    const gl = this.gl;

    this.videoTextures.clear();
    this.videoPool.forEach((video, sourceId) => {
      const texture = gl.createTexture();
      if (texture) {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        this.videoTextures.set(sourceId, texture);
      }
    });

    this.imageTextures.clear();
    this.imagePool.forEach((img, sourceId) => {
      const texture = gl.createTexture();
      if (texture) {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        this.imageTextures.set(sourceId, texture);

        if (img.complete && img.naturalHeight !== 0) {
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        }
      }
    });
  }

  public cleanupPool(activeSourceIds: Set<string>) {
    const gl = this.gl;

    for (const [sourceId, texture] of this.videoTextures) {
      if (!activeSourceIds.has(sourceId)) {
        gl.deleteTexture(texture);
        this.videoTextures.delete(sourceId);
        this.videoPool.delete(sourceId);
      }
    }

    for (const [sourceId, texture] of this.imageTextures) {
      if (!activeSourceIds.has(sourceId)) {
        gl.deleteTexture(texture);
        this.imageTextures.delete(sourceId);
        this.imagePool.delete(sourceId);
      }
    }
  }

  public isContextLost(): boolean {
    return this.contextLost;
  }

  private renderTextToCanvas(clip: EvaluatedClip) {
    const ctx = this.textCtx;
    ctx.clearRect(0, 0, 1920, 1080);

    // We expect the value to be wrapped in an object due to registry TS rules
    interface TextWrapper { value?: string }
    interface ColorWrapper { value?: string }
    const textData = clip.uniforms['text.content'] as TextWrapper | undefined;
    let content = textData?.value || '默认文本';

    const fontFamily = (clip.uniforms['text.fontFamily'] as string) || 'sans-serif';
    const fontSize = (clip.uniforms['text.fontSize'] as number) || 100;
    const colorObj = clip.uniforms['text.color'] as ColorWrapper | undefined;
    const color = colorObj?.value || '#ffffff';
    const strokeColorObj = clip.uniforms['text.strokeColor'] as ColorWrapper | undefined;
    const strokeColor = strokeColorObj?.value || '#000000';
    const strokeWidth = (clip.uniforms['text.strokeWidth'] as number) || 0;
    const shadowColorObj = clip.uniforms['text.shadowColor'] as ColorWrapper | undefined;
    const shadowColor = shadowColorObj?.value || '#000000';
    const shadowBlur = (clip.uniforms['text.shadowBlur'] as number) || 0;
    const bgColorObj = clip.uniforms['text.bgColor'] as ColorWrapper | undefined;
    const bgColor = bgColorObj?.value || 'transparent';

    // Typewriter / per-character stagger animation
    if (clip.uniforms['_typewriterProgress'] !== undefined) {
      const progress = clip.uniforms['_typewriterProgress'] as number;
      const charStaggerActive = clip.uniforms['_charStaggerActive'] as number;
      const charStaggerAmount = (clip.uniforms['_charStaggerAmount'] as number) || 0.05;

      if (charStaggerActive && charStaggerAmount > 0) {
        // Per-character fade: each char gets individual opacity based on its position
        const chars = content.split('');
        const staggerTime = charStaggerAmount; // seconds per character
        // Render each character with individual opacity
        ctx.font = `${fontSize}px ${fontFamily}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const x = 1920 / 2;
        const y = 1080 / 2;

        // Calculate full text metrics for positioning
        const fullMetrics = ctx.measureText(content);
        const totalWidth = fullMetrics.width;
        const startX = x - totalWidth / 2;

        // Setup shadow (per-char shadow disabled for stagger — simpler to skip)
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        let currentX = startX;
        for (let i = 0; i < chars.length; i++) {
          const charMetrics = ctx.measureText(chars[i]);
          const staggerStart = i * staggerTime;
          const charAnimationWindow = staggerTime * 4;
          const charProgress = (progress - staggerStart) / charAnimationWindow;
          const charAlpha = Math.max(0, Math.min(1, charProgress));

          if (charAlpha <= 0) {
            currentX += charMetrics.width;
            continue;
          }

          ctx.globalAlpha = charAlpha;

          const charX = currentX + charMetrics.width / 2;

          // Stroke
          if (strokeWidth > 0) {
            ctx.lineWidth = strokeWidth;
            ctx.strokeStyle = strokeColor;
            ctx.strokeText(chars[i], charX, y);
          }

          // Fill
          ctx.fillStyle = color;
          ctx.fillText(chars[i], charX, y);

          currentX += charMetrics.width;
        }
        ctx.globalAlpha = 1;

        // Upload to WebGL texture
        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, this.textCanvas);
        this.gl.uniform1i(this.locations.texture, 0);
        return; // Skip the normal render path
      } else {
        const charCount = Math.floor(content.length * progress);
        content = content.substring(0, charCount);
      }
    }

    ctx.font = `${fontSize}px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const x = 1920 / 2;
    const y = 1080 / 2;

    // Draw background box if not transparent
    if (bgColor !== 'transparent') {
      const metrics = ctx.measureText(content);
      const padding = 20;
      const bgWidth = metrics.width + padding * 2;
      const bgHeight = fontSize + padding * 2;
      
      ctx.fillStyle = bgColor;
      ctx.fillRect(x - bgWidth / 2, y - bgHeight / 2, bgWidth, bgHeight);
    }
    
    // Setup shadow
    if (shadowBlur > 0) {
      ctx.shadowColor = shadowColor;
      ctx.shadowBlur = shadowBlur;
      ctx.shadowOffsetX = shadowBlur / 4;
      ctx.shadowOffsetY = shadowBlur / 4;
    } else {
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    }
    
    // Draw Stroke
    if (strokeWidth > 0) {
      ctx.lineWidth = strokeWidth;
      ctx.strokeStyle = strokeColor;
      ctx.strokeText(content, x, y);
    }
    
    // Draw Text Fill
    ctx.fillStyle = color;
    ctx.fillText(content, x, y);

    // Upload to WebGL texture
    this.gl.activeTexture(this.gl.TEXTURE0);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, this.textCanvas);
    this.gl.uniform1i(this.locations.texture, 0);
  }

  private renderShapeToCanvas(clip: EvaluatedClip) {
    const ctx = this.textCtx;
    ctx.clearRect(0, 0, 1920, 1080);

    // Get shape parameters
    interface ColorWrapper { value?: string }
    const shapeType = (clip.uniforms['shape.type'] as string) || 'rectangle';
    const fillColorObj = clip.uniforms['shape.fillColor'] as ColorWrapper | undefined;
    const fillColor = fillColorObj?.value || '#ffffff';
    const strokeColorObj = clip.uniforms['shape.strokeColor'] as ColorWrapper | undefined;
    const strokeColor = strokeColorObj?.value || '#000000';
    const strokeWidth = (clip.uniforms['shape.strokeWidth'] as number) || 0;
    const cornerRadius = (clip.uniforms['shape.cornerRadius'] as number) || 0;

    const centerX = 1920 / 2;
    const centerY = 1080 / 2;
    const defaultWidth = 400;
    const defaultHeight = 300;

    ctx.save();
    ctx.translate(centerX, centerY);

    // Draw shape
    ctx.beginPath();
    switch (shapeType) {
      case 'rectangle':
        if (cornerRadius > 0) {
          const r = Math.min(cornerRadius, defaultWidth / 2, defaultHeight / 2);
          ctx.moveTo(-defaultWidth / 2 + r, -defaultHeight / 2);
          ctx.lineTo(defaultWidth / 2 - r, -defaultHeight / 2);
          ctx.quadraticCurveTo(defaultWidth / 2, -defaultHeight / 2, defaultWidth / 2, -defaultHeight / 2 + r);
          ctx.lineTo(defaultWidth / 2, defaultHeight / 2 - r);
          ctx.quadraticCurveTo(defaultWidth / 2, defaultHeight / 2, defaultWidth / 2 - r, defaultHeight / 2);
          ctx.lineTo(-defaultWidth / 2 + r, defaultHeight / 2);
          ctx.quadraticCurveTo(-defaultWidth / 2, defaultHeight / 2, -defaultWidth / 2, defaultHeight / 2 - r);
          ctx.lineTo(-defaultWidth / 2, -defaultHeight / 2 + r);
          ctx.quadraticCurveTo(-defaultWidth / 2, -defaultHeight / 2, -defaultWidth / 2 + r, -defaultHeight / 2);
        } else {
          ctx.rect(-defaultWidth / 2, -defaultHeight / 2, defaultWidth, defaultHeight);
        }
        break;
      case 'circle':
        ctx.arc(0, 0, Math.min(defaultWidth, defaultHeight) / 2, 0, Math.PI * 2);
        break;
      case 'ellipse':
        ctx.ellipse(0, 0, defaultWidth / 2, defaultHeight / 2, 0, 0, Math.PI * 2);
        break;
      case 'triangle':
        ctx.moveTo(0, -defaultHeight / 2);
        ctx.lineTo(defaultWidth / 2, defaultHeight / 2);
        ctx.lineTo(-defaultWidth / 2, defaultHeight / 2);
        ctx.closePath();
        break;
      default:
        ctx.rect(-defaultWidth / 2, -defaultHeight / 2, defaultWidth, defaultHeight);
    }

    // Fill
    ctx.fillStyle = fillColor;
    ctx.fill();

    // Stroke
    if (strokeWidth > 0) {
      ctx.lineWidth = strokeWidth;
      ctx.strokeStyle = strokeColor;
      ctx.stroke();
    }

    ctx.restore();

    // Upload to WebGL texture
    this.gl.activeTexture(this.gl.TEXTURE0);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, this.textCanvas);
    this.gl.uniform1i(this.locations.texture, 0);
  }

  private getVideoElement(sourceId: string, url: string): HTMLVideoElement {
    if (this.videoPool.has(sourceId)) {
      return this.videoPool.get(sourceId)!;
    }
    
    const video = document.createElement('video');
    video.src = url;
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.playsInline = true;
    video.loop = false;
    
    this.videoPool.set(sourceId, video);
    
    const texture = this.gl.createTexture();
    if (texture) {
      this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
      this.videoTextures.set(sourceId, texture);
    }
    
    return video;
  }

  private getImageElement(sourceId: string, url: string): HTMLImageElement {
    if (this.imagePool.has(sourceId)) {
      return this.imagePool.get(sourceId)!;
    }
    
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    const texture = this.gl.createTexture();
    if (texture) {
      this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
      // Initialize with 1x1 transparent pixel
      this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, 1, 1, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
      this.imageTextures.set(sourceId, texture);
      
      img.onload = () => {
        this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, img);
      };
    }
    
    img.src = url;
    this.imagePool.set(sourceId, img);
    
    return img;
  }

  public render(clips: EvaluatedClip[]) {
    if (this.contextLost) return;

    const gl = this.gl;
    
    // Clear screen to black
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clearColor(0.05, 0.05, 0.05, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (!this.program) return;
    gl.useProgram(this.program);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.enableVertexAttribArray(this.locations.position as number);
    gl.vertexAttribPointer(this.locations.position as number, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.enableVertexAttribArray(this.locations.texCoord as number);
    gl.vertexAttribPointer(this.locations.texCoord as number, 2, gl.FLOAT, false, 0, 0);

    // Look for transition layer
    const transitionClip = clips.find(c => c.kind === 'transition');
    const hasTransition = !!transitionClip;
    let transitionProgress = 0;
    if (hasTransition) {
      transitionProgress = (transitionClip.uniforms['transition.progress'] as number) / 100;
    }

    // Render each clip
    clips.forEach(clip => {
      // Don't render the transition layer itself, it modifies the rendering of others
      if (clip.kind === 'transition') return;

      // 1. Transform with safe constraints to prevent black edge exposure
      let tx = (clip.uniforms['transform.posX'] as number) || 0;
      let ty = (clip.uniforms['transform.posY'] as number) || 0;
      let scalePct = (clip.uniforms['transform.scale'] as number) ?? 100;
      const rotDeg = (clip.uniforms['transform.rotate'] as number) || 0;
      let opacity = (clip.uniforms['transform.opacity'] as number) ?? 100;

      // Apply safe constraints: max zoom 1.15x, pan within 95% canvas area
      const MAX_SCALE = 115; // 1.15x max zoom
      const SAFE_MARGIN = 0.05; // 5% margin
      scalePct = Math.min(scalePct, MAX_SCALE);
      
      // Constrain translation to prevent black edges
      const maxTx = gl.canvas.width * (1 - SAFE_MARGIN) / 2;
      const maxTy = gl.canvas.height * (1 - SAFE_MARGIN) / 2;
      tx = Math.max(-maxTx, Math.min(maxTx, tx));
      ty = Math.max(-maxTy, Math.min(maxTy, ty));
      
      if (hasTransition) {
        const videoClips = clips.filter(c => c.kind === 'video' || c.kind === 'image');
        const clipIndex = videoClips.indexOf(clip);
        if (clipIndex === 0) {
          opacity = opacity * (1 - transitionProgress);
        } else if (clipIndex === videoClips.length - 1 && videoClips.length > 1) {
          opacity = opacity * transitionProgress;
        }
      }
      const blendMode = (clip.uniforms['transform.blendMode'] as string) || 'normal';
      
      // 1.5 Blend Modes
      if (blendMode === 'multiply') {
        gl.blendFunc(gl.DST_COLOR, gl.ONE_MINUS_SRC_ALPHA);
      } else if (blendMode === 'screen') {
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_COLOR);
      } else if (blendMode === 'overlay') {
        // Simplified overlay mockup
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      } else {
        // Normal alpha blending
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      }
      
      // 2. Base Color (mock based on kind)
      let r = 0.5, g = 0.5, b = 0.5;
      let useTexture = false;

      if (clip.kind === 'video' || clip.kind === 'image' || clip.kind === 'sticker') { 
        r=1.0; g=1.0; b=1.0; 
        
        const sourceUrl = clip.uniforms['_sourceUrl'] as string;
        const sourceId = clip.uniforms['_sourceId'] as string;
        const localTime = clip.uniforms['_localTime'] as number;
        
        if (sourceUrl && sourceId) {
          useTexture = true;
          
          if (clip.kind === 'video') {
            const video = this.getVideoElement(sourceId, sourceUrl);
            // Sync time if needed (rough approach, in real app needs careful scheduling)
            if (Math.abs(video.currentTime - localTime) > 0.1) {
              video.currentTime = localTime;
            }
            
            const isPlaying = clip.uniforms['_isPlaying'] as boolean;
            if (isPlaying && video.paused) {
              video.play().catch(e => console.warn('Autoplay prevented', e));
            } else if (!isPlaying && !video.paused) {
              video.pause();
            }

            // Upload video frame to texture
            if (video.readyState >= 2) {
              const tex = this.videoTextures.get(sourceId);
              if (tex) {
                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, tex);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
                gl.uniform1i(this.locations.texture, 0);
              }
            }
          } else if (clip.kind === 'sticker' || clip.kind === 'image') {
            // Static Image / Sticker rendering
            const img = this.getImageElement(sourceId, sourceUrl);
            const tex = this.imageTextures.get(sourceId);
            if (tex && img.complete && img.naturalHeight !== 0) {
              gl.activeTexture(gl.TEXTURE0);
              gl.bindTexture(gl.TEXTURE_2D, tex);
              gl.uniform1i(this.locations.texture, 0);
            } else {
              useTexture = false;
            }
          }
        } else {
          // Fallback if no source
          r=0.2; g=0.6; b=1.0; 
        }
      }
      else if (clip.kind === 'text') { 
        r=1.0; g=1.0; b=1.0; 
        useTexture = true;
        this.renderTextToCanvas(clip);
      }
      else if (clip.kind === 'shape') { 
        r=1.0; g=1.0; b=1.0; 
        useTexture = true;
        this.renderShapeToCanvas(clip);
      }
      
      const brightness = (clip.uniforms['color.brightness'] as number) || 0;
      const contrast = (clip.uniforms['color.contrast'] as number) || 0;
      const saturation = (clip.uniforms['color.saturation'] as number) || 0;
      const cropRegion = normalizeCropRegion(clip.uniforms['crop.region']);

      // Extract Effect Parameters
      const blurAmount = (clip.uniforms['effect.blur'] as number) || 0;
      const grayscale = (clip.uniforms['effect.grayscale'] as number) || 0;
      const glitchIntensity = (clip.uniforms['effect.glitch'] as number) || 0;

      // Extract Mask Parameters
      const maskTypeStr = (clip.uniforms['mask.type'] as string) || 'none';
      let maskType = 0;
      if (maskTypeStr === 'rectangle') maskType = 1;
      if (maskTypeStr === 'circle') maskType = 2;
      
      const maskCenterX = ((clip.uniforms['mask.position.x'] as number) ?? 50) / 100;
      const maskCenterY = ((clip.uniforms['mask.position.y'] as number) ?? 50) / 100;
      const maskWidth = ((clip.uniforms['mask.size.width'] as number) ?? 50) / 100;
      const maskHeight = ((clip.uniforms['mask.size.height'] as number) ?? 50) / 100;
      const maskFeather = ((clip.uniforms['mask.feather'] as number) ?? 0) / 100;
      const maskInvert = (clip.uniforms['mask.invert'] as boolean) || false;

      // Pass uniforms
      gl.uniform2f(this.locations.resolution, gl.canvas.width, gl.canvas.height);
      // For position, use coordinates centered at 0,0
      gl.uniform2f(this.locations.translation, gl.canvas.width/2 + tx, gl.canvas.height/2 - ty);
      gl.uniform2f(this.locations.scale, scalePct / 100, scalePct / 100);
      gl.uniform1f(this.locations.rotation, rotDeg * Math.PI / 180);
      gl.uniform4f(this.locations.color, r, g, b, opacity / 100);
      gl.uniform1i(this.locations.useTexture, useTexture ? 1 : 0);
      gl.uniform1f(this.locations.blurAmount, blurAmount);
      gl.uniform1f(this.locations.grayscale, grayscale);
      gl.uniform1f(this.locations.glitchIntensity, glitchIntensity);
      gl.uniform1f(this.locations.brightness, brightness);
      gl.uniform1f(this.locations.contrast, contrast);
      gl.uniform1f(this.locations.saturation, saturation);
      gl.uniform2f(this.locations.cropCenter, cropRegion.x, cropRegion.y);
      gl.uniform2f(this.locations.cropSize, cropRegion.width, cropRegion.height);

      // Pass mask uniforms
      gl.uniform1i(this.locations.maskType, maskType);
      gl.uniform2f(this.locations.maskCenter, maskCenterX, maskCenterY);
      gl.uniform2f(this.locations.maskSize, maskWidth, maskHeight);
      gl.uniform1f(this.locations.maskFeather, maskFeather);
      gl.uniform1i(this.locations.maskInvert, maskInvert ? 1 : 0);

      // Draw
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    });
  }

  public destroy() {
    if (this.onContextLost) {
      this.canvas.removeEventListener('webglcontextlost', this.onContextLost);
    }
    if (this.onContextRestored) {
      this.canvas.removeEventListener('webglcontextrestored', this.onContextRestored);
    }

    this.videoPool.forEach((video) => {
      video.pause();
      video.src = '';
    });
    this.videoPool.clear();

    this.imagePool.clear();

    this.videoTextures.forEach((texture) => this.gl.deleteTexture(texture));
    this.videoTextures.clear();

    this.imageTextures.forEach((texture) => this.gl.deleteTexture(texture));
    this.imageTextures.clear();

    if (this.texture) this.gl.deleteTexture(this.texture);
    if (this.program) this.gl.deleteProgram(this.program);
    if (this.positionBuffer) this.gl.deleteBuffer(this.positionBuffer);
    if (this.texCoordBuffer) this.gl.deleteBuffer(this.texCoordBuffer);
  }
}
