import logging

import aioboto3

from app.config import settings

logger = logging.getLogger(__name__)
session = aioboto3.Session()


async def synthesize_speech(text: str, voice_id: str = "Joanna") -> bytes:
    """Synthesize text to speech using AWS Polly. Returns MP3 audio bytes."""
    if settings.simulate_aws:
        logger.info(f"[SIMULATED POLLY] Synthesizing: '{text[:80]}...' with voice={voice_id}")
        return b"SIMULATED_AUDIO_BYTES"

    async with session.client("polly", region_name=settings.aws_region) as polly:
        response = await polly.synthesize_speech(
            Text=text,
            OutputFormat="mp3",
            VoiceId=voice_id,
            Engine="neural",
        )
        audio_stream = response["AudioStream"]
        audio_bytes = await audio_stream.read()
        logger.info(f"[POLLY] Synthesized {len(audio_bytes)} bytes for: '{text[:50]}...'")
        return audio_bytes


async def synthesize_ssml(ssml: str, voice_id: str = "Joanna") -> bytes:
    """Synthesize SSML markup to speech."""
    if settings.simulate_aws:
        logger.info(f"[SIMULATED POLLY] SSML synthesis with voice={voice_id}")
        return b"SIMULATED_AUDIO_BYTES"

    async with session.client("polly", region_name=settings.aws_region) as polly:
        response = await polly.synthesize_speech(
            Text=ssml,
            TextType="ssml",
            OutputFormat="mp3",
            VoiceId=voice_id,
            Engine="neural",
        )
        audio_stream = response["AudioStream"]
        return await audio_stream.read()
