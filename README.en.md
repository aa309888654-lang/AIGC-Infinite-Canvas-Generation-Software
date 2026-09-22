# 小天画布 · AIGC Infinite Canvas

> **Open Source · Free for Personal Commercial Use · Licensed for Enterprise Commercial Use** · A pure-frontend AI creative workbench

[![GitHub](https://img.shields.io/badge/GitHub-aa309888654--lang%2FAIGC--Infinite--Canvas--Generation--Software-blue?logo=github)](https://github.com/aa309888654-lang/AIGC-Infinite-Canvas-Generation-Software)
[![License: Source-Available](https://img.shields.io/badge/license-Source--Available-orange)](#-license)

A one-stop AI creation platform: **AI image · AI video · AI voice-over · AI music · storyboard · character design**. Local-first, started in one command.

> 🔄 **This repository is updated continuously**: new features, new model adapters and fixes land on `main` at irregular intervals, with no fixed release cadence. Watch the repo or follow the commit history to keep up; tag a commit yourself if you need a stable snapshot.

> 📖 中文文档：[README.md](./README.md)  ·  📘 **Full product guide (with 11 demo images)**：[`docs/INTRODUCTION.md`](./docs/INTRODUCTION.md)

---

## 🎨 At a Glance

<table>
  <tr>
    <td align="center" width="50%">
      <b>4K High-Resolution Image Sample</b><br/>
      <img src="docs/images/hanfu_4k_beauty.png" alt="4K Hanfu sample" width="100%"/>
    </td>
    <td align="center" width="50%">
      <b>AI Voice-over + AI Music</b><br/>
      <img src="docs/images/2.png" alt="AI Voice-over and Music" width="100%"/>
    </td>
  </tr>
  <tr>
    <td align="center" width="50%">
      <b>Advanced Image Workflow</b><br/>
      <img src="docs/images/3.png" alt="Advanced image generation" width="100%"/>
    </td>
    <td align="center" width="50%">
      <b>Storyboard / Shot Drawing (4-step pipeline)</b><br/>
      <img src="docs/images/storyboard-ui.png" alt="Storyboard UI" width="100%"/>
    </td>
  </tr>
  <tr>
    <td align="center" width="50%">
      <b>AI Image (text/image/reference/style/mark)</b><br/>
      <img src="docs/images/ai-image-ui.png" alt="AI image UI" width="100%"/>
    </td>
    <td align="center" width="50%">
      <b>AI Video (text/image/first-last frame/camera)</b><br/>
      <img src="docs/images/ai-video-ui.png" alt="AI video UI" width="100%"/>
    </td>
  </tr>
</table>

More screenshots & samples (4K/2K Hanfu themes, character design sheets, storyboard panels) in [`docs/INTRODUCTION.md`](./docs/INTRODUCTION.md).

---

## ✨ Features

- **AI Image Generation** — text-to-image, image-to-image, reference, style transfer, random seed, mark control, multi-image reference
- **AI Video Generation** — text-to-video, image-to-video, first-last frame, first-frame, camera/action/light control
- **AI Voice-over + AI Music** — multiple voices, diverse styles, sound effects mixing
- **Storyboard / Shot Drawing** — 4-step pipeline, 3/6/9/12 panel layouts, shot size/camera move/emotion/director notes
- **Character Design / Asset Sheets** — standard views, expression set, action poses, details, color palette, material references
- **Infinite Canvas** — node-based free composition

---

## 🚀 Quick Start

Requires Node.js >= 18

```bash
# 1. Clone
git clone https://github.com/aa309888654-lang/AIGC-Infinite-Canvas-Generation-Software.git
cd AIGC-Infinite-Canvas-Generation-Software

# 2. Install dependencies
npm install

# 3. Start dev server
npm run dev

# 4. Open your browser
# Visit http://localhost:5178
```

For full deployment and API key setup, see [`docs/INTRODUCTION.md`](./docs/INTRODUCTION.md) and [`server/README.md`](./server/README.md).

---

## 🔧 Tech Stack

- **Frontend**: React 19 + Vite + TypeScript + Tailwind CSS
- **Backend (optional)**: Node.js + Express + Prisma + SQLite/PostgreSQL
- **AI Model Adapters**: Doubao Seedream / SenseNova / StepFun / Agnes / MiniMax / DeepSeek / Zhipu GLM / Vidu / NVIDIA NIM / OpenAI-compatible
- **Infinite Canvas**: React Flow / Konva.js / Fabric.js
- **Optional Desktop Clients**: Electron / Tauri

---

## 📄 License

This project uses a **Source-Available commercial license** (see [`LICENSE`](./LICENSE) and [`LICENSE-COMMERCIAL.md`](./LICENSE-COMMERCIAL.md)):

| Use case | Status |
|---|---|
| Personal learning, research, personal creation | ✅ Free |
| Personal / non-corporate commercial use (publish, monetize, fork) | ✅ **Free for personal commercial use** |
| Companies, enterprises, studios, institutions providing SaaS / products / services | ⚠️ **Written commercial license required** |

---

## 💖 Sponsorship

If you find this project useful, feel free to support ongoing development ✨

> In the app, click the ❤️ button in the top toolbar, or open `Settings → Sponsorship` to see the QR code (preset amounts: ¥1 candy / ¥5 tea / ¥10 coffee / ¥20 short film).

The sponsor QR code `qrcode.webp` is open-sourced at the repo root.

---

## 📚 Documentation

| Document | Content |
|---|---|
| [`README.md`](./README.md) | This file's Chinese version (project entry) |
| [`README.en.md`](./README.en.md) | English version (this file) |
| [`docs/产品介绍.md`](./docs/产品介绍.md) | Chinese product guide (with 11 demo images) |
| [`docs/INTRODUCTION.md`](./docs/INTRODUCTION.md) | English product guide (with 11 demo images) |
| [`LICENSE`](./LICENSE) | GitHub-recognized license file |
| [`LICENSE-COMMERCIAL.md`](./LICENSE-COMMERCIAL.md) | Detailed commercial license terms |
| [`server/README.md`](./server/README.md) | Backend service docs |

---

## 🙏 Acknowledgments

Thanks to all model providers, third-party dependencies, and open-source contributors.

---

## 🧩 Build From Source & Security

- **This repository is the full source**: `src/` (frontend), `server/` (backend) and `public/` (runtime assets) are readable source code, with no variable obfuscation, string hiding, compression or source maps.
- **No sensitive content**: no real API keys, tokens, databases, logs, `node_modules`, build output or user uploads are included.
- **Build**: run `npm install` then `npm run build` at the repo root; for the backend, `cd server && npm install && npx prisma generate && npx tsc`.
- **Keys stay server-side**: copy `server/.env.example` to `server/.env` and fill in `DATABASE_URL`, model API keys, `JWT_SECRET`, and a 32-byte random `ENCRYPTION_KEY` (64 hex characters). Never commit real keys.
- **Release verification**: see [`docs/REPO_MAINTENANCE.md`](./docs/REPO_MAINTENANCE.md). Demo recordings over 100 MiB are pruned from the release pack; rerun `node scripts/publish-github-release.cjs` and cross-check the `PUBLISH_MANIFEST.json` file manifest.
- **Third-party licenses**: `LICENSE` and `LICENSE-COMMERCIAL.md` define this project's terms; licenses of models, assets, fonts and npm dependencies remain the deployer's responsibility.
