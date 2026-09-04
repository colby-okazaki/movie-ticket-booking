import "dotenv/config";
import app from "./app.js";

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
  console.log(`UI (dev): cd client && npm run dev → http://localhost:5174`);
});
