from fastapi import FastAPI, WebSocket, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from pydantic import BaseModel, Field

import uuid
import json
from aiortc import RTCPeerConnection, RTCSessionDescription
from contextlib import asynccontextmanager
import httpx
import os
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("OPENAI_API_KEY")

peer_connections: dict[str, RTCPeerConnection] = {}  # 既存の接続管理用辞書

@asynccontextmanager
async def lifespan(app: FastAPI):
    # アプリ起動時の処理（必要に応じて記述）
    yield
    # アプリ終了時の処理（クリーンアップ）
    for pc in peer_connections.values():
        await pc.close()
    peer_connections.clear()

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class CreateSessionParams(BaseModel):
    model: str = Field(default="gpt-4o-realtime-preview-2024-12-17", description="使用するモデル", examples=["gpt-4-turbo-preview"])
    voice: str | None = Field(description="音声の種類", examples=["alloy", "echo", "fable", "onyx", "nova", "shimmer","verse"])
    instructions: str | None = Field(description="アシスタントへの指示", examples=["あなたは優しい先生です"])
    input_audio_transcription: dict | None = Field( description="音声認識の設定。これを設定しないと、フロント側でconversation.item.input_audio_transcription.completedが発生しない", examples=[{"model": "whisper-1"}])
    modalities: list[str] | None = Field(default=None, description="テキストだけ返してほしいときは['text']")
    turn_detection: None | dict = Field(default=None, description="turn detectionの設定。VADを使用する場合など")
    tools: list[str] | None = Field(default=None, description="使用するツール")
    tool_choice: str | None = Field(default=None, description="使用するツールを指定する")
    temperature: float | None = Field(default=0.7, description="温度")
    max_response_output_tokens: int | None = Field(default=None, description="最大トークン数")
    # client_secret: str | None = Field(default=None, description="client secret")    

# OpenAIからトークンを取得
@app.get("/token")
async def get_token(model:str, voice:str, instructions:str|None=None):
    print("params", model, voice, instructions)
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.openai.com/v1/realtime/sessions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": model,
                    "voice": voice,
                    "instructions": instructions if instructions else "",
                    "input_audio_transcription": {
                        "model": "whisper-1"
                    },
                    "modalities": ["text","audio"],
                }
            )
            return response.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get token: {str(e)}")

# WebRTC接続のセットアップ
@app.post("/session/start")
async def start_session(offer: dict):
    try:
        # RTCPeerConnectionの作成
        pc = RTCPeerConnection()

        if not offer.get("sdp") or not offer.get("type"):
            raise HTTPException(status_code=400, detail="Missing sdp or type in offer")
        
        # オファーのセット
        offer_sdp = RTCSessionDescription(
            sdp=offer.get("sdp"), # type: ignore
            type=offer.get("type") # type: ignore
        )
        await pc.setRemoteDescription(offer_sdp)

        # データチャネルのハンドリング
        @pc.on("datachannel")
        def on_datachannel(channel):
            @channel.on("message")
            async def on_message(message):
                try:
                    data = json.loads(message)
                    if data["type"] == "conversation.item.create":
                        # メッセージの処理
                        text = data["item"]["content"][0]["text"]
                        # OpenAIのAPIを呼び出すなどの処理をここに実装
                        
                        # 応答の送信
                        response = {
                            "type": "conversation.item.create",
                            "item": {
                                "type": "message",
                                "role": "assistant",
                                "content": [
                                    {
                                        "type": "text",
                                        "text": f"受け取ったメッセージ: {text}"
                                    }
                                ]
                            }
                        }
                        await channel.send(json.dumps(response))

                except Exception as e:
                    print(f"Error processing message: {str(e)}")

        # 音声トラックの処理
        @pc.on("track")
        def on_track(track):
            if track.kind == "audio":
                # 音声処理のロジックをここに実装
                print('track')
                pass

        # アンサーの作成と送信
        answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)

        # 接続の保存
        session_id = str(uuid.uuid4())
        peer_connections[session_id] = pc

        return JSONResponse({
            "session_id": session_id,
            "sdp": pc.localDescription.sdp,
            "type": pc.localDescription.type
        })

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start session: {str(e)}")

# セッションの終了
@app.post("/session/stop/{session_id}")
async def stop_session(session_id: str):
    if session_id in peer_connections:
        pc = peer_connections[session_id]
        await pc.close()
        del peer_connections[session_id]
        return {"status": "success"}
    raise HTTPException(status_code=404, detail="Session not found")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run('main:app', host="0.0.0.0", port=8000, reload=True)
