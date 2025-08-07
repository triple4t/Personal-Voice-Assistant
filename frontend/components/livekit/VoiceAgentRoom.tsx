import { useEffect, useRef } from 'react';
import { RemoteParticipant, Room, RoomEvent } from 'livekit-client';

interface VoiceAgentRoomProps {
  url: string; // LiveKit server URL (wss://...)
  token: string; // LiveKit access token for the user
  agentIdentity?: string; // Optional: identity of the agent participant
}

export default function VoiceAgentRoom({ url, token, agentIdentity }: VoiceAgentRoomProps) {
  const roomRef = useRef<Room | null>(null);
  const agentAudioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    let room: Room;

    const join = async () => {
      room = new Room();
      await Promise.all([
        room.localParticipant.setMicrophoneEnabled(true),
        room.connect(url, token),
      ]);
      roomRef.current = room;

      // Listen for new tracks (agent's audio)
      room.on(RoomEvent.TrackSubscribed, (track, publication, participant: RemoteParticipant) => {
        if (
          track.kind === 'audio' &&
          agentAudioRef.current &&
          (!agentIdentity || participant.identity === agentIdentity)
        ) {
          // Attach agent's audio to the audio element
          const mediaStream = new MediaStream();
          mediaStream.addTrack(track.mediaStreamTrack);
          agentAudioRef.current.srcObject = mediaStream;
          agentAudioRef.current.play();
        }
      });
    };

    join();

    return () => {
      roomRef.current?.disconnect();
    };
  }, [url, token, agentIdentity]);

  return (
    <div
      className="w-full max-w-md mx-auto flex flex-col items-center justify-center min-h-[40vh] p-4 sm:p-6 md:p-8 bg-white dark:bg-zinc-900 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-800"
    >
      <audio ref={agentAudioRef} autoPlay className="w-full max-w-xs my-4" />
      {/* Responsive controls placeholder */}
      <div className="flex flex-col sm:flex-row gap-2 w-full justify-center mt-2">
        {/* Example: Mute/Unmute and Leave buttons (not implemented) */}
        <button
          className="px-4 py-2 rounded bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 transition w-full sm:w-auto"
          disabled
        >
          Mute/Unmute
        </button>
        <button
          className="px-4 py-2 rounded bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition w-full sm:w-auto"
          disabled
        >
          Leave
        </button>
      </div>
    </div>
  );
}
