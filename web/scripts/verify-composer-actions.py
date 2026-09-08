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
        const actions = root.querySelector('.serene-composer-actions');
        if (!actions) return { error: 'serene-composer-actions not found' };

        const actionStyle = getComputedStyle(actions);
        const result = {
            container: {
                border: actionStyle.border,
                borderWidth: actionStyle.borderWidth,
                borderColor: actionStyle.borderColor,
                boxShadow: actionStyle.boxShadow,
            },
            buttons: [],
            svgs: [],
        };

        // 所有按钮
        actions.querySelectorAll('button').forEach((btn) => {
            const s = getComputedStyle(btn);
            result.buttons.push({
                cls: (btn.className || '').slice(0, 60),
                border: s.border,
                borderWidth: s.borderWidth,
                borderColor: s.borderColor,
                boxShadow: s.boxShadow,
                color: s.color,
            });
        });

        // 所有 SVG
        actions.querySelectorAll('svg').forEach((svg) => {
            const s = getComputedStyle(svg);
            result.svgs.push({
                color: s.color,
                stroke: s.stroke,
            });
        });

        // 所有 path / circle / rect / line
        const paths = [];
        actions.querySelectorAll('path, circle, rect, line').forEach((el) => {
            const s = getComputedStyle(el);
            paths.push({
                tag: el.tagName.toLowerCase(),
                stroke: s.stroke,
                fill: s.fill,
            });
        });
        result.paths = paths.slice(0, 20);

        return result;
    }""")

    with open('d:/7-08/frontend/scripts/_composer_actions.json', 'w', encoding='utf-8') as f:
        json.dump(info, f, ensure_ascii=False, indent=2)

    # 截图操作栏区域
    try:
        actions = page.locator('.serene-composer-actions')
        if actions.count() > 0:
            actions.screenshot(path='d:/7-08/frontend/scripts/_composer_actions.png')
    except Exception as e:
        print('screenshot failed', e)

    browser.close()
print('done')
