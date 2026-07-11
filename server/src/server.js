import "dotenv/config";
import app from "./app.js";
import { connectDb } from "./config/db.js";
const port = process.env.PORT || 5050;
connectDb().then(() => app.listen(port, () => console.log(`API sur http://localhost:${port}`))).catch(err => { console.error(err); process.exit(1); });
