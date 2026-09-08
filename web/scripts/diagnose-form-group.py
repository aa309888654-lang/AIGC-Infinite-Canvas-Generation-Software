from playwright.sync_api import sync_playwright
import json

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={'width': 1680, 'height': 1050}, device_scale_factor=1)
    page = ctx.new_page()
    page.goto('http://127.0.0.1:5178/1?panel=ai-poster', wait_until='domcontentloaded')
    page.wait_for_load_state('networkidle', timeout=30000)
    page.wait_for_timeout(5000)

    # 尝试点击"更多设置"展开 side-details
    try:
        page.locator('.poster-side-details-toggle').click(timeout=2000)
        page.wait_for_timeout(800)
    except Exception:
        pass

    info = page.evaluate("""() => {
        const root = document.querySelector('.ai-poster-studio-panel');
        if (!root) return null;

        const isLight = (rgb) => {
            const m = rgb.match(/\\d+/g);
            if (!m) return false;
            const [r, g, b] = m.map(Number);
            return r + g + b > 360;
        };
        const isWhitish = (rgb) => {
            const m = rgb.match(/\\d+/g);
            if (!m) return false;
            const [r, g, b] = m.map(Number);
            return r > 200 && g > 200 && b > 200;
        };

        const result = {
            formGroup: { container: {}, light: [] },
            sideDetails: { container: {}, light: [] },
            inputs: [],
        };

        // 1. poster-form-field-group
        const formGroup = root.querySelector('.poster-form-field-group');
        if (formGroup) {
            const cs = getComputedStyle(formGroup);
            result.formGroup.container = {
                background: cs.backgroundColor,
                color: cs.color,
            };
            formGroup.querySelectorAll('*').forEach((el) => {
                const s = getComputedStyle(el);
                const color = s.color;
                const bg = s.backgroundColor;
                const tag = el.tagName.toLowerCase();
                const cls = (el.className && typeof el.className === 'string' ? el.className : '').slice(0, 80);
                const text = (el.textContent || '').trim().slice(0, 30);
                if ((isLight(color) || (bg && bg !== 'rgba(0, 0, 0, 0)' && isLight(bg))) && (text || ['button', 'input', 'select', 'textarea', 'label', 'option'].includes(tag))) {
                    result.formGroup.light.push({
                        tag, cls, color,
                        background: bg !== 'rgba(0, 0, 0, 0)' ? bg : undefined,
                        text,
                    });
                }
            });
        }

        // 2. poster-side-details
        const side = root.querySelector('.poster-side-details');
        if (side) {
            const cs = getComputedStyle(side);
            result.sideDetails.container = {
                background: cs.backgroundColor,
                color: cs.color,
            };
            side.querySelectorAll('*').forEach((el) => {
                const s = getComputedStyle(el);
                const color = s.color;
                const bg = s.backgroundColor;
                const tag = el.tagName.toLowerCase();
                const cls = (el.className && typeof el.className === 'string' ? el.className : '').slice(0, 80);
                const text = (el.textContent || '').trim().slice(0, 30);
                if ((isLight(color) || (bg && bg !== 'rgba(0, 0, 0, 0)' && isLight(bg))) && (text || ['button', 'input', 'select', 'textarea', 'label', 'option'].includes(tag))) {
                    result.sideDetails.light.push({
                        tag, cls, color,
                        background: bg !== 'rgba(0, 0, 0, 0)' ? bg : undefined,
                        text,
                    });
                }
            });
        } else {
            result.sideDetails.error = 'not found';
        }

        // 3. 所有 input/select/textarea 的实际颜色
        root.querySelectorAll('input, select, textarea').forEach((el) => {
            const s = getComputedStyle(el);
            const cls = (el.className && typeof el.className === 'string' ? el.className : '').slice(0, 80);
            result.inputs.push({
                tag: el.tagName.toLowerCase(),
                cls,
                background: s.backgroundColor,
                color: s.color,
                placeholder: el.placeholder || '',
                value: (el.value || '').slice(0, 20),
            });
        });

        return result;
    }""")

    with open('d:/7-08/frontend/scripts/_form_group_issues.json', 'w', encoding='utf-8') as f:
        json.dump(info, f, ensure_ascii=False, indent=2)

    browser.close()
print('done')
