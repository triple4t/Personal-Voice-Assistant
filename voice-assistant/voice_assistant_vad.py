import os
import base64
import asyncio
import wave
import sounddevice as sd
import numpy as np
import webrtcvad  # Not used anymore, but kept for compatibility if needed
from openai import AsyncAzureOpenAI
from dotenv import load_dotenv

load_dotenv()

SAMPLE_RATE = 16000  # Supported by webrtcvad
CHANNELS = 1
DTYPE = np.int16
RECORD_SECONDS = 3  # Fixed duration for each user turn
OUTPUT_SAMPLE_RATE = 24000  # For playback and saving, to match realtime script


def record_audio(duration=RECORD_SECONDS):
    print(f"[Recording for {duration} seconds... Speak now!]")
    audio = sd.rec(int(duration * SAMPLE_RATE), samplerate=SAMPLE_RATE, channels=CHANNELS, dtype=DTYPE)
    sd.wait()
    print("[Recording stopped]")
    return audio


async def main() -> None:
    """
    Voice-to-voice assistant: user speaks for a fixed duration, AI responds in voice, then user speaks again, alternating automatically.
    """
    client = AsyncAzureOpenAI(
        azure_endpoint=os.environ["AZURE_OPENAI_REALTIME_ENDPOINT"],
        api_key=os.environ["AZURE_OPENAI_REALTIME_API_KEY"],
        api_version=os.environ["AZURE_OPENAI_REALTIME_API_VERSION"],
    )
    deployment_name = os.environ["AZURE_OPENAI_REALTIME_DEPLOYMENT_NAME"]

    async with client.beta.realtime.connect(
        model=deployment_name,
    ) as connection:
        await connection.session.update(session={
            "modalities": ["audio", "text"],
            "input_audio_format": "pcm16",
            "output_audio_format": "pcm16@24000",  # Request 24kHz output
        })
        msg_count = 0
        print("[Voice Assistant Started. Press Ctrl+C to quit.]")
        while True:
            # 1. Record audio for a fixed duration
            audio = record_audio(RECORD_SECONDS)
            audio_bytes = audio.astype(DTYPE).tobytes()
            audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")
            # 2. Send audio to API
            await connection.input_audio_buffer.append(audio=audio_b64)
            await connection.input_audio_buffer.commit()
            audio_chunks = []
            print("[Waiting for AI response...]")
            try:
                async for event in connection:
                    print("[EVENT FULL]", event)
                    if event.type == "response.audio.delta":
                        audio_data = base64.b64decode(event.delta)
                        audio_chunks.append(audio_data)
                    elif event.type == "response.audio_transcript.delta":
                        print(f"[Transcript delta]: {event.delta}")
                    elif event.type == "response.text.delta":
                        print(event.delta, flush=True, end="")
                    elif event.type == "response.text.done":
                        print()
                    elif event.type == "response.done":
                        break
            except Exception as e:
                print("[ERROR] Exception in event loop:", e)
            # After receiving response, check if any audio was received
            if not audio_chunks:
                print("[No audio response from AI. Please try again.]")
                continue
            # Concatenate all audio and play in one go
            audio_bytes = b"".join(audio_chunks)
            audio_np = np.frombuffer(audio_bytes, dtype=DTYPE)
            print("[Playing AI response...]")
            sd.play(audio_np, samplerate=OUTPUT_SAMPLE_RATE, blocking=True)
            # Save audio to file
            filename = f"response_{msg_count}.wav"
            with wave.open(filename, "wb") as wf:
                wf.setnchannels(1)
                wf.setsampwidth(2)
                wf.setframerate(OUTPUT_SAMPLE_RATE)
                wf.writeframes(audio_bytes)
            print(f"[Audio saved to {filename}]")
            msg_count += 1

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[Voice Assistant Stopped]") 