from playwright.sync_api import sync_playwright
import json

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={'width': 1680, 'height': 1050}, device_scale_factor=1)
    page = ctx.new_page()
    page.goto('http://127.0.0.1:5178/1?panel=ai-poster', wait_until='domcontentloaded')
    page.wait_for_load_state('networkidle', timeout=30000)
    page.wait_for_timeout(5000)

    # 点击"换模板"按钮尝试打开模板选择面板
    try:
        page.locator('.poster-form-template-bar__switch').click(timeout=3000)
        page.wait_for_timeout(2000)
    except Exception as e:
        print(f'click switch failed: {e}')

    info = page.evaluate("""() => {
        const root = document.querySelector('.ai-poster-studio-panel');
        if (!root) return { error: 'no root' };

        const isLight = (rgb) => {
            const m = rgb.match(/\\d+/g);
            if (!m) return false;
            const [r, g, b] = m.map(Number);
            return r + g + b > 360;
        };

        // 查找可能的模板选择面板
        const templatePanels = root.querySelectorAll('[class*="template"], [class*="picker"], [class*="gallery"], [class*="selector"], [class*="modal"], [class*="dialog"], [class*="popover"], [class*="dropdown"]');
        const result = [];
        templatePanels.forEach((el) => {
            const s = getComputedStyle(el);
            const cs_bg = s.backgroundColor;
            const cs_color = s.color;
            const rect = el.getBoundingClientRect();
            // 只收集可见且尺寸合理的元素
            if (rect.width > 100 && rect.height > 100) {
                const text = (el.textContent || '').trim().slice(0, 60);
                result.push({
                    tag: el.tagName.toLowerCase(),
                    cls: (el.className || '').toString().slice(0, 80),
                    background: cs_bg,
                    color: cs_color,
                    display: s.display,
                    visibility: s.visibility,
                    width: rect.width,
                    height: rect.height,
                    text,
                    isLightBg: isLight(cs_bg),
                    isLightText: isLight(cs_color),
                });
            }
        });
        return result;
    }""")

    with open('d:/7-08/frontend/scripts/_template_panels.json', 'w', encoding='utf-8') as f:
        json.dump(info, f, ensure_ascii=False, indent=2)

    browser.close()
print('done')
