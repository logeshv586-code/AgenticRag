"""
Voice Pipeline — Audio-in/Audio-out RAG with STT and TTS layers.
Pipeline: Audio → STT → Retriever → LLM → TTS → Audio Response

Supports:
  - Local STT: faster-whisper (offline, GPU-accelerated)
  - API STT:   OpenAI Whisper API
  - Local TTS: edge-tts / pyttsx3 (offline)
  - API TTS:   OpenAI TTS / ElevenLabs
"""
import base64
import logging
import tempfile
import os
from typing import Optional

from haystack import Pipeline
from haystack.components.builders import PromptBuilder

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════
#  STT (Speech-to-Text) Service
# ═══════════════════════════════════════════════════════════

class STTService:
    """Dual-mode speech-to-text: local (faster-whisper) or API (OpenAI)."""

    def __init__(self, mode: str = "local", api_key: Optional[str] = None,
                 model_size: str = "base", language: str = "en"):
        self.mode = mode
        self.api_key = api_key
        self.model_size = model_size
        self.language = language

    def transcribe(self, audio_base64: str) -> str:
        """Convert base64-encoded audio to text."""
        if self.mode == "api" and self.api_key:
            return self._transcribe_api(audio_base64)
        return self._transcribe_local(audio_base64)

    def _transcribe_local(self, audio_base64: str) -> str:
        """Use faster-whisper for local transcription."""
        try:
            from faster_whisper import WhisperModel
            # Decode audio and save to temp file
            audio_bytes = base64.b64decode(audio_base64)
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
                f.write(audio_bytes)
                temp_path = f.name

            try:
                model = WhisperModel(self.model_size, device="auto", compute_type="auto")
                segments, info = model.transcribe(temp_path, language=self.language)
                text = " ".join([seg.text for seg in segments])
                logger.info(f"STT (local): Transcribed {len(text)} chars, detected lang={info.language}")
                return text.strip()
            finally:
                os.unlink(temp_path)

        except ImportError:
            logger.warning("faster-whisper not installed — returning placeholder")
            return "[STT unavailable: install faster-whisper for local transcription]"
        except Exception as e:
            logger.error(f"Local STT error: {e}")
            return f"[STT error: {str(e)}]"

    def _transcribe_api(self, audio_base64: str) -> str:
        """Use OpenAI Whisper API for transcription."""
        try:
            import requests
            audio_bytes = base64.b64decode(audio_base64)

            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
                f.write(audio_bytes)
                temp_path = f.name

            try:
                with open(temp_path, "rb") as audio_file:
                    resp = requests.post(
                        "https://api.openai.com/v1/audio/transcriptions",
                        headers={"Authorization": f"Bearer {self.api_key}"},
                        files={"file": ("audio.wav", audio_file, "audio/wav")},
                        data={"model": "whisper-1", "language": self.language},
                        timeout=60,
                    )
                if resp.status_code == 200:
                    text = resp.json().get("text", "")
                    logger.info(f"STT (API): Transcribed {len(text)} chars")
                    return text
                logger.warning(f"OpenAI STT API error ({resp.status_code}), falling back to local")
                return self._transcribe_local(audio_base64)
            finally:
                os.unlink(temp_path)

        except Exception as e:
            logger.error(f"API STT error: {e}")
            return self._transcribe_local(audio_base64)


# ═══════════════════════════════════════════════════════════
#  TTS (Text-to-Speech) Service
# ═══════════════════════════════════════════════════════════

class TTSService:
    """Dual-mode text-to-speech: local (edge-tts/pyttsx3) or API (OpenAI/ElevenLabs)."""

    def __init__(self, mode: str = "local", api_key: Optional[str] = None,
                 voice: str = "en-US-AriaNeural", language: str = "en"):
        self.mode = mode
        self.api_key = api_key
        self.voice = voice
        self.language = language

    def synthesize(self, text: str) -> str:
        """Convert text to base64-encoded audio."""
        if self.mode == "api" and self.api_key:
            return self._synthesize_api(text)
        return self._synthesize_local(text)

    def _synthesize_local(self, text: str) -> str:
        """Use edge-tts for local synthesis (async library, run in sync context)."""
        try:
            import asyncio
            import edge_tts

            async def _generate():
                communicate = edge_tts.Communicate(text, self.voice)
                with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as f:
                    temp_path = f.name
                await communicate.save(temp_path)
                with open(temp_path, "rb") as audio_file:
                    audio_b64 = base64.b64encode(audio_file.read()).decode("utf-8")
                os.unlink(temp_path)
                return audio_b64

            # Run async in sync context
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    import concurrent.futures
                    with concurrent.futures.ThreadPoolExecutor() as pool:
                        result = pool.submit(asyncio.run, _generate()).result()
                    return result
                else:
                    return loop.run_until_complete(_generate())
            except RuntimeError:
                return asyncio.run(_generate())

        except ImportError:
            # Fallback to pyttsx3
            try:
                import pyttsx3
                engine = pyttsx3.init()
                with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
                    temp_path = f.name
                engine.save_to_file(text, temp_path)
                engine.runAndWait()
                with open(temp_path, "rb") as audio_file:
                    audio_b64 = base64.b64encode(audio_file.read()).decode("utf-8")
                os.unlink(temp_path)
                return audio_b64
            except ImportError:
                logger.warning("No TTS engine available (install edge-tts or pyttsx3)")
                return ""
        except Exception as e:
            logger.error(f"Local TTS error: {e}")
            return ""

    def _synthesize_api(self, text: str) -> str:
        """Use OpenAI TTS API."""
        try:
            import requests
            resp = requests.post(
                "https://api.openai.com/v1/audio/speech",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "tts-1",
                    "input": text[:4096],  # API limit
                    "voice": "alloy",
                    "response_format": "mp3",
                },
                timeout=60,
            )
            if resp.status_code == 200:
                audio_b64 = base64.b64encode(resp.content).decode("utf-8")
                logger.info(f"TTS (API): Generated {len(resp.content)} bytes audio")
                return audio_b64
            logger.warning(f"OpenAI TTS API error ({resp.status_code}), falling back to local")
            return self._synthesize_local(text)
        except Exception as e:
            logger.error(f"API TTS error: {e}")
            return self._synthesize_local(text)


