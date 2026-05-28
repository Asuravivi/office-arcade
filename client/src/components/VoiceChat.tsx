import React, { useEffect, useRef, useState } from 'react';
// @ts-ignore
import Peer from 'simple-peer';

interface VoiceChatProps {
  socket: any;
  room: any;
  myId: string;
}

const VoiceChat: React.FC<VoiceChatProps> = ({ socket, room, myId }) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [muted, setMuted] = useState(true);
  const peersRef = useRef<{ [socketId: string]: Peer.Instance }>({});
  const audioRefs = useRef<{ [socketId: string]: HTMLAudioElement | null }>({});
  
  // For UI representation
  const [activePeers, setActivePeers] = useState<string[]>([]);

  useEffect(() => {
    // 1. Get user media
    navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      .then((s) => {
        // Mute initially
        s.getAudioTracks().forEach(t => t.enabled = false);
        setStream(s);
      })
      .catch((err) => {
        console.error('Microphone access denied or error:', err);
      });

    return () => {
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
      Object.values(peersRef.current).forEach(p => p.destroy());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!stream) return;

    // Connect to all existing peers in the room
    const otherPlayers = Object.keys(room.players || {}).filter(id => id !== myId && !room.players[id].isBot);
    
    otherPlayers.forEach(targetId => {
      if (!peersRef.current[targetId]) {
        const peer = createPeer(targetId, stream);
        peersRef.current[targetId] = peer;
        setActivePeers(prev => [...prev, targetId]);
      }
    });

    socket.on('roomUpdated', (updatedRoom: any) => {
      // Connect to any new peers
      const currentOthers = Object.keys(updatedRoom.players || {}).filter(id => id !== myId && !updatedRoom.players[id].isBot);
      currentOthers.forEach(targetId => {
        if (!peersRef.current[targetId]) {
          const peer = createPeer(targetId, stream);
          peersRef.current[targetId] = peer;
          setActivePeers(prev => [...prev, targetId]);
        }
      });
      // Destroy left peers
      Object.keys(peersRef.current).forEach(id => {
        if (!currentOthers.includes(id)) {
          peersRef.current[id].destroy();
          delete peersRef.current[id];
          setActivePeers(prev => prev.filter(pId => pId !== id));
        }
      });
    });

    socket.on('webrtc_offer', ({ senderId, offer }: any) => {
      if (!peersRef.current[senderId]) {
        const peer = addPeer(senderId, offer, stream);
        peersRef.current[senderId] = peer;
        setActivePeers(prev => [...prev, senderId]);
      }
    });

    socket.on('webrtc_answer', ({ senderId, answer }: any) => {
      const peer = peersRef.current[senderId];
      if (peer) {
        peer.signal(answer);
      }
    });

    socket.on('webrtc_ice_candidate', ({ senderId, candidate }: any) => {
      const peer = peersRef.current[senderId];
      if (peer) {
        peer.signal(candidate);
      }
    });

    return () => {
      socket.off('webrtc_offer');
      socket.off('webrtc_answer');
      socket.off('webrtc_ice_candidate');
      socket.off('roomUpdated');
    };
  }, [stream, socket, myId, room]);

  const createPeer = (targetId: string, str: MediaStream) => {
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream: str
    });

    peer.on('signal', (signal: any) => {
      if (signal.type === 'offer') {
        socket.emit('webrtc_offer', { targetId, offer: signal });
      } else {
        socket.emit('webrtc_ice_candidate', { targetId, candidate: signal });
      }
    });

    peer.on('stream', (remoteStream: any) => {
      if (audioRefs.current[targetId]) {
        audioRefs.current[targetId]!.srcObject = remoteStream;
      }
    });

    return peer;
  };

  const addPeer = (callerId: string, offer: any, str: MediaStream) => {
    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream: str
    });

    peer.on('signal', (signal: any) => {
      if (signal.type === 'answer') {
        socket.emit('webrtc_answer', { targetId: callerId, answer: signal });
      } else {
        socket.emit('webrtc_ice_candidate', { targetId: callerId, candidate: signal });
      }
    });

    peer.on('stream', (remoteStream: any) => {
      if (audioRefs.current[callerId]) {
        audioRefs.current[callerId]!.srcObject = remoteStream;
      }
    });

    peer.signal(offer);
    return peer;
  };

  const toggleMute = () => {
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setMuted(!audioTrack.enabled);
      }
    }
  };

  return (
    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
      <button 
        onClick={toggleMute}
        style={{
          background: muted ? '#dc2626' : '#059669',
          color: 'white',
          border: 'none',
          padding: '8px 16px',
          borderRadius: '4px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}
      >
        {muted ? '🔇 Muted' : '🎙️ Mic On'}
      </button>
      
      {/* Hidden audio elements to play remote streams */}
      {activePeers.map(peerId => (
        <audio
          key={peerId}
          autoPlay
          ref={(el) => { audioRefs.current[peerId] = el; }}
        />
      ))}
      <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
        {activePeers.length} in Voice Chat
      </span>
    </div>
  );
};

export default VoiceChat;
