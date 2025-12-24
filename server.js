const chatRoutes = require('./routes/chat');
const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

app.use(cors());
app.use(express.json());
app.use('/chat', chatRoutes);

/* =========================
   MONGODB CONNECTION
========================= */
mongoose
  .connect(
    "mongodb+srv://nagra_exe:UC70AFLNCmx0Uymb@chat.krucbsm.mongodb.net/chat",
    {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }
  )
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error:", err));

/* =========================
   USER SCHEMA
========================= */
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
});

const User = mongoose.model("User", userSchema);

/* =========================
   REGISTER
========================= */
app.post("/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: "All fields required" });
    }

    const existingUser = await User.findOne({
      $or: [{ email }, { username }],
    });

    if (existingUser) {
      return res.status(400).json({ message: "User already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      username,
      email,
      password: hashedPassword,
    });

    await user.save();

    res.json({
      message: "User registered successfully",
      userId: user._id,
      username: user.username,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

/* =========================
   LOGIN
========================= */
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid password" });
    }

    res.json({
      message: "Login successful",
      userId: user._id,
      username: user.username,
      email: user.email,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

/* =========================
   SEARCH USERS (Telegram-style)
========================= */
app.get("/users/search", async (req, res) => {
  try {
    const { username } = req.query;

    if (!username) {
      return res.status(400).json({ message: "Username required" });
    }

    const users = await User.find({
      username: { $regex: username, $options: "i" },
    }).select("_id username email");

    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

/* =========================
   SOCKET.IO (CHAT)
========================= */
io.on("connection", (socket) => {
  console.log("🟢 User connected:", socket.id);

  socket.on("message", (data) => {
    // broadcast message to all
    socket.broadcast.emit("message", data);
  });

  socket.on("disconnect", () => {
    console.log("🔴 User disconnected:", socket.id);
  });
});

/* =========================
   START SERVER
========================= */
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