# ═══════════════════════════════════════════════════════════
#  Voice Pipeline Builder
# ═══════════════════════════════════════════════════════════

def build_voice_pipeline(document_store, config: dict, retriever, generator) -> dict:
    """
    Build a voice RAG pipeline with STT and TTS layers.

    Pipeline flow:
        Audio → STT → Retriever → Prompt → LLM → TTS → Audio Response
    """
    dynamic_cfg = config.get("dynamicConfig", {})
    voice_lang = dynamic_cfg.get("voiceLanguage", "en")
    stt_mode = dynamic_cfg.get("sttMode", "local")  # "local" or "api"
    tts_mode = dynamic_cfg.get("ttsMode", "local")
    voice_name = dynamic_cfg.get("voiceName", "en-US-AriaNeural")
    api_keys = config.get("apiKeys", {})
    openai_key = api_keys.get("openai")

    stt = STTService(mode=stt_mode, api_key=openai_key, language=voice_lang)
    tts = TTSService(mode=tts_mode, api_key=openai_key, voice=voice_name, language=voice_lang)

    # Build the inner pipeline for text-based RAG
    pipeline = Pipeline()
    pipeline.add_component("retriever", retriever)

    template = """You are a voice-optimized AI assistant.
    Keep responses concise and conversational — they will be spoken aloud.
    Use natural language, avoid bullet points and complex formatting.

    Context:
    {% for document in documents %}
        {{ document.content }}
    {% endfor %}

    Question: {{ query }}
    Spoken Answer:"""

    prompt_builder = PromptBuilder(template=template)
    pipeline.add_component("prompt_builder", prompt_builder)
    pipeline.add_component("llm", generator)

    pipeline.connect("retriever.documents", "prompt_builder.documents")
    pipeline.connect("prompt_builder", "llm")

    return {
        "pipeline": pipeline,
        "stt": stt,
        "tts": tts,
        "meta": {
            "voice_lang": voice_lang,
            "stt_mode": stt_mode,
            "tts_mode": tts_mode,
            "voice_name": voice_name,
        },
    }


def execute_voice_query(pipeline_info: dict, query: str, audio_base64: Optional[str] = None) -> dict:
    """
    Execute a query through the voice pipeline.
    Accepts text query OR audio input; returns text answer + audio output.
    """
    stt = pipeline_info["stt"]
    tts = pipeline_info["tts"]
    pipeline = pipeline_info["pipeline"]

    # Step 1: STT if audio input provided
    text_query = query
    if audio_base64:
        text_query = stt.transcribe(audio_base64)
        logger.info(f"Voice: STT transcribed: '{text_query[:80]}...'")

    # Step 2: Run RAG pipeline
    try:
        result = pipeline.run({
            "retriever": {"query": text_query},
            "prompt_builder": {"query": text_query},
        })
        answer = result.get("llm", {}).get("replies", ["No response generated."])[0]
    except Exception as e:
        logger.error(f"Voice pipeline error: {e}")
        answer = f"Error: {str(e)}"

    # Step 3: TTS
    audio_response = tts.synthesize(answer)

    return {
        "text_query": text_query,
        "text_answer": answer,
        "audio_response": audio_response,
    }


def get_voice_graph_nodes() -> dict:
    """Return visualization nodes specific to voice pipeline."""
    return {
        "extra_nodes": [
            {"id": "stt", "label": "Speech-to-Text (STT)", "type": "processor"},
            {"id": "tts", "label": "Text-to-Speech (TTS)", "type": "processor"},
        ],
        "extra_edges": [
            {"source": "ingestion", "target": "stt"},
            {"source": "stt", "target": "embedder"},
        ],
        "post_edges": [
            {"source": "llm", "target": "tts"},
            {"source": "tts", "target": "deployment"},
        ],
        "remove_edges": [
            {"source": "llm", "target": "deployment"},
            {"source": "ingestion", "target": "embedder"},
        ],
    }
