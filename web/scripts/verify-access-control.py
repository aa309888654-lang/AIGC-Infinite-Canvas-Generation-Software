import json
import os
from pathlib import Path

from playwright.sync_api import sync_playwright


token = os.environ.get("PW_ADMIN_TOKEN", "")
if not token:
    raise RuntimeError("PW_ADMIN_TOKEN is required")

artifacts = Path(__file__).resolve().parents[1] / "test-artifacts"
artifacts.mkdir(exist_ok=True)

console_errors = []
page_errors = []
api_statuses = []

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 1000}, device_scale_factor=1)
    serialized_token = json.dumps(token)
    page.add_init_script(
        f"""
        (() => {{
          const adminToken = {serialized_token};
          localStorage.setItem('admin_token_v1', adminToken);
          localStorage.setItem('authToken', adminToken);
        }})();
        """
    )
    page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
    page.on("pageerror", lambda error: page_errors.append(str(error)))
    page.on(
        "response",
        lambda response: api_statuses.append({"url": response.url, "status": response.status})
        if "/api/v1/admin/access-control/" in response.url
        else None,
    )

    page.goto("http://127.0.0.1:5178/admin.html#system-ops", wait_until="networkidle")
    page.get_by_role("button", name="访问管控").wait_for(state="visible", timeout=20_000)
    page.get_by_text("自动访问策略", exact=True).wait_for(state="visible", timeout=20_000)
    page.get_by_text("IP 访问排行", exact=True).wait_for(state="visible")
    page.get_by_text("用户访问排行", exact=True).wait_for(state="visible")

    ip_limit = page.get_by_label("IP 每秒阈值").input_value()
    user_limit = page.get_by_label("用户每秒阈值").input_value()
    desktop_overflow = page.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth")
    page.screenshot(path=str(artifacts / "access-control-desktop.png"), full_page=True)

    page.get_by_role("button", name="封 IP", exact=True).click()
    page.get_by_role("dialog").wait_for(state="visible")
    dialog_visible = page.get_by_text("IPv4 / IPv6 地址", exact=True).is_visible()
    page.get_by_role("button", name="关闭").click()

    page.set_viewport_size({"width": 390, "height": 844})
    page.wait_for_timeout(500)
    mobile_overflow = page.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth")
    page.screenshot(path=str(artifacts / "access-control-mobile.png"), full_page=True)

    browser.close()

result = {
    "apiStatuses": api_statuses,
    "ipLimit": ip_limit,
    "userLimit": user_limit,
    "dialogVisible": dialog_visible,
    "desktopOverflow": desktop_overflow,
    "mobileOverflow": mobile_overflow,
    "consoleErrors": console_errors,
    "pageErrors": page_errors,
}
print(json.dumps(result, ensure_ascii=False))

if not api_statuses or any(item["status"] != 200 for item in api_statuses):
    raise SystemExit("Access-control API did not return 200")
if ip_limit != "20" or user_limit != "20":
    raise SystemExit("Default per-second limits are not 20")
if not dialog_visible or desktop_overflow or mobile_overflow or page_errors:
    raise SystemExit("Access-control UI verification failed")
