set -euxo pipefail

install_dir="$HOME/bin"
unit="[Unit]
Description=AOE Taunt Bot

[Service]
ExecStart=$install_dir/aoe-taunt-bot

[Install]
WantedBy=default.target"

# 1. install systemd unit
mkdir -p ~/.config/systemd/user
echo -e "$unit" > .config/systemd/user/aoe-taunt-bot.service

# 2. let systemd allow us to run long running services at boot
sudo loginctl enable-linger $USER

# 3. enable and start the bot service 
systemctl --user enable aoe-taunt-bot.service
systemctl --user start aoe-taunt-bot.service

# 4. see logs
journalctl --user -u aoe-taunt-bot.service
