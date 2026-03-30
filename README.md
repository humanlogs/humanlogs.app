# humanlogs.app

Fast, confidential transcription for your research interviews.

![humanlogs.app](./humanlogsappvideo.gif)

## Features

- **Accurate Transcriptions**: Get your interviews transcribed in minutes with high accuracy.
- **Fast corrections and editing**: Our intuitive editor allows you to quickly make corrections and edits to your transcripts without switching between different tools.
- **Confidentiality**: We prioritize your privacy. Your data is processed securely and is end-to-end encrypted.

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
