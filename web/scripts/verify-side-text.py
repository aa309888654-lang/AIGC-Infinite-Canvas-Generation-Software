from playwright.sync_api import sync_playwright
import json

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={'width': 1680, 'height': 1050}, device_scale_factor=1)
    page = ctx.new_page()
    page.goto('http://127.0.0.1:5178/1?panel=ai-poster', wait_until='domcontentloaded')
    page.wait_for_load_state('networkidle', timeout=30000)
    page.wait_for_timeout(5000)

    # 展开"更多设置"
    try:
        page.locator('.poster-side-details-toggle').click(timeout=2000)
        page.wait_for_timeout(800)
    except Exception:
        pass

    info = page.evaluate("""() => {
        const root = document.querySelector('.ai-poster-studio-panel');
        if (!root) return null;
        const side = root.querySelector('.poster-side-details');
        if (!side) return { error: 'not found' };

        const result = [];
        side.querySelectorAll('span, label, p, button').forEach((el) => {
            const s = getComputedStyle(el);
            const tag = el.tagName.toLowerCase();
            const cls = (el.className && typeof el.className === 'string' ? el.className : '').slice(0, 60);
            const text = (el.textContent || '').trim().slice(0, 30);
            if (text) {
                result.push({
                    tag, cls, color: s.color, text,
                });
            }
        });
        return result;
    }""")

    with open('d:/7-08/frontend/scripts/_side_text_colors.json', 'w', encoding='utf-8') as f:
        json.dump(info, f, ensure_ascii=False, indent=2)

    browser.close()
print('done')
