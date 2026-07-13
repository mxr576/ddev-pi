#!/usr/bin/env bash
#ddev-generated
set -euo pipefail

# Create the interceptor script
cat <<'EOF' > /usr/local/bin/clipboard-interceptor
#!/usr/bin/env bash
# Read stdin, write atomically to shared volume
cat > /var/www/html/.ddev/.clipboard_pending.tmp
mv /var/www/html/.ddev/.clipboard_pending.tmp /var/www/html/.ddev/.clipboard_pending
exit 0
EOF

chmod +x /usr/local/bin/clipboard-interceptor

# Symlink xclip, xsel, wl-copy to the interceptor
ln -sf /usr/local/bin/clipboard-interceptor /usr/local/bin/xclip
ln -sf /usr/local/bin/clipboard-interceptor /usr/local/bin/xsel
ln -sf /usr/local/bin/clipboard-interceptor /usr/local/bin/wl-copy

echo "[build.d] Clipboard interceptors installed successfully."
