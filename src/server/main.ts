import path from 'node:path';
import { createApi } from './api.js';

const initialDirectory = path.resolve(process.argv[2] ?? process.cwd());
const port = Number(process.env.OPSX_CHART_PORT ?? 4317);
const app = await createApi(initialDirectory);
app.listen(port, '127.0.0.1', () => {
  process.stdout.write(`OPSX Chart: http://127.0.0.1:${port}\n`);
});
