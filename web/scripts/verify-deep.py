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
        const pick = (sel) => {
            const el = document.querySelector(sel);
            if (!el) return null;
            const s = getComputedStyle(el);
            return {
                background: s.backgroundColor,
                backgroundImage: s.backgroundImage ? s.backgroundImage.slice(0, 80) : 'none',
                color: s.color,
                borderColor: s.borderColor,
            };
        };
        return {
            studio: pick('.ai-poster-studio-panel'),
            sidenav: pick('.serene-sidenav'),
            main: pick('.serene-main'),
            contentPanel: pick('.serene-content-panel'),
            hero: pick('.ai-poster-assistant-hero'),
            chat: pick('.ai-poster-assistant-chat'),
            input: pick('.ai-poster-assistant-input'),
            summary: pick('.ai-poster-assistant-summary'),
            navitemActive: pick('.serene-navitem--active'),
            primaryBtn: pick('.ai-poster-assistant-input__actions button.primary'),
            scenePresets: pick('.ai-poster-scene-presets button'),
            brandH1: pick('.serene-brand h1'),
            chatBubble: pick('.ai-poster-chat-bubble'),
            summaryGrid: pick('.ai-poster-summary-grid div'),
            categoryBtn: pick('.serene-category-btn'),
        };
    }""")
    with open('d:/7-08/frontend/scripts/_poster_colors_after.json', 'w', encoding='utf-8') as f:
        json.dump(info, f, ensure_ascii=False, indent=2)
    page.screenshot(path='d:/7-08/frontend/scripts/_poster_after.png', full_page=False)
    browser.close()
print('done')
