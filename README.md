# humanlogs.app

Fast, confidential transcription for your research interviews.

![humanlogs.app](./humanlogsappvideo.gif)

## Features

- **Super Accurate Transcription** – 100+ languages supported with best-in-class AI models. Process 2h of audio in just 10 minutes. Get started in minutes with the most accurate transcription available.

- **Fast Editing & Corrections** – Our unique editor combines audio playback and text editing to help you refine transcripts 4 times faster. Click any word to jump to that moment in the audio.

- **Collaboration** – Share your transcripts and work together on refining them. Perfect for research teams, newsrooms, and collaborative projects.

- **Privacy by Design** – Work with sensitive data confidently. End-to-end encryption ensures your transcripts never leave your computer unencrypted. You hold the keys.

- **Speaker Labels & Tools** – Automatic speaker diarization with manual labeling, renaming, merging, and removal. Apply text modifiers and organize multi-speaker conversations effortlessly.

- **Organize per Project** – Working on multiple projects? Organize your transcriptions into folders designed specifically for research workflows and team collaboration.

- **Export for the Real World** – Basic exports to PDF, Word, CSV, and TXT. Advanced exports for word analysis software, extract specific speakers, and custom formatting options.

- **Transparent & Self-Hostable** – Install Humanlogs on your own infrastructure or within your university network. Full control over your data and processing. Open source and auditable.

- **Built with Your Feedback** – We're eager to hear from you and implement your ideas. Join a community that shapes the future of transcription tools together.

## Getting Started

### Cloud version

Register for free at [humanlogs.app](https://humanlogs.app) and start transcribing your interviews today.

### Self-hosted version

1. Clone the repository:

```bash
git clone git@github.com:humanlogs/humanlogs.app.git
```

2. (optional but recommended) Edit the environment variables in the `docker-compose.yml` file to set your own credentials and configurations.

3. Run the application with docker-compose:

```bash
cd humanlogs.app
docker-compose up -d
```

It will build the Dockerfile and pull postgres.

The application will be available at `http://localhost:3000`.

### License and pricing

This project is licensed under AGPL v3 for open use.
Commercial use, SaaS offering, or resale requires a separate commercial license.
