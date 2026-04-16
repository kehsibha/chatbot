"""
Chatbot – macOS desktop app.

Uses pywebview to display a native window with a chat UI,
and the OpenAI Python SDK for the LLM backend.
"""

import os
import webview
from openai import OpenAI


class ChatAPI:
    """Exposed to JavaScript via window.pywebview.api.*"""

    def __init__(self):
        self._client = None
        self._messages = []

    def set_api_key(self, key: str) -> None:
        self._client = OpenAI(api_key=key)

    def send_message(self, text: str) -> str:
        self._messages.append({"role": "user", "content": text})

        response = self._client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=self._messages,
        )

        reply = response.choices[0].message.content
        self._messages.append({"role": "assistant", "content": reply})
        return reply


def main():
    api = ChatAPI()

    html_path = os.path.join(os.path.dirname(__file__), "chat.html")

    window = webview.create_window(
        title="Chatbot",
        url=html_path,
        width=720,
        height=560,
        min_size=(480, 400),
        js_api=api,
    )

    # On macOS pywebview uses the system WebKit (no extra dependency).
    webview.start()


if __name__ == "__main__":
    main()
