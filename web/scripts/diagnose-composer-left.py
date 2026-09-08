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
        const left = root.querySelector('.serene-composer-left');
        if (!left) return { error: 'serene-composer-left not found' };

        const cs = getComputedStyle(left);
        const containerInfo = {
            background: cs.backgroundColor,
            backgroundImage: cs.backgroundImage ? cs.backgroundImage.slice(0, 60) : 'none',
            border: cs.border,
            borderRadius: cs.borderRadius,
            padding: cs.padding,
            boxShadow: cs.boxShadow !== 'none' ? cs.boxShadow.slice(0, 60) : 'none',
            display: cs.display,
            gap: cs.gap,
        };

        const buttons = [];
        left.querySelectorAll(':scope > button, :scope > div').forEach((el) => {
            const s = getComputedStyle(el);
            const tag = el.tagName.toLowerCase();
            const cls = (el.className && typeof el.className === 'string' ? el.className : '').slice(0, 60);
            buttons.push({
                tag,
                cls,
                background: s.backgroundColor,
                backgroundImage: s.backgroundImage !== 'none' ? s.backgroundImage.slice(0, 40) : 'none',
                border: s.border.slice(0, 60),
                borderRadius: s.borderRadius,
                boxShadow: s.boxShadow !== 'none' ? s.boxShadow.slice(0, 40) : 'none',
                padding: s.padding,
                margin: s.margin,
            });
        });

        return { container: containerInfo, buttons };
    }""")

    with open('d:/7-08/frontend/scripts/_composer_left.json', 'w', encoding='utf-8') as f:
        json.dump(info, f, ensure_ascii=False, indent=2)

    browser.close()
print('done')
