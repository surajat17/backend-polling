const express = require('express');
const cors = require('cors');
const http = require('http');
const socketio = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketio(server);

const resultsDB = [];
const onlineUsers = {};
const results = new Map();

let students = [];
let teacher = null;
let question = null;
let participants = 0;
let total = 0;
app.use(cors({ origin: '*' }));

io.on('connect', handleConnect);

function handleConnect(socket) {
  console.log(`${socket.id} connected`);

  socket.on('join', handleJoin);

  socket.on('submit-question', handleSubmitQuestion);

  socket.on('submit-answer', handleSubmitAnswer);

  socket.on('kick', handleKick);

  socket.on('message', handleMessage);

  socket.on('disconnect', handleDisconnect);
}

function handleJoin({ role, user }, callback) {
  onlineUsers[this.id] = { role, user };
  if (role === 'teacher') {
    teacher = user;
    resultsDB.length = 0;
  } else {
    students.push(user);
    students = students.filter((v, i, a) => a.findIndex((v2) => v2.sid === v.sid) === i);
  }
  const connected = {
    students,
    teacher,
  };
  console.log(connected);
  io.emit('connected', connected);
  callback();
}

function handleSubmitQuestion(data, callback) {
  results.clear();
  total = 0;
  question = data;
  data.options.forEach((opt) => {
    results.set(opt, 0);
  });
  participants = students.length;
  io.emit('question', question);
  callback();
}

function handleSubmitAnswer(data, callback) {
  if (data !== 'Not answered') results.set(data, results.get(data) + 1);
  total++;
  const res = {
    votes: Object.fromEntries(results),
    participants,
    total,
    question: question.question,
    correct: question.correct,
  };
  io.emit('results', res);

  if (total === participants) {
    resultsDB.push(res);
  }

  callback();
}

function handleKick(sid, callback) {
  io.to(sid).emit('kick');
  callback();
}

function handleMessage(message) {
  io.emit('message', message);
}

function handleDisconnect(reason) {
  if (onlineUsers[this.id]) {
    const { role } = onlineUsers[this.id];
    if (role === 'teacher') {
      teacher = null;
    } else {
      let newStudents = students.filter((student) => student.sid !== this.id);
      students = newStudents;
    }
    delete onlineUsers[this.id];
  }
  const connected = {
    students,
    teacher,
  };
  console.log(connected);
  io.emit('connected', connected);
  console.log(`${this.id} disconnected due to ${reason}`);
}

app.get('/results', handleGetResults);

function handleGetResults(req, res) {
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
}

app.get('/teacher', handleGetTeacher);

function handleGetTeacher(req, res) {
  res.send(teacher);
}

app.get('/history', handleGetHistory);

function handleGetHistory(req, res) {
  res.send(resultsDB);
}

app.get('/participants', handleGetParticipants);

function handleGetParticipants(req, res) {
  res.send({
    students,
    teacher,
  });
}

server.listen(process.env.PORT || 5000, () =>
  console.log("server running at http://localhost:5000")
);
