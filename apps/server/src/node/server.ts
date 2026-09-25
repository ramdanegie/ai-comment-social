// Passenger (cPanel "Setup Node.js App") entry: startup file → dist/server.cjs
import './env';
import { app } from '../server';

const port = Number(process.env.PORT || 3099);
app.listen(port, () => console.log(`Replyra API (node) listening on ${port}`));
