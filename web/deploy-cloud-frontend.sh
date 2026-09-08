#!/bin/bash
set -e

echo "=== 1. 备份当前前端 ==="
TS=$(date +%Y%m%d-%H%M%S)
BK=/home/aicgxt-data/deploy-backups/frontend-dist-$TS
mkdir -p "$BK"
# 只备份关键代码文件（不备份大素材目录）
cp -a /var/www/aicgxt/assets "$BK/assets" 2>/dev/null || true
cp /var/www/aicgxt/index.html "$BK/index.html" 2>/dev/null || true
cp /var/www/aicgxt/admin.html "$BK/admin.html" 2>/dev/null || true
cp /var/www/aicgxt/manifest.webmanifest "$BK/manifest.webmanifest" 2>/dev/null || true
cp /var/www/aicgxt/sw.js "$BK/sw.js" 2>/dev/null || true
cp /var/www/aicgxt/robots.txt "$BK/robots.txt" 2>/dev/null || true
echo "备份到: $BK"
ls "$BK" | head

echo "=== 2. 解压新前端 dist 到临时目录 ==="
rm -rf /tmp/deploy-20260720/dist_new
mkdir -p /tmp/deploy-20260720/dist_new
tar -xzf /tmp/deploy-20260720/dist.tar.gz -C /tmp/deploy-20260720/dist_new --strip-components=1
echo "解压完成，顶层文件:"
ls /tmp/deploy-20260720/dist_new/ | head -20

echo "=== 3. 同步 assets 目录（构建产物） ==="
rm -rf /var/www/aicgxt/assets_old 2>/dev/null || true
mv /var/www/aicgxt/assets /var/www/aicgxt/assets_old
cp -a /tmp/deploy-20260720/dist_new/assets /var/www/aicgxt/assets
rm -rf /var/www/aicgxt/assets_old
echo "assets 同步完成"

echo "=== 4. 同步顶层文件（html/js/txt/ico/webp 等小文件） ==="
cd /tmp/deploy-20260720/dist_new
for item in *.html *.html.gz *.txt *.ico *.webp *.png *.jpg *.mp4 *.webmanifest sw.js manifest.webmanifest; do
  [ -e "$item" ] && cp -f "$item" /var/www/aicgxt/ 2>/dev/null || true
done

echo "=== 5. 同步小目录（不含 models/workflow-marketplace/sample-videos 大目录） ==="
for dir in fonts brand templates showcase-images sponsor aetheria-extra-gallery digital-human-backgrounds digital-humans gallery inspiration ai-models; do
  if [ -d "/tmp/deploy-20260720/dist_new/$dir" ]; then
    rm -rf "/var/www/aicgxt/${dir}_old" 2>/dev/null || true
    mv "/var/www/aicgxt/$dir" "/var/www/aicgxt/${dir}_old" 2>/dev/null || true
    cp -a "/tmp/deploy-20260720/dist_new/$dir" "/var/www/aicgxt/$dir"
    rm -rf "/var/www/aicgxt/${dir}_old"
    echo "  同步 $dir 完成"
  fi
done

echo "=== 6. 设置权限 ==="
chown -R www-data:www-data /var/www/aicgxt/assets
chown -R www-data:www-data /var/www/aicgxt/*.html
chown -R www-data:www-data /var/www/aicgxt/assets 2>/dev/null || true
find /var/www/aicgxt -maxdepth 1 -type f -exec chown www-data:www-data {} \; 2>/dev/null || true

echo "=== 7. 验证关键文件 ==="
ls -la /var/www/aicgxt/index.html
ls -la /var/www/aicgxt/admin.html
ls /var/www/aicgxt/assets/ | head -5
echo "assets 目录大小:"
du -sh /var/www/aicgxt/assets/

echo "=== 8. 重载 nginx ==="
nginx -t 2>&1
systemctl reload nginx
echo "nginx 重载完成"

echo "=== 前端部署完成 ==="
