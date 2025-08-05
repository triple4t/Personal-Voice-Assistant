import { useEffect, useRef } from "react";
import { Room, connect, RoomEvent, RemoteParticipant, AudioTrack } from "livekit-client";

interface VoiceAgentRoomProps {
    url: string;      // LiveKit server URL (wss://...)
    token: string;    // LiveKit access token for the user
    agentIdentity?: string; // Optional: identity of the agent participant
}

export default function VoiceAgentRoom({ url, token, agentIdentity }: VoiceAgentRoomProps) {
    const roomRef = useRef<Room | null>(null);
    const agentAudioRef = useRef<HTMLAudioElement>(null);

    useEffect(() => {
        let room: Room;

        const join = async () => {
            room = await connect(url, token, {
                audio: true, // publish mic
                video: false,
            });
            roomRef.current = room;

            // Listen for new tracks (agent's audio)
            room.on(RoomEvent.TrackSubscribed, (track, publication, participant: RemoteParticipant) => {
                if (
                    track.kind === "audio" &&
                    agentAudioRef.current &&
                    (!agentIdentity || participant.identity === agentIdentity)
                ) {
                    // Attach agent's audio to the audio element
                    const mediaStream = new MediaStream();
                    mediaStream.addTrack((track as AudioTrack).mediaStreamTrack);
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