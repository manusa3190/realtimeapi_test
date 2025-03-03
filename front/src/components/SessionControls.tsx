import { useState } from "react";
import Button from "./Button";

function SessionStopped({ startSession }: { startSession: () => void }) {
  const [isActivating, setIsActivating] = useState(false);

  function handleStartSession() {
    if (isActivating) return;

    setIsActivating(true);
    startSession();
  }

  return (
    <div className="flex items-center justify-center w-full h-full">
      <Button
        onClick={handleStartSession}
        className={isActivating ? "bg-gray-600" : "bg-red-600"}
        // icon={<CloudLightning height={16} />}
      >
        {isActivating ? "starting session..." : "start session"}
      </Button>
    </div>
  );
}

function SessionActive({ 
  stopSession, 
  sendTextMessage 
}: { 
  stopSession: () => void, 
  sendTextMessage: (message: string) => void, 
}) {
  const [message, setMessage] = useState("");

  function handleSendClientEvent() {
    sendTextMessage(message);
    setMessage("");
  }

  return (
    <div className="flex items-center justify-center w-full h-full gap-4">
      <input
        onKeyDown={(e) => {
          if (e.key === "Enter" && message.trim()) {
            handleSendClientEvent();
          }
        }}
        type="text"
        placeholder="send a text message..."
        className="border border-gray-200 rounded-full p-4 flex-1"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <Button
        onClick={() => {
          if (message.trim()) {
            handleSendClientEvent();
          }
        }}
        // icon={<MessageSquare height={16} />}
        className="bg-blue-400"
      >
        send text
      </Button>
      <Button 
        onClick={stopSession}
        className="bg-red-400"
      >
        disconnect
      </Button>
    </div>
  );
}

export default function SessionControls({
  startSession,
  stopSession,
  sendTextMessage,
  isSessionActive,
}: {
  startSession: () => void,
  stopSession: () => void,
  sendClientEvent: (event: any) => void,
  sendTextMessage: (message: string) => void,
  isSessionActive: boolean,
}) {
  return (
    <div className="flex gap-4 border-t-2 border-gray-200 h-full rounded-md">
      {isSessionActive ? (
        <SessionActive
          stopSession={stopSession}
          sendTextMessage={sendTextMessage}
        />
      ) : (
        <SessionStopped startSession={startSession} />
      )}
    </div>
  );
}
