from playwright.sync_api import sync_playwright
import json

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={'width': 1680, 'height': 1050}, device_scale_factor=1)
    page = ctx.new_page()
    page.goto('http://127.0.0.1:5178/1?panel=ai-poster', wait_until='domcontentloaded')
    page.wait_for_load_state('networkidle', timeout=30000)
    page.wait_for_timeout(3000)

    # 先清理 localStorage
    page.evaluate("""() => {
        localStorage.removeItem('ai_poster_studio_brand_memory');
        localStorage.removeItem('poster_brand_kit');
    }""")

    page.reload(wait_until='domcontentloaded')
    page.wait_for_load_state('networkidle', timeout=30000)
    page.wait_for_timeout(5000)

    # 查找所有 input 并获取其值
    info = page.evaluate("""() => {
        const root = document.querySelector('.ai-poster-studio-panel');
        if (!root) return { error: 'no root' };
        const inputs = root.querySelectorAll('input, textarea');
        return Array.from(inputs).map((el) => {
            return {
                id: el.id || '',
                type: el.type || '',
                placeholder: el.placeholder || '',
                value: (el.value || '').slice(0, 40),
                ariaLabel: el.getAttribute('aria-label') || '',
            };
        });
    }""")

    with open('d:/7-08/frontend/scripts/_contact_check.json', 'w', encoding='utf-8') as f:
        json.dump(info, f, ensure_ascii=False, indent=2)

    browser.close()
print('done')
