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
    <div>
      <audio ref={agentAudioRef} autoPlay />
      {/* Add UI for mute/unmute, leave, etc. if needed */}
    </div>
  );
}
