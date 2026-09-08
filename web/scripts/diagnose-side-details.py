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
        const side = root.querySelector('.poster-side-details');
        if (!side) return { error: 'poster-side-details not found' };

        const isLight = (rgb) => {
            const m = rgb.match(/\\d+/g);
            if (!m) return false;
            const [r, g, b] = m.map(Number);
            return r + g + b > 360;  // 偏亮
        };

        const result = {
            container: {},
            light: [],
        };

        const cs = getComputedStyle(side);
        result.container = {
            background: cs.backgroundColor,
            backgroundImage: cs.backgroundImage ? cs.backgroundImage.slice(0, 60) : 'none',
            color: cs.color,
            borderColor: cs.borderColor,
        };

        side.querySelectorAll('*').forEach((el) => {
            const s = getComputedStyle(el);
            const color = s.color;
            const bg = s.backgroundColor;
            const tag = el.tagName.toLowerCase();
            const cls = (el.className && typeof el.className === 'string' ? el.className : '').slice(0, 80);
            const text = (el.textContent || '').trim().slice(0, 30);

            // 收集偏亮的文字/背景元素
            if (isLight(color) || (bg && bg !== 'rgba(0, 0, 0, 0)' && isLight(bg))) {
                if (text || ['button', 'input', 'select', 'textarea', 'label', 'option'].includes(tag)) {
                    result.light.push({
                        tag,
                        cls,
                        color,
                        background: bg !== 'rgba(0, 0, 0, 0)' ? bg : undefined,
                        text,
                    });
                }
            }
        });

        return result;
    }""")

    with open('d:/7-08/frontend/scripts/_side_details.json', 'w', encoding='utf-8') as f:
        json.dump(info, f, ensure_ascii=False, indent=2)

    try:
        page.locator('.poster-side-details').screenshot(path='d:/7-08/frontend/scripts/_side_details.png')
    except Exception as e:
        print('screenshot failed', e)

    browser.close()
print('done')
