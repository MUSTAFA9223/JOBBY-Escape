const GAME_URL = process.env.GAME_WEB_APP_URL || "https://jobby-escape-web-production.up.railway.app";
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!TOKEN) {
  console.warn("Telegram bot is not started: TELEGRAM_BOT_TOKEN is not configured.");
} else {
  const API = "https://api.telegram.org/bot" + TOKEN;
  let offset = 0;
  let stopped = false;

  async function telegram(method, body) {
    const response = await fetch(API + "/" + method, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    const result = await response.json();
    if (!result.ok) throw new Error("Telegram API " + method + " failed: " + (result.description || response.status));
    return result.result;
  }

  async function showGame(chatId, firstName) {
    const name = String(firstName || "there").replace(/[<>]/g, "").slice(0, 60);
    await telegram("sendMessage", {
      chat_id: chatId,
      text: "Welcome " + name + " to JOBBY Escape! Run, jump, dodge traps and escape with the community.",
      reply_markup: {
        inline_keyboard: [[{ text: "Play Game", web_app: { url: GAME_URL } }]]
      }
    });
  }

  async function handle(update) {
    const message = update.message;
    if (!message || !message.chat || message.chat.type !== "private") return;
    const text = String(message.text || "").trim();
    if (/^\/(start|play)(?:@\w+)?(?:\s|$)/i.test(text)) {
      await showGame(message.chat.id, message.from && message.from.first_name);
    } else if (/^\/help(?:@\w+)?(?:\s|$)/i.test(text)) {
      await telegram("sendMessage", {
        chat_id: message.chat.id,
        text: "Use /start or /play to open JOBBY Escape.",
        reply_markup: {
          inline_keyboard: [[{ text: "Play Game", web_app: { url: GAME_URL } }]]
        }
      });
    }
  }

  async function poll() {
    while (!stopped) {
      try {
        const updates = await telegram("getUpdates", {
          offset,
          timeout: 25,
          allowed_updates: ["message"]
        });
        for (const update of updates) {
          offset = update.update_id + 1;
          try { await handle(update); }
          catch (error) { console.error("Telegram update handler error:", error.message); }
        }
      } catch (error) {
        console.error("Telegram polling error:", error.message);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
  }

  telegram("setMyCommands", {
    commands: [
      { command: "start", description: "Open JOBBY Escape" },
      { command: "play", description: "Play the game" },
      { command: "help", description: "How to play" }
    ]
  }).catch(error => console.error("Could not set bot commands:", error.message));

  telegram("setChatMenuButton", {
    menu_button: {
      type: "web_app",
      text: "Play Game",
      web_app: { url: GAME_URL }
    }
  }).catch(error => console.error("Could not set menu button:", error.message));

  poll();
  process.once("SIGTERM", () => { stopped = true; });
  process.once("SIGINT", () => { stopped = true; });
}
