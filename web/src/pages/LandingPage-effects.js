/**
 * LandingPage 鼠标交互效果
 * 基于 ai-business-homepage 风格设计
 */

(function() {
  'use strict';

  // 等待 DOM 加载完成
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEffects);
  } else {
    initEffects();
  }

  function initEffects() {
    // 只在 LandingPage 页面生效
    const landingPage = document.querySelector('.landing-page') || 
                       document.querySelector('[data-page="landing"]') ||
                       document.body;
    
    if (!landingPage) return;

    // 创建鼠标跟随光晕
    createCursorGlow();
    
    // 创建背景光晕
    createBackgroundGlows();
    
    // 创建底部波浪
    createWaves();
    
    // 绑定鼠标事件
    bindMouseEvents();
    
    // 绑定按钮效果
    bindButtonEffects();
  }

  // 创建鼠标跟随光晕
  function createCursorGlow() {
    const existingGlow = document.getElementById('cursor-glow');
    if (existingGlow) return;

    const glow = document.createElement('div');
    glow.id = 'cursor-glow';
    glow.className = 'cursor-glow';
    glow.style.cssText = `
      position: fixed;
      width: 400px;
      height: 400px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(0, 212, 170, 0.15) 0%, transparent 70%);
      filter: blur(60px);
      pointer-events: none;
      z-index: 9999;
      transform: translate(-50%, -50%);
      transition: opacity 0.3s ease;
      opacity: 0;
    `;
    document.body.appendChild(glow);
  }

  // 创建背景光晕
  function createBackgroundGlows() {
    const landingPage = document.querySelector('.landing-page') || document.body;
    
    // 检查是否已存在
    if (landingPage.querySelector('.hero-glow')) return;

    const glow1 = document.createElement('div');
    glow1.className = 'hero-glow hero-glow--primary';
    glow1.style.cssText = `
      position: fixed;
      width: 600px;
      height: 600px;
      border-radius: 50%;
      background: radial-gradient(circle, #00d4aa 0%, transparent 70%);
      filter: blur(100px);
      opacity: 0.3;
      pointer-events: none;
      z-index: 0;
      top: -200px;
      right: 20%;
      animation: pulse-glow 8s ease-in-out infinite;
    `;

    const glow2 = document.createElement('div');
    glow2.className = 'hero-glow hero-glow--secondary';
    glow2.style.cssText = `
      position: fixed;
      width: 400px;
      height: 400px;
      border-radius: 50%;
      background: radial-gradient(circle, #7c3aed 0%, transparent 70%);
      filter: blur(100px);
      opacity: 0.3;
      pointer-events: none;
      z-index: 0;
      bottom: 20%;
      left: -100px;
      animation: pulse-glow 10s ease-in-out infinite reverse;
    `;

    landingPage.appendChild(glow1);
    landingPage.appendChild(glow2);

    // 添加动画关键帧
    if (!document.getElementById('glow-animations')) {
      const style = document.createElement('style');
      style.id = 'glow-animations';
      style.textContent = `
        @keyframes pulse-glow {
          0%, 100% {
            transform: scale(1);
            opacity: 0.3;
          }
          50% {
            transform: scale(1.1);
            opacity: 0.5;
          }
        }
      `;
      document.head.appendChild(style);
    }
  }

  // 创建底部波浪
  function createWaves() {
    const landingPage = document.querySelector('.landing-page') || document.body;
    
    // 检查是否已存在
    if (landingPage.querySelector('.waves-container')) return;

    const wavesContainer = document.createElement('div');
    wavesContainer.className = 'waves-container';
    wavesContainer.style.cssText = `
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      height: 300px;
      overflow: hidden;
      z-index: 1;
      pointer-events: none;
    `;

    const waveColors = [
      { color: '00d4aa', opacity: '0.1', duration: '20s' },
      { color: '00a8e8', opacity: '0.15', duration: '15s' },
      { color: '7c3aed', opacity: '0.1', duration: '25s' }
    ];

    waveColors.forEach((wave, index) => {
      const waveDiv = document.createElement('div');
      waveDiv.className = 'wave';
      waveDiv.style.cssText = `
        position: absolute;
        bottom: ${index * 10}px;
        left: 0;
        width: 200%;
        height: 100%;
        background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1440 320'%3E%3Cpath fill='%23${wave.color}' fill-opacity='${wave.opacity}' d='M0,192L48,197.3C96,203,192,213,288,229.3C384,245,480,267,576,250.7C672,235,768,181,864,181.3C960,181,1056,235,1152,234.7C1248,235,1344,181,1392,154.7L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z'%3E%3C/path%3E%3C/svg%3E") repeat-x;
        background-size: 50% 100%;
        animation: wave-animation ${wave.duration} linear infinite ${index % 2 === 1 ? 'reverse' : ''};
        opacity: ${1 - index * 0.2};
      `;
      wavesContainer.appendChild(waveDiv);
    });

    landingPage.appendChild(wavesContainer);

    // 添加波浪动画
    if (!document.getElementById('wave-animations')) {
      const style = document.createElement('style');
      style.id = 'wave-animations';
      style.textContent = `
        @keyframes wave-animation {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
      `;
      document.head.appendChild(style);
    }
  }

  // 绑定鼠标事件
  function bindMouseEvents() {
    const cursorGlow = document.getElementById('cursor-glow');
    const glow1 = document.querySelector('.hero-glow--primary');
    const glow2 = document.querySelector('.hero-glow--secondary');
    const heroContent = document.querySelector('.hero-content') || 
                       document.querySelector('.hero-section') ||
                       document.querySelector('h1')?.parentElement;

    let rafId = null;
    let mouseX = 0;
    let mouseY = 0;

    document.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;

      if (rafId) return;

      rafId = requestAnimationFrame(() => {
        // 更新光标光晕位置
        if (cursorGlow) {
          cursorGlow.style.left = mouseX + 'px';
          cursorGlow.style.top = mouseY + 'px';
          cursorGlow.style.opacity = '1';
        }

        // 计算视差效果
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        const moveX = (mouseX - centerX) / centerX;
        const moveY = (mouseY - centerY) / centerY;

        // 应用视差效果到内容
        if (heroContent) {
          heroContent.style.transform = `translate(${moveX * 10}px, ${moveY * 10}px)`;
          heroContent.style.transition = 'transform 0.1s ease-out';
        }

        // 背景光晕反向移动
        if (glow1) {
          glow1.style.transform = `translate(${-moveX * 30}px, ${-moveY * 30}px) scale(1)`;
        }
        if (glow2) {
          glow2.style.transform = `translate(${-moveX * 20}px, ${-moveY * 20}px) scale(1)`;
        }

        rafId = null;
      });
    }, { passive: true });

    // 鼠标离开页面
    document.addEventListener('mouseleave', () => {
      if (cursorGlow) {
        cursorGlow.style.opacity = '0';
      }
    });

    // 鼠标进入页面
    document.addEventListener('mouseenter', () => {
      if (cursorGlow) {
        cursorGlow.style.opacity = '1';
      }
    });
  }

  // 绑定按钮效果
  function bindButtonEffects() {
    // 为所有按钮添加波纹效果
    document.querySelectorAll('button, .cta-button, [class*="cta"]').forEach(button => {
      button.addEventListener('click', function(e) {
        // 检查是否已有波纹
        if (this.querySelector('.ripple')) return;

        const ripple = document.createElement('span');
        ripple.className = 'ripple';
        
        const rect = this.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = e.clientX - rect.left - size / 2;
        const y = e.clientY - rect.top - size / 2;

        ripple.style.cssText = `
          position: absolute;
          width: ${size}px;
          height: ${size}px;
          left: ${x}px;
          top: ${y}px;
          background: rgba(255, 255, 255, 0.4);
          border-radius: 50%;
          transform: scale(0);
          animation: ripple-effect 0.6s ease-out;
          pointer-events: none;
        `;

        this.style.position = 'relative';
        this.style.overflow = 'hidden';
        this.appendChild(ripple);

        setTimeout(() => ripple.remove(), 600);
      });
    });

    // 添加波纹动画
    if (!document.getElementById('ripple-animation')) {
      const style = document.createElement('style');
      style.id = 'ripple-animation';
      style.textContent = `
        @keyframes ripple-effect {
          to {
            transform: scale(2);
            opacity: 0;
          }
        }
      `;
      document.head.appendChild(style);
    }

    // 导航链接悬停效果
    document.querySelectorAll('nav a, .nav-link, header a').forEach(link => {
      link.addEventListener('mouseenter', function() {
        this.style.transform = 'translateY(-2px)';
        this.style.transition = 'transform 0.3s ease';
      });
      
      link.addEventListener('mouseleave', function() {
        this.style.transform = 'translateY(0)';
      });
    });
  }

  // 滚动视差效果
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        const scrolled = window.pageYOffset;
        const waves = document.querySelectorAll('.wave');
        
        waves.forEach((wave, index) => {
          const speed = 0.5 + (index * 0.2);
          wave.style.transform = `translateX(${-scrolled * speed}px)`;
        });
        
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });

})();
