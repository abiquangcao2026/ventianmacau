// file: server/config/db.js
const mongoose = require('mongoose')

async function connectDB() {
  const mongoUri = process.env.MONGO_URI

  if (!mongoUri) {
    throw new Error('Thiếu biến môi trường MONGO_URI')
  }

  await mongoose.connect(mongoUri, {
    autoIndex: true
  })

  console.log('[MongoDB] Connected successfully')
}

module.exports = connectDB