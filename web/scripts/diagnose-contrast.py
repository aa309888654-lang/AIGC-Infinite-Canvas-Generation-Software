from playwright.sync_api import sync_playwright
import json

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={'width': 1680, 'height': 1050}, device_scale_factor=1)
    page = ctx.new_page()
    page.goto('http://127.0.0.1:5178/1?panel=ai-poster', wait_until='domcontentloaded')
    page.wait_for_load_state('networkidle', timeout=30000)
    page.wait_for_timeout(5000)

    # Find elements whose text/icon color is too dark (close to dark background)
    dark_elements = page.evaluate("""() => {
        const root = document.querySelector('.ai-poster-studio-panel');
        if (!root) return [];
        const results = [];
        const isDark = (rgb) => {
            const m = rgb.match(/\\d+/g);
            if (!m) return false;
            const [r, g, b] = m.map(Number);
            return r + g + b < 120;  // very dark color
        };
        const all = root.querySelectorAll('*');
        all.forEach((el) => {
            const s = getComputedStyle(el);
            const color = s.color;
            if (!isDark(color)) return;
            const text = (el.textContent || '').trim();
            const tag = el.tagName.toLowerCase();
            const cls = el.className && typeof el.className === 'string' ? el.className.slice(0, 60) : '';
            const hasText = text.length > 0 && text.length < 40;
            const isSvg = tag === 'svg' || tag === 'path' || tag === 'circle' || tag === 'rect' || tag === 'line';
            const hasStroke = s.stroke && s.stroke !== 'none' && s.stroke !== 'rgb(0, 0, 0)';
            if (hasText || isSvg || tag === 'button' || tag === 'input' || tag === 'textarea') {
                results.push({
                    tag,
                    cls,
                    color,
                    stroke: isSvg ? s.stroke : undefined,
                    fill: isSvg ? s.fill : undefined,
                    text: hasText ? text.slice(0, 30) : '',
                });
            }
        });
        // Deduplicate by cls+color, keep first 60
        const seen = new Set();
        return results.filter(r => {
            const key = r.cls + '|' + r.color + '|' + r.tag;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        }).slice(0, 60);
    }""")
    with open('d:/7-08/frontend/scripts/_poster_dark_elements.json', 'w', encoding='utf-8') as f:
        json.dump(dark_elements, f, ensure_ascii=False, indent=2)
    browser.close()
print('done')
