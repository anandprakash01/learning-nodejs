The industry standard for backend logging uses a two-tag system: [LEVEL] [CATEGORY].

This keeps your terminal highly readable, separates the severity of the issue from where it happened, and makes it incredibly easy to search your logs using CTRL+F.

Here is the most consistent and scalable format to adopt for your MERN stack:

1. The "Level" Tag (Severity)
   Always use standard severity levels. Pro Tip: Pad your shorter tags with an extra space (like [INFO ]) so that all your log messages perfectly align in the terminal, making them infinitely easier to read.

[INFO ] - Normal, expected behavior (e.g., connected, server started).

[WARN ] - Something undesirable happened, but the app survived (e.g., connection lost, auto-reconnecting).

[ERROR] - An operation failed, but the server is still running (e.g., query failed).

[FATAL] - The app is actively crashing (e.g., database failed on initial boot).

2. The "Category" Tag (Module)
   Identify exactly what part of your application triggered the log.

[DB] or [DATABASE]

[SERVER]

[AUTH]
