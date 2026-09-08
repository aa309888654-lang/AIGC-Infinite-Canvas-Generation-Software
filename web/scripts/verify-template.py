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

        const isLight = (rgb) => {
            const m = rgb.match(/\\d+/g);
            if (!m) return false;
            const [r, g, b] = m.map(Number);
            return r + g + b > 360;
        };

        const result = { zone: null, cards: [], chips: [], issues: [] };

        const zone = root.querySelector('.poster-template-zone');
        if (zone) {
            const zs = getComputedStyle(zone);
            result.zone = {
                background: zs.backgroundColor,
                color: zs.color,
                isLightBg: isLight(zs.backgroundColor),
            };
            if (isLight(zs.backgroundColor)) {
                result.issues.push('zone background still light');
            }
        }

        const cards = root.querySelectorAll('.poster-template-card');
        cards.forEach((c, i) => {
            const s = getComputedStyle(c);
            result.cards.push({
                idx: i,
                background: s.backgroundColor,
                color: s.color,
                isLightBg: isLight(s.backgroundColor),
            });
            if (isLight(s.backgroundColor)) {
                result.issues.push(`card ${i} bg still light: ${s.backgroundColor}`);
            }
        });

        const chips = root.querySelectorAll('.poster-template-color-chip');
        chips.forEach((c, i) => {
            const s = getComputedStyle(c);
            result.chips.push({
                idx: i,
                background: s.backgroundColor,
                color: s.color,
                isLightBg: isLight(s.backgroundColor),
            });
            if (isLight(s.backgroundColor)) {
                result.issues.push(`chip ${i} bg still light: ${s.backgroundColor}`);
            }
        });

        return result;
    }""")

    with open('d:/7-08/frontend/scripts/_template_verify.json', 'w', encoding='utf-8') as f:
        json.dump(info, f, ensure_ascii=False, indent=2)

    browser.close()
print('done')
