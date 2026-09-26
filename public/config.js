# Optional client config (loaded by the web demo).
# For hybrid setup: Vercel hosts the UI/search; this host runs conversion.
#
# Example after deploying Docker to Railway/Render/Fly:
#   window.WAVEBOX_CONFIG = { audioBaseUrl: "https://your-audio.up.railway.app" };
#
# Leave empty when the same origin runs conversion (local / Docker full stack).
window.WAVEBOX_CONFIG = {
  audioBaseUrl: "",
};
