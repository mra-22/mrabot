import mongoose from "mongoose"

const sessionSchema = new mongoose.Schema({
  key: String,
  value: Object
})

export default mongoose.model("Session", sessionSchema)
