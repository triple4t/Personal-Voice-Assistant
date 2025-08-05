import os
import base64
import asyncio
import wave
import sounddevice as sd
import numpy as np
from openai import AsyncAzureOpenAI
import queue

SAMPLE_RATE = 24000
CHANNELS = 1
DTYPE = np.int16
RECORD_SECONDS = 3

def record_audio(duration=RECORD_SECONDS):
    print(f"[Recording for {duration} seconds... Speak now!]")
    audio = sd.rec(int(duration * SAMPLE_RATE), samplerate=SAMPLE_RATE, channels=CHANNELS, dtype=DTYPE)
    sd.wait()
    print("[Recording stopped]")
    return audio

async def main() -> None:
    """
    Voice-to-voice assistant: user speaks for a fixed duration, AI responds in voice.
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
            "modalities": ["audio"],
            "input_audio_format": "pcm16",
            "output_audio_format": "pcm16",
        })
        msg_count = 0
        while True:
            print("\nPress Enter to record, or 'q' to quit.")
            user_input = input()
            if user_input.strip().lower() == "q":
                break
            # 1. Record fixed-duration audio
            audio = record_audio(RECORD_SECONDS)
            audio_bytes = audio.tobytes()
            audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")
            # 2. Send audio to API
            await connection.input_audio_buffer.append(audio=audio_b64)
            await connection.input_audio_buffer.commit()
            audio_chunks = []
            print("[Waiting for AI response...]")
            # Buffer and playback settings
            BLOCK_MS = 30  # Block size in ms
            BLOCK_SIZE = int(SAMPLE_RATE * BLOCK_MS / 1000)
            PREBUFFER_MS = 400  # Increased prebuffer before playback (ms)
            PREBUFFER_SIZE = int(SAMPLE_RATE * PREBUFFER_MS / 1000)
            audio_q = queue.Queue()
            playback_started = False
            playback_buffer = np.zeros((0,), dtype=DTYPE)

            def callback(outdata, frames, time, status):
                nonlocal playback_buffer
                if status:
                    print(f"[Playback status]: {status}")
                print(f"[DEBUG] Playback buffer size: {len(playback_buffer)} samples")
                # Fill output buffer from playback_buffer
                if len(playback_buffer) < frames:
                    # Not enough data, pad with zeros
                    out = np.zeros((frames,), dtype=DTYPE)
                    if len(playback_buffer) > 0:
                        out[:len(playback_buffer)] = playback_buffer
                    playback_buffer = np.zeros((0,), dtype=DTYPE)
                else:
                    out = playback_buffer[:frames]
                    playback_buffer = playback_buffer[frames:]
                outdata[:] = out.reshape(-1, 1)

            with sd.OutputStream(samplerate=SAMPLE_RATE, channels=CHANNELS, dtype=DTYPE, callback=callback, blocksize=BLOCK_SIZE):
                async for event in connection:
                    if event.type == "response.audio.delta":
                        audio_data = base64.b64decode(event.delta)
                        audio_chunks.append(audio_data)
                        # Convert bytes to numpy array
                        audio_np = np.frombuffer(audio_data, dtype=DTYPE)
                        # Buffer the audio
                        playback_buffer = np.concatenate((playback_buffer, audio_np))
                        # Wait until we have enough buffered audio before starting playback
                        if not playback_started and len(playback_buffer) >= PREBUFFER_SIZE:
                            playback_started = True
                    elif event.type == "response.audio_transcript.delta":
                        print(f"[Transcript delta]: {event.delta}")
                    elif event.type == "response.text.delta":
                        print(event.delta, flush=True, end="")
                    elif event.type == "response.text.done":
                        print()
                    elif event.type == "response.done":
                        # Wait for all buffered audio to play out
                        while len(playback_buffer) > 0:
                            print(f"[DEBUG] Draining playback buffer: {len(playback_buffer)} samples left")
                            await asyncio.sleep(BLOCK_MS / 1000)
                        # Save audio to file if any audio was received
                        if audio_chunks:
                            filename = f"response_{msg_count}.wav"
                            audio_bytes = b"".join(audio_chunks)
                            with wave.open(filename, "wb") as wf:
                                wf.setnchannels(1)
                                wf.setsampwidth(2)
                                wf.setframerate(24000)
                                wf.writeframes(audio_bytes)
                            print(f"[Audio saved to {filename}]")
                            msg_count += 1
                        break

if __name__ == "__main__":
    asyncio.run(main()) 