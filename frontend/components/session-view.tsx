'use client';

import React, { useEffect, useState, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  type AgentState,
  type ReceivedChatMessage,
  useRoomContext,
  useVoiceAssistant,
} from '@livekit/components-react';
import { toastAlert } from '@/components/alert-toast';

import { ChatEntry } from '@/components/livekit/chat/chat-entry';
import { ChatMessageView } from '@/components/livekit/chat/chat-message-view';
import useChatAndTranscription from '@/hooks/useChatAndTranscription';
import { useDebugMode } from '@/hooks/useDebug';
import type { AppConfig } from '@/lib/types';
import { cn } from '@/lib/utils';
import { WaveformBar } from './waveform-bar';

function isAgentAvailable(agentState: AgentState) {
  return agentState == 'listening' || agentState == 'thinking' || agentState == 'speaking';
}

interface SessionViewProps {
  appConfig: AppConfig;
  disabled: boolean;
  sessionStarted: boolean;
}

export const SessionView = ({
  appConfig,
  disabled,
  sessionStarted,
  ref,
}: React.ComponentProps<'div'> & SessionViewProps) => {
  const { state: agentState } = useVoiceAssistant();
  const [chatOpen, setChatOpen] = useState(false);
  const { messages, send } = useChatAndTranscription();
  const room = useRoomContext();
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [displayMessages, setDisplayMessages] = useState<ReceivedChatMessage[]>([]);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  useDebugMode();

  // Clear chat when user starts speaking
  useEffect(() => {
    const hasUserMessage = messages.some(msg => msg.from?.isLocal);
    if (hasUserMessage && !isUserSpeaking) {
      setIsUserSpeaking(true);
      // Clear previous messages when user starts talking
      setDisplayMessages([]);
    }
  }, [messages, isUserSpeaking]);

  // Update display messages when new messages come in
  useEffect(() => {
    if (messages.length > 0) {
      setDisplayMessages(messages.slice(-2)); // Show only latest Q&A pair
    }
  }, [messages]);

  // Auto-scroll to bottom when new messages arrive (for latest Q&A pair)
  useEffect(() => {
    if (chatContainerRef.current) {
      // Scroll to bottom to show latest messages
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [displayMessages]);

  // Also scroll to bottom on mount
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, []);

  // Function to ensure scroll to bottom
  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      const scrollElement = chatContainerRef.current;
      scrollElement.scrollTop = scrollElement.scrollHeight;
    }
  };

  // Scroll to bottom when component updates
  useEffect(() => {
    scrollToBottom();
  }, [displayMessages.length]);

  async function handleSendMessage(message: string) {
    // Clear chat history when user sends a message
    setDisplayMessages([]);
    setIsUserSpeaking(true);
    await send(message);
  }

  const toggleMute = async () => {
    try {
      if (isMuted) {
        await room.localParticipant.setMicrophoneEnabled(true);
        setIsMuted(false);
      } else {
        await room.localParticipant.setMicrophoneEnabled(false);
        setIsMuted(true);
      }
    } catch (error) {
      console.error('Error toggling microphone:', error);
    }
  };

  useEffect(() => {
    if (sessionStarted) {
      const timeout = setTimeout(() => {
        if (!isAgentAvailable(agentState)) {
          const reason =
            agentState === 'connecting'
              ? 'Agent did not join the room. '
              : 'Agent connected but did not complete initializing. ';

          toastAlert({
            title: 'Session ended',
            description: (
              <p className="w-full">
                {reason}
                Please try refreshing the page or check your connection.
              </p>
            ),
          });
          room.disconnect();
        }
      }, 10_000);

      return () => clearTimeout(timeout);
    }
  }, [agentState, sessionStarted, room]);



  return (
    <div className="flex flex-col md:flex-row h-[100dvh] bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Left: Agent info and waveform */}
      <div className="md:w-1/3 w-full flex flex-col items-center justify-center p-8 bg-white/80 dark:bg-gray-900/80 rounded-2xl m-4 shadow-xl">
        <div className="mb-6 mt-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 text-center">Agent</h2>
          <WaveformBar isActive={isUserSpeaking} color="#3b82f6" barCount={12} height={48} className="mx-auto" />
          
          {/* Mute/Unmute Button */}
          <div className="mt-6">
            <button
              onClick={toggleMute}
              className={`flex items-center justify-center w-12 h-12 rounded-full transition-all duration-200 ${
                isMuted 
                  ? 'bg-red-500 hover:bg-red-600 text-white' 
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              )}
            </button>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 text-center">
              {isMuted ? 'Unmute' : 'Mute'}
            </p>
          </div>
        </div>
      </div>
      {/* Right: Chat area */}
      <main
        ref={ref}
        inert={disabled}
        className="flex-1 flex flex-col justify-end bg-white/80 dark:bg-gray-900/80 p-4 md:p-8 rounded-2xl m-4 shadow-xl"
      >
        {/* Friendly prompt */}
        <div className="mb-6 mt-2 text-center">
          <p className="text-lg font-medium text-blue-700 dark:text-blue-200">Say "hello" to start the conversation!</p>
        </div>
        {/* Chat Messages - Full Screen */}
        <div className="flex-1 flex flex-col pt-4 pb-24">
          <div
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto px-4 scroll-smooth"
            style={{
              scrollBehavior: 'smooth',
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(0,0,0,0.2) transparent'
            }}
          >
            <div className="max-w-4xl mx-auto h-full flex items-center justify-center">
              <div className="w-full max-w-3xl">
                <ChatMessageView className="h-auto">
                  <div className="space-y-4 whitespace-pre-wrap">
                    <AnimatePresence>
                      {displayMessages.length === 0 ? (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="text-center py-12"
                        >
                          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 dark:bg-gray-800 mb-4">
                            <svg className="w-8 h-8 text-blue-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                          </div>
                          <h3 className="text-lg font-medium text-blue-700 dark:text-white mb-2">
                            Start the conversation
                          </h3>
                          <p className="text-blue-500 dark:text-white max-w-md mx-auto">
                            Ask me anything about my background, projects, or expertise in AI development. I'm here to help!
                          </p>
                        </motion.div>
                      ) : (
                        // Show only the latest Q&A pair
                        displayMessages.map((message: ReceivedChatMessage) => (
                          <motion.div
                            key={message.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, ease: 'easeOut' }}
                            className="bg-white/90 dark:bg-gray-900/90 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-6"
                          >
                            <ChatEntry hideName key={message.id} entry={message} />
                          </motion.div>
                        ))
                      )}
                    </AnimatePresence>
                  </div>
                </ChatMessageView>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
