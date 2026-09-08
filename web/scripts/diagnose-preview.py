from playwright.sync_api import sync_playwright
import json

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={'width': 1680, 'height': 1050}, device_scale_factor=1)
    page = ctx.new_page()
    page.goto('http://127.0.0.1:5178/1?panel=ai-poster', wait_until='domcontentloaded')
    page.wait_for_load_state('networkidle', timeout=30000)
    page.wait_for_timeout(5000)

    info = page.evaluate("""() => {
        const root = document.querySelector('.ai-poster-studio-panel');
        if (!root) return null;

        // 判断颜色是否在深色背景上不够亮（r+g+b < 180 算偏暗）
        const isDarkish = (rgb) => {
            const m = rgb.match(/\\d+/g);
            if (!m) return false;
            const [r, g, b] = m.map(Number);
            return r + g + b < 180;
        };

        const result = {
            assistantMsg: [],
            previewPanel: [],
        };

        // 1. AI 助手消息气泡
        root.querySelectorAll('.poster-msg-assistant, .poster-tech-msg-latest').forEach((el) => {
            const s = getComputedStyle(el);
            const text = (el.textContent || '').trim().slice(0, 40);
            result.assistantMsg.push({
                cls: (el.className || '').slice(0, 80),
                background: s.backgroundColor,
                backgroundImage: s.backgroundImage ? s.backgroundImage.slice(0, 80) : 'none',
                color: s.color,
                borderColor: s.borderColor,
                text,
            });
            // 子元素
            el.querySelectorAll('*').forEach((child) => {
                const cs = getComputedStyle(child);
                const ctext = (child.textContent || '').trim().slice(0, 30);
                if (!ctext && child.tagName.toLowerCase() !== 'svg' && !child.querySelector('svg')) return;
                const tag = child.tagName.toLowerCase();
                result.assistantMsg.push({
                    tag,
                    cls: (child.className && typeof child.className === 'string' ? child.className : '').slice(0, 80),
                    color: cs.color,
                    background: cs.backgroundColor,
                    stroke: tag === 'svg' || tag === 'path' ? cs.stroke : undefined,
                    text: ctext,
                });
            });
        });

        // 2. 海报预览面板 - 所有偏暗的元素
        const preview = root.querySelector('.serene-preview-portal-host');
        if (preview) {
            preview.querySelectorAll('*').forEach((el) => {
                const s = getComputedStyle(el);
                const color = s.color;
                const tag = el.tagName.toLowerCase();
                const text = (el.textContent || '').trim().slice(0, 30);
                const isSvg = ['svg', 'path', 'circle', 'rect', 'line', 'polyline'].includes(tag);
                const hasInlineStyle = el.hasAttribute('style');

                // 收集偏暗的文字/图标 + 内联样式元素 + SVG
                if (isDarkish(color) && (text || isSvg || ['button', 'input', 'textarea', 'label'].includes(tag))) {
                    result.previewPanel.push({
                        tag,
                        cls: (el.className && typeof el.className === 'string' ? el.className : '').slice(0, 80),
                        color,
                        stroke: isSvg ? s.stroke : undefined,
                        fill: isSvg ? s.fill : undefined,
                        background: s.backgroundColor !== 'rgba(0, 0, 0, 0)' ? s.backgroundColor : undefined,
                        inlineStyle: hasInlineStyle ? (el.getAttribute('style') || '').slice(0, 100) : undefined,
                        text,
                    });
                }
            });
        }

        return result;
    }""")

    with open('d:/7-08/frontend/scripts/_preview_issues.json', 'w', encoding='utf-8') as f:
        json.dump(info, f, ensure_ascii=False, indent=2)

    # 截图
    try:
        page.locator('.serene-preview-portal-host').screenshot(path='d:/7-08/frontend/scripts/_preview_panel.png')
    except Exception as e:
        print('screenshot failed', e)

    browser.close()
print('done')
