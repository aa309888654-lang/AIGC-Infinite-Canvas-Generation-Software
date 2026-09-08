from playwright.sync_api import sync_playwright
import json

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={'width': 1680, 'height': 1050}, device_scale_factor=1)
    page = ctx.new_page()
    page.goto('http://127.0.0.1:5178/1?panel=ai-poster', wait_until='domcontentloaded')
    page.wait_for_load_state('networkidle', timeout=30000)
    page.wait_for_timeout(4000)

    info = page.evaluate("""() => {
        const pick = (sel) => {
            const el = document.querySelector(sel);
            if (!el) return null;
            const s = getComputedStyle(el);
            return {
                background: s.backgroundColor,
                backgroundImage: s.backgroundImage,
                color: s.color,
                borderColor: s.borderColor,
                boxShadow: s.boxShadow,
                backdrop: s.backdropFilter,
            };
        };
        return {
            studio: pick('.ai-poster-studio-panel'),
            sidenav: pick('.serene-sidenav'),
            main: pick('.serene-main'),
            workspace: pick('.serene-workspace'),
            contentPanel: pick('.serene-content-panel'),
            panelContent: pick('.serene-panel-content'),
            hero: pick('.ai-poster-assistant-hero'),
            chat: pick('.ai-poster-assistant-chat'),
            input: pick('.ai-poster-assistant-input'),
            summary: pick('.ai-poster-assistant-summary'),
            navitemActive: pick('.serene-navitem--active'),
            primaryBtn: pick('.ai-poster-assistant-input__actions button.primary'),
            scenePresets: pick('.ai-poster-scene-presets button'),
            confirmCard: pick('.ai-poster-confirm-card'),
            summaryGrid: pick('.ai-poster-summary-grid div'),
        };
    }""")
    with open('d:/7-08/frontend/scripts/_poster_colors.json', 'w', encoding='utf-8') as f:
        json.dump(info, f, ensure_ascii=False, indent=2)
    browser.close()
print('done')
