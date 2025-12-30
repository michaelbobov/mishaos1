# MishaOS - Retro Operating System Portfolio

A nostalgic retro operating system interface built with HTML, CSS, and JavaScript. Experience the look and feel of classic Windows systems from the 1990s.

## Features

- Retro desktop environment with Program Manager
- Classic applications (Minesweeper, Solitaire, SkiFree, Doom)
- Quill AI assistant with multiple modes
- VHS player for music playback
- Multiple year themes (1985, 1992, 1995, 1998, 2000, 2001)

## Deployment on Vercel

This project is configured to work with Vercel serverless functions for secure API key handling.

### Setup Instructions

1. **Install Vercel CLI** (if not already installed):
   ```bash
   npm i -g vercel
   ```

2. **Deploy to Vercel**:
   ```bash
   vercel
   ```

3. **Set Environment Variable**:
   - Go to your Vercel project dashboard
   - Navigate to Settings → Environment Variables
   - Add a new variable:
     - **Name**: `OPENAI_API_KEY`
     - **Value**: Your OpenAI API key (starts with `sk-`)
     - **Environment**: Production, Preview, Development (select all)

4. **Redeploy** (if needed):
   ```bash
   vercel --prod
   ```

### How It Works

- The frontend makes API calls to `/api/openai` (a Vercel serverless function)
- The serverless function (`api/openai.js`) securely handles the OpenAI API key
- Users don't need to enter their own API keys - they use yours securely

### File Structure

```
├── api/
│   └── openai.js          # Vercel serverless function (API proxy)
├── assets/                 # Images and icons
├── sounds/                 # Audio files
├── index.html              # Main HTML file
├── script.js               # Main JavaScript
└── styles.css              # Styles
```

### Local Development

To run locally:

```bash
# Using Node.js http-server
npx http-server -p 8000

# Or using Python
python -m http.server 8000
```

Note: The API proxy will only work when deployed to Vercel. For local development, you'll need to set up a local proxy or modify the code temporarily.

## License

MIT
