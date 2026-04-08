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

## Transcription Providers

Humanlogs supports two Speech-to-Text (STT) providers that you can choose between:

### Option 1: ElevenLabs (Cloud-based)

ElevenLabs provides high-quality cloud-based transcription with advanced features.

**Features:**

- ✅ Speaker diarization (automatic speaker detection)
- ✅ Custom vocabulary
- ✅ Multi-channel audio support
- ✅ 100+ languages
- ✅ Up to 500MB file size
- ✅ No local setup required

**Configuration:**

Set these environment variables in your `docker-compose.yml` or `.env` file:

```bash
STT_PROVIDER=elevenlabs
ELEVENLABS_API_KEY=your_api_key_here
ELEVENLABS_CAN_DISABLE_STORAGE=false
```

Get your API key from [ElevenLabs](https://elevenlabs.io).

### Option 2: Whisper (Local/Self-hosted)

OpenAI's Whisper is a powerful open-source speech recognition model that runs locally. Multiple implementations are available.

**Architecture Note:** Whisper is available as a Python library or C++ implementation. To integrate with this Node.js application, we use an API wrapper/server that exposes Whisper through an HTTP API.

**Features:**

- ✅ Fully local processing (privacy-first)
- ✅ No API costs
- ✅ Multiple model sizes (tiny, base, small, medium, large)
- ✅ 100+ languages
- ✅ Word-level timestamps
- ❌ Speaker diarization (not a Whisper feature - requires separate tool like pyannote)
- ❌ Custom vocabulary (not supported by Whisper)
- ⚠️ File size limits depend on your server configuration

**Installation & Setup:**

#### Option A: whisper.cpp (Recommended - Fastest)

[whisper.cpp](https://github.com/ggml-org/whisper.cpp) is a high-performance C++ implementation with built-in server mode:

```bash
# Clone and build whisper.cpp
git clone https://github.com/ggml-org/whisper.cpp.git
cd whisper.cpp
make

# Download a model (e.g., base model)
bash ./models/download-ggml-model.sh base

# Run the server
./server -m models/ggml-base.bin --port 9000
```

With Docker:

```bash
# Using whisper.cpp server in Docker
docker run -d -p 9000:8080 \
  -v whisper-models:/models \
  ghcr.io/ggml-org/whisper.cpp:server
```

**Model options:** `tiny`, `base`, `small`, `medium`, `large-v1`, `large-v2`, `large-v3`

For more details: [https://github.com/ggml-org/whisper.cpp](https://github.com/ggml-org/whisper.cpp)

```bash
# Using whisper-asr-webservice (provides OpenAI-compatible API)
docker run -d -p 9000:9000 onerahmet/openai-whisper-asr-webservice:latest
```

Or with GPU support for better performance:

```bash
docker run -d --gpus all -p 9000:9000 onerahmet/openai-whisper-asr-webservice:latest-gpu
```

#### Option C: faster-whisper (Good balance)

faster-whisper offers improved performance over the original Python implementation:

```bash
# Using faster-whisper with API wrapper
docker run -d -p 9000:8000 fedirz/faster-whisper-server:latest-cpu

# Or with GPU
docker run -d --gpus all -p 9000:8000 fedirz/faster-whisper-server:latest-cuda
```

#### Manual Installation

If you prefer to set up Whisper yourself:

1. **For whisper.cpp:** Follow the build instructions at [https://github.com/ggml-org/whisper.cpp](https://github.com/ggml-org/whisper.cpp)

2. **For Python Whisper:** Install and create an API wrapper:

   ```bash
   pip install -U openai-whisper
   ```

   Then use a wrapper like:
   - [whisper-asr-webservice](https://github.com/ahmetoner/whisper-asr-webservice)
   - [faster-whisper-server](https://github.com/fedirz/faster-whisper-server)

3. Ensure your server exposes an endpoint compatible with OpenAI's format at `/v1/audio/transcriptions`

**Official Repositories:**

- Whisper.cpp (C++): [https://github.com/ggml-org/whisper.cpp](https://github.com/ggml-org/whisper.cpp)
- OpenAI Whisper (Python): [https://github.com/openai/whisper](https://github.com/openai/whisper)

#### Configuration

Set these environment variables:

```bash
STT_PROVIDER=whisper
WHISPER_API_URL=http://localhost:9000
WHISPER_MODEL_SIZE=base  # Options: tiny, base, small, medium, large
```

**Model Size Guide:**

- `tiny` - Fastest, lowest accuracy (~75 MB, ~1GB RAM)
- `base` - Good balance for most use cases (~140 MB, ~1GB RAM)
- `small` - Better accuracy (~460 MB, ~2GB RAM)
- `medium` - High accuracy (~1.5 GB, ~5GB RAM)
- `large` - Best accuracy (~2.9 GB, ~10GB RAM)

**Note on Advanced Features:**

- **Speaker Diarization:** Whisper does NOT include speaker diarization. For this feature, you need to combine Whisper with a separate diarization tool like [pyannote.audio](https://github.com/pyannote/pyannote-audio).
- **Custom Vocabulary:** Not supported by Whisper. For domain-specific terminology, consider fine-tuning the model or post-processing.

### Switching Between Providers

Simply change the `STT_PROVIDER` environment variable and restart the application:

```bash
# For ElevenLabs
STT_PROVIDER=elevenlabs

# For Whisper
STT_PROVIDER=whisper
```

### Comparison

| Feature                   | ElevenLabs       | Whisper (Local)                 |
| ------------------------- | ---------------- | ------------------------------- |
| **Setup Complexity**      | Simple (API key) | Moderate (server setup)         |
| **Cost**                  | Pay per use      | Free (hardware costs)           |
| **Privacy**               | Cloud processing | Fully local                     |
| **Speaker Diarization**   | ✅ Built-in      | ❌ No (needs pyannote/external) |
| **Custom Vocabulary**     | ✅ Yes           | ❌ No                           |
| **Word-level Timestamps** | ✅ Yes           | ✅ Yes                          |
| **Max File Size**         | 500MB            | Configurable (server-dependent) |
| **Processing Speed**      | Fast             | Varies (CPU/GPU/implementation) |
| **Languages**             | 100+             | 100+                            |
| **Best Implementation**   | -                | whisper.cpp (fastest)           |

### License and pricing

This project is licensed under AGPL v3 for open use.
Commercial use, SaaS offering, or resale requires a separate commercial license.
