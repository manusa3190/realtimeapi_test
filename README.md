openAIのrealtime consoleを自分流に書き直しました。
https://github.com/openai/openai-realtime-console

内容はZennで解説しています。
https://zenn.dev/yuta_enginner/articles/315d5113fc5f90


# 起動方法
## server

.envに環境変数を設定

```bash
cd server
poetry install
poetry run python src/main.py
```

## front

```bash
cd front
npm install
npm run dev
```