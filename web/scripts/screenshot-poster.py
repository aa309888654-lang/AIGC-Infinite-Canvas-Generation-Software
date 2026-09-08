from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={'width': 1680, 'height': 1050}, device_scale_factor=1)
    page = ctx.new_page()
    page.goto('http://127.0.0.1:5178/1?panel=ai-poster', wait_until='domcontentloaded')
    page.wait_for_load_state('networkidle', timeout=30000)
    page.wait_for_timeout(4000)
    page.screenshot(path='d:/7-08/frontend/scripts/_poster_current.png', full_page=False)
    # Dump a focused subset: search for poster studio root
    try:
        info = page.evaluate("""() => {
            const root = document.querySelector('.ai-poster-studio-panel, .serene-poster-studio, [class*="poster-studio"]');
            const bodyBg = getComputedStyle(document.body).backgroundColor;
            const rootBg = root ? getComputedStyle(root).backgroundColor : null;
            const sample = document.querySelector('.ai-poster-assistant-hero, .serene-content-panel, .serene-brand');
            const sampleStyle = sample ? {
              background: getComputedStyle(sample).backgroundColor,
              color: getComputedStyle(sample).color,
              boxShadow: getComputedStyle(sample).boxShadow,
              borderColor: getComputedStyle(sample).borderColor,
              className: sample.className,
            } : null;
            return { bodyBg, rootBg, rootClass: root ? root.className : null, sampleStyle, rootHtml: root ? root.outerHTML.slice(0, 2500) : null };
        }""")
        import json
        with open('d:/7-08/frontend/scripts/_poster_info.json', 'w', encoding='utf-8') as f:
            json.dump(info, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print('eval failed', e)
    browser.close()
print('done')
