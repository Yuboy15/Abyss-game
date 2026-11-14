# ABYSS V10.7 — GitHub Pages iPad install

This is an installable PWA, not an Apple-signed native app.

1. Create a NEW **public** GitHub repository named `abyss-game` (do not use your other projects). Public GitHub Pages makes the bundled game and images publicly accessible.
2. On GitHub, open the repository and choose **Add file → Upload files**. Upload the **seven root files** from this extracted folder (index.html, sw.js, manifest.webmanifest, icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon.png). You can also upload this README. Do not upload the ZIP as one file.
3. Go to **Settings → Pages**, choose **Deploy from a branch**, set `main` and `/(root)`, and Save.
4. Open `https://YOUR-USERNAME.github.io/abyss-game/` in Safari. Share → Add to Home Screen → Open as Web App (if shown) → Add.
5. Launch it from the Home Screen icon while online, use App → Save for offline play, and wait for Ready offline. Test in Airplane Mode.

Note: Game content and adapted image assets are bundled into index.html. Publication requires that you have the right to share artwork publicly. This distribution is not a native IPA. It may not load in the Files preview.

If `index.html` is rejected as too large for the browser upload, use GitHub Desktop on a computer or a Git client; the GitHub web interface has a per-file upload size limit.
