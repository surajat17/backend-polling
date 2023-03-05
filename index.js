const express = require("express");
const cors = require("cors");
const http = require("http");
const socketio = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = socketio(server);
const resultsDB = [];
const corsOptions = {
  origin: 'http://127.0.0.1:5173',
  credentials: true
};
app.use(cors({ origin: '*' }));
let students = [];
let teacher = null;
let onlineUsers = {};
let question = null;
let participants = 0;
let results = new Map();
let total = 0;

app.use("/", (req, res) => {
  res.json({ message: "helloo" });
});

io.on("connect", (socket) => {
  console.log(`${socket.id} connected`);

  socket.on("join", ({ role, user }, callback) => {
    onlineUsers[socket.id] = { role, user };
    if (role === "teacher") {
      teacher = user;
    } else {
      students.push(user);
      students = students.filter(
        (v, i, a) => a.findIndex((v2) => v2.sid === v.sid) === i
      );
    }
    const connected = {
      students,
      teacher,
    };
    console.log(connected);
    io.emit("connected", connected);
    callback();
  });

  socket.on("submit-question", (data, callback) => {
    results = new Map();
    total = 0;
    question = data;
    data.options.forEach((opt) => {
      results.set(opt, 0);
    });
    participants = students.length;
    io.emit("question", question);
    callback();
  });

  socket.on("submit-answer", (data, callback) => {
    if (data !== "Not answered") results.set(data, results.get(data) + 1);
    total++;
    // console.log(data, results, total, participants);
    const res = {
      votes: Object.fromEntries(results),
      participants,
      total,
      question: question.question,
      correct: question.correct,
    };
    io.emit("results", res);

    if (total === participants) {
      resultsDB.push(res);
    }

    callback();
  });

  socket.on("kick", (sid, callback) => {
    io.to(sid).emit("kick");
    callback();
  });

  socket.on("message", (message) => {
    io.emit("message", message);
  });

  socket.on("disconnect", (reason) => {
    if (onlineUsers[socket.id]) {
      const { role } = onlineUsers[socket.id];
      if (role === "teacher") {
        teacher = null;
      } else {
        let newStudents = students.filter(
          (student) => student.sid !== socket.id
        );
        students = newStudents;
      }
      delete onlineUsers[socket.id];
    }
    const connected = {
      students,
      teacher,
    };
    console.log(connected);
    io.emit("connected", connected);
    console.log(`${socket.id} disconnected due to ${reason}`);
  });
});

app.get("/results", (req, res) => {
  if (!question) {
    res.sendStatus(404);
    return;
  }
  res.send({
    votes: Object.fromEntries(results),
    participants,
    total,
    question: question.question,
    correct: question.correct,
  });
});

app.get("/teacher", (req, res) => {
  res.send(teacher);
});

app.get("/history", (req, res) => {
  return resultsDB;
});

app.get("/participants", (req, res) => {
  res.send({
    students,
    teacher,
  });
});

server.listen(process.env.PORT || 5000, () =>
  console.log("server running at http://localhost:5000")
);