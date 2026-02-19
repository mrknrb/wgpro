import 'dotenv/config'
import app from './api/index.js'

const PORT = process.env.PORT || 3010

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`)
})
