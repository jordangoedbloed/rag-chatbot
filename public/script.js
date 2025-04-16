const chat = document.getElementById("chat");
const input = document.getElementById("question");
const button = document.getElementById("send");

button.addEventListener("click", async () => {
  const q = input.value.trim();
  if (!q) return;

  appendMessage("user", q);
  input.value = "";

  const res = await fetch("http://localhost:3000/api/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question: q })
  });

  const data = await res.json();
  appendMessage("bot", data.answer || "Er ging iets mis.");
});

function appendMessage(role, text) {
  const msg = document.createElement("div");
  msg.className = `message ${role}`;
  msg.textContent = (role === "user" ? "Jij: " : "Bot: ") + text;
  chat.appendChild(msg);
  chat.scrollTop = chat.scrollHeight;
}
