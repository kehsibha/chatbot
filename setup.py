"""
py2app build script – produces a macOS .app bundle.

Usage:
    python setup.py py2app
"""

from setuptools import setup

APP = ["app.py"]
DATA_FILES = [("", ["chat.html"])]

OPTIONS = {
    "argv_emulation": False,
    "packages": ["openai", "httpcore", "httpx", "anyio"],
    "iconfile": None,  # replace with "icon.icns" if you add a custom icon
    "plist": {
        "CFBundleName": "Chatbot",
        "CFBundleDisplayName": "Chatbot",
        "CFBundleIdentifier": "com.chatbot.desktop",
        "CFBundleVersion": "1.0.0",
        "CFBundleShortVersionString": "1.0.0",
        "LSMinimumSystemVersion": "10.15",
    },
}

setup(
    name="Chatbot",
    app=APP,
    data_files=DATA_FILES,
    options={"py2app": OPTIONS},
    setup_requires=["py2app"],
)
