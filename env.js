import path from "node:path"
import { fileURLToPath } from "node:url"
import dotenv from "dotenv"

const appDir = path.dirname(fileURLToPath(import.meta.url))

dotenv.config({ path: path.join(appDir, ".env.local") })
