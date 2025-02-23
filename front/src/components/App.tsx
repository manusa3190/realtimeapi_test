import { useState, useRef, useEffect } from 'react'
import SessionControls from './SessionControls'
import { EventLog } from './EventLog';

import { AIMessage, HumanMessage, SystemMessage, BaseMessage } from 'langchain-core/messages';
import { CircleXIcon } from 'lucide-react';


function App() {
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [events, setEvents] = useState<any[]>([]);
  const [dataChannel, setDataChannel] = useState<RTCDataChannel | null>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const audioElement = useRef<HTMLAudioElement | null>(null);

  const [messages, setMessages] = useState<BaseMessage[]>([]);

  const [params, setParams] = useState<{model: string, voice: string, instructions: string}>({
    model: "gpt-4o-realtime-preview-2024-12-17",
    voice: "verse",
    instructions: "ユーザーの問いかけに答えてください",
  });

  async function startSession() {
    // Get an ephemeral key from the Fastify server
    const createSessionParams = new URLSearchParams(params).toString();
    const tokenResponse = await fetch(`http://localhost:8000/token?${createSessionParams}`);
    const data = await tokenResponse.json();
    const EPHEMERAL_KEY = data.client_secret.value;

    // ピア接続を作成
    const pc = new RTCPeerConnection();

    // モデルからの音声を再生するための設定
    audioElement.current = document.createElement("audio");
    audioElement.current.autoplay = true;
    pc.ontrack = (e) => (audioElement.current!.srcObject = e.streams[0]);

    // ブラウザのマイク入力を再生するための設定
    const ms = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });
    pc.addTrack(ms.getTracks()[0]);

    // イベントの送受信を行うデータチャンネルを作成
    const dc = pc.createDataChannel("oai-events");
    dc.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "response.done") {
        const {event_id, response, type } = data;
        if (response.output) {
          for (const item of response.output) {
            const { content, id, object, role, status,type} = item;
            for (const contentItem of content) {
              if (contentItem.type === "audio") {
                // realtime apiの設定で、"modalities": ["audio"]とした場合は、contentItem.transcriptが返ってくる
                const aiMessage = new AIMessage(contentItem.transcript);
                setMessages((prev: BaseMessage[]) => [...prev, aiMessage])
              } else if (contentItem.type === "text") {
                // realtime apiの設定で、"modalities": ["text"]とした場合は、contentItem.textが返ってくる
                console.log("text", contentItem.text);
                const aiMessage = new AIMessage(contentItem.text);
                setMessages((prev: BaseMessage[]) => [...prev, aiMessage])
              }
            }
          }
        }
      }else if (data.type === "conversation.item.input_audio_transcription.completed") {
        const humanMessage = new HumanMessage(data.transcript);
        setMessages((prev: BaseMessage[]) => [...prev, humanMessage])
      }
    };
    setDataChannel(dc); // この時、イベントリスナーがアタッチされる（下のuseEffect参照）

    // セッションを開始するためのSession Description Protocol (SDP)を作成
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const baseUrl = "https://api.openai.com/v1/realtime";
    const sdpResponse = await fetch(`${baseUrl}?model=${params.model}`, {
      method: "POST",
      body: offer.sdp,
      headers: {
        Authorization: `Bearer ${EPHEMERAL_KEY}`,
        "Content-Type": "application/sdp",
      },
    });

    const answer = {
      type: "answer",
      sdp: await sdpResponse.text(),
    };
    await pc.setRemoteDescription(answer);

    peerConnection.current = pc;
  }

  // 現在のセッションを停止し、ピア接続とデータチャンネルをクリーンアップ
  function stopSession() {
    if (dataChannel) {
      dataChannel.close();
    }

    peerConnection.current?.getSenders().forEach((sender) => {
      if (sender.track) {
        sender.track.stop();
      }
    });

    if (peerConnection.current) {
      peerConnection.current.close();
    }

    setIsSessionActive(false);
    setDataChannel(null);
    peerConnection.current = null;
  }

  // モデルにメッセージを送信（下のsendTextMessageで使用している）
  function sendClientEvent(message: any) {
    console.log("sendClientEvent");
    if (dataChannel) {
      message.event_id = message.event_id || crypto.randomUUID();
      dataChannel.send(JSON.stringify(message));
      setEvents((prev: any[]) => [message, ...prev]);
    } else {
      console.error(
        "Failed to send message - no data channel available",
        message,
      );
    }
  }

  // モデルにテキストメッセージを送信
  function sendTextMessage(message: string) {
    console.log("sendTextMessage");
    const event = {
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [
          {
            type: "input_text",
            text: message,
          },
        ],
      },
    };

    sendClientEvent(event);
    sendClientEvent({ type: "response.create" });
  }

  // データチャンネルが作成されたときにイベントリスナーをアタッチ
  useEffect(() => {
    if (dataChannel) {
      // 新しいサーバーイベントをリストに追加
      dataChannel.addEventListener("message", (e) => {
        setEvents((prev: any[]) => [{...JSON.parse(e.data), timestamp: new Date()}, ...prev]);
      });

      // データチャンネルが開いたときにセッションをアクティブにする
      dataChannel.addEventListener("open", () => {
        setIsSessionActive(true);
        setEvents([]);
      });
    }
  }, [dataChannel]);

  return (
    <>
      <h1 className='text-2xl font-bold'>リアルタイムAPIを使ったチャットボックス</h1>

      <div className=' p-4 grid grid-cols-2 gap-2'>
        <select className=' select' onChange={(e) => setParams({ ...params, model: e.target.value })}>
          <option value="gpt-4o-realtime-preview-2024-12-17">gpt-4o-realtime-preview-2024-12-17</option>
        </select>

        <select className=' select' onChange={(e) => setParams({ ...params, voice: e.target.value })}>
          {["verse", "alloy", "echo", "fable", "onyx", "nova", "shimmer"].map((voice) => (
            <option key={voice} value={voice}>{voice}</option>
          ))}
        </select>

        <div className=' relative w-full col-span-2 flex place-items-center'>
          <textarea className='textarea textarea-bordered textarea-md w-full' placeholder='instructions' value={params.instructions} onChange={(e) => setParams({ ...params, instructions: e.target.value })}></textarea>
          <CircleXIcon className='btn btn-circle btn-ghost absolute right-3' onClick={() => setParams({ ...params, instructions: "" })}>x</CircleXIcon>
        </div>
        
      </div>

      <div className=' flex'>
        <ul className=' flex-1 border-2 border-gray-300 rounded-md p-2 max-h-[500px] overflow-y-auto'>
          { messages.map((message, index) => (
            <li key={index} className={`chat ${message._getType() === "ai" ? "chat-start" : "chat-end"}`} >
              <div className={`chat-bubble ${message._getType() === "ai" ? "chat-bubble-primary" : "chat-bubble-secondary"}`}>{message.content}</div>
            </li>
          ))}        
        </ul>

        <EventLog events={events} />

      </div>

      <SessionControls
        isSessionActive={isSessionActive}
        startSession={startSession}
        stopSession={stopSession}
        sendClientEvent={sendClientEvent}
        sendTextMessage={sendTextMessage}
      />
    </>
  )
}

export default App
