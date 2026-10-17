#!/usr/bin/env sh
# Cria o atalho do VARISPEED no menu de aplicativos (~/.local/share/applications).
set -eu
ROOT="$(cd "$(dirname "$0")" && pwd)"
TARGET="${XDG_DATA_HOME:-$HOME/.local/share}/applications/VARISPEED.desktop"
mkdir -p "$(dirname "$TARGET")"
cat > "$TARGET" <<DESKTOP
[Desktop Entry]
Version=1.0
Type=Application
Name=VARISPEED
Comment=Editor de velocidade e tom de áudio
Exec="$ROOT/VARISPEED.sh"
Path=$ROOT
Icon=$ROOT/assets/favicon.png
Terminal=false
Categories=AudioVideo;Audio;AudioVideoEditing;
Keywords=audio;music;musica;velocidade;pitch;varispeed;
StartupNotify=false
DESKTOP
chmod +x "$TARGET" "$ROOT/VARISPEED.sh"
echo "Atalho criado: $TARGET"
