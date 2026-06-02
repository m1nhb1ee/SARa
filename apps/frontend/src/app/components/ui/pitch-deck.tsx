import pitchHtml from "./pitch.html?raw";

export function PitchDeck() {
  return (
    <iframe
      srcDoc={pitchHtml}
      title="SARa Pitch Deck"
      style={{
        display: "block",
        width: "100%",
        height: "100%",
        minHeight: "calc(100vh - 0px)",
        border: 0,
        background: "#2c2418",
      }}
      allow="fullscreen"
    />
  );
}
