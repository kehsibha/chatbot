# 💬 Chatbot template

A simple Streamlit app that shows how to build a chatbot using OpenAI's GPT-3.5.

[![Open in Streamlit](https://static.streamlit.io/badges/streamlit_badge_black_white.svg)](https://chatbot-template.streamlit.app/)

### How to run it on your own machine

1. Install the requirements

   ```
   $ pip install -r requirements.txt
   ```

2. Run the app

   ```
   $ streamlit run streamlit_app.py
   ```

---

### macOS Desktop App

The same chatbot is also available as a native macOS desktop application.

#### Run in development mode

```
$ pip install -r requirements.txt
$ python app.py
```

This opens a native window powered by **pywebview** (uses the system WebKit on macOS — no Electron/Chromium download needed).

#### Build a distributable .app bundle

```
$ pip install -r requirements.txt
$ python setup.py py2app
```

The finished app will be at `dist/Chatbot.app`. Double-click it to launch — no Python installation required on the target Mac.
