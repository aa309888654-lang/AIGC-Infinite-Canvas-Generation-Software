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
        const h3 = root.querySelector('.poster-form-live-preview__content h3');
        if (!h3) return { error: 'h3 not found' };
        const s = getComputedStyle(h3);
        return {
            text: (h3.textContent || '').slice(0, 60),
            fontSize: s.fontSize,
            fontWeight: s.fontWeight,
            lineHeight: s.lineHeight,
            display: s.display,
            webkitLineClamp: s.webkitLineClamp,
            color: s.color,
        };
    }""")

    with open('d:/7-08/frontend/scripts/_h3_check.json', 'w', encoding='utf-8') as f:
        json.dump(info, f, ensure_ascii=False, indent=2)

    browser.close()
print('done')
