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
        const selects = root.querySelectorAll('select');
        return Array.from(selects).map((sel) => {
            const s = getComputedStyle(sel);
            const parent = sel.parentElement;
            const parentStyle = parent ? getComputedStyle(parent) : null;
            return {
                cls: (sel.className || '').slice(0, 80),
                disabled: sel.disabled,
                readOnly: sel.readOnly,
                pointerEvents: s.pointerEvents,
                appearance: s.appearance,
                webkitAppearance: s.webkitAppearance,
                opacity: s.opacity,
                visibility: s.visibility,
                display: s.display,
                zIndex: s.zIndex,
                position: s.position,
                size: sel.options.length,
                value: sel.value,
                parentCls: parent ? (parent.className || '').slice(0, 80) : '',
                parentPosition: parentStyle ? parentStyle.position : '',
                parentPointerEvents: parentStyle ? parentStyle.pointerEvents : '',
                parentZIndex: parentStyle ? parentStyle.zIndex : '',
                boundingRect: sel.getBoundingClientRect().toJSON(),
            };
        });
    }""")

    with open('d:/7-08/frontend/scripts/_select_state.json', 'w', encoding='utf-8') as f:
        json.dump(info, f, ensure_ascii=False, indent=2)

    browser.close()
print('done')
