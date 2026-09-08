from playwright.sync_api import sync_playwright
import json

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={'width': 1680, 'height': 1050}, device_scale_factor=1)
    page = ctx.new_page()
    page.goto('http://127.0.0.1:5178/1?panel=ai-poster', wait_until='domcontentloaded')
    page.wait_for_load_state('networkidle', timeout=30000)
    page.wait_for_timeout(5000)

    # 点击"换模板"按钮
    try:
        page.locator('.poster-form-template-bar__switch').click(timeout=3000)
        page.wait_for_timeout(2000)
    except Exception:
        pass

    info = page.evaluate("""() => {
        const root = document.querySelector('.ai-poster-studio-panel');
        if (!root) return { error: 'no root' };

        const zone = root.querySelector('.poster-template-zone');
        if (!zone) return { error: 'no template zone' };

        const isLight = (rgb) => {
            const m = rgb.match(/\\d+/g);
            if (!m) return false;
            const [r, g, b] = m.map(Number);
            return r + g + b > 360;
        };
        const isWhitish = (rgb) => {
            const m = rgb.match(/\\d+/g);
            if (!m) return false;
            const [r, g, b] = m.map(Number);
            return r > 200 && g > 200 && b > 200;
        };
        const isDark = (rgb) => {
            const m = rgb.match(/\\d+/g);
            if (!m) return false;
            const [r, g, b] = m.map(Number);
            return r + g + b < 120;
        };

        const result = {
            zone: {},
            lightBg: [],
            darkText: [],
            allText: [],
        };

        // 容器信息
        const zs = getComputedStyle(zone);
        result.zone = {
            background: zs.backgroundColor,
            backgroundImage: zs.backgroundImage ? zs.backgroundImage.slice(0, 60) : 'none',
            color: zs.color,
            borderColor: zs.borderColor,
        };

        // 扫描所有子元素
        zone.querySelectorAll('*').forEach((el) => {
            const s = getComputedStyle(el);
            const bg = s.backgroundColor;
            const color = s.color;
            const tag = el.tagName.toLowerCase();
            const cls = (el.className && typeof el.className === 'string' ? el.className : '').slice(0, 60);
            const text = (el.textContent || '').trim().slice(0, 30);

            // 浅色背景元素
            if (bg && bg !== 'rgba(0, 0, 0, 0)' && isLight(bg)) {
                result.lightBg.push({
                    tag, cls, background: bg, color, text,
                });
            }

            // 深色文字元素
            if (isDark(color) && text) {
                result.darkText.push({
                    tag, cls, color, background: bg !== 'rgba(0, 0, 0, 0)' ? bg : undefined, text,
                });
            }

            // 所有有文字的元素
            if (text && ['p', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'label', 'button', 'div', 'li'].includes(tag)) {
                result.allText.push({
                    tag, cls: cls.slice(0, 40), color, text: text.slice(0, 20),
                });
            }
        });

        return result;
    }""")

    with open('d:/7-08/frontend/scripts/_template_zone_detail.json', 'w', encoding='utf-8') as f:
        json.dump(info, f, ensure_ascii=False, indent=2)

    browser.close()
print('done')
