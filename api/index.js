const path = require("path");
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");

const { connectDB } = require("./_lib/db");
const { signToken, requireAuth } = require("./_lib/auth");
const {
  Student,
  Test,
  Question,
  Result,
  Message,
  Discussion,
  Progress
} = require("./_lib/models");

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    next(error);
  }
});

function normalizeDob(dob = "") {
  return String(dob).replace(/\D/g, "");
}

function isDobFormat(dob = "") {
  return /^\d{8}$/.test(dob);
}

function sanitizeStudent(studentDoc) {
  const student = studentDoc.toObject ? studentDoc.toObject() : studentDoc;
  delete student.passwordHash;
  delete student.__v;
  return student;
}

function shuffleArray(input = []) {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function calculateAndStoreRanks(testId) {
  const rows = await Result.find({ testId }).sort({ score: -1, updatedAt: 1 });
  const bulk = [];
  let currentRank = 0;
  let lastScore = null;

  rows.forEach((row, index) => {
    if (lastScore === null || row.score < lastScore) {
      currentRank = index + 1;
      lastScore = row.score;
    }
    bulk.push({
      updateOne: {
        filter: { _id: row._id },
        update: { $set: { rank: currentRank } }
      }
    });
  });

  if (bulk.length) {
    await Result.bulkWrite(bulk);
  }
}

function ensureAdminPasswordAvailable() {
  if (!process.env.ADMIN_PASSWORD && !process.env.ADMIN_PASSWORD_HASH) {
    process.env.ADMIN_PASSWORD = "admin@123";
  }
}

app.get("/api/health", async (_req, res) => {
  res.json({ ok: true, service: "test-portal-api" });
});

app.post("/api/login", async (req, res, next) => {
  try {
    const { studentId, dob } = req.body;
    if (!studentId || !dob) {
      return res.status(400).json({ error: "studentId and dob are required." });
    }

    const formattedDob = normalizeDob(dob);
    if (!isDobFormat(formattedDob)) {
      return res.status(400).json({ error: "DOB must be DDMMYYYY format." });
    }

    const student = await Student.findOne({ studentId: String(studentId).trim() });
    if (!student) {
      return res.status(404).json({ error: "Student not found." });
    }
    if (student.status === "blocked") {
      return res.status(403).json({ error: "Your account is blocked by admin." });
    }

    const passFromHash = await bcrypt.compare(formattedDob, student.passwordHash);
    const passFromPlain = normalizeDob(student.dob) === formattedDob;

    if (!passFromHash && !passFromPlain) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    const token = signToken({
      sub: student.studentId,
      role: "student",
      class: student.class,
      name: student.name
    });

    return res.json({
      token,
      student: sanitizeStudent(student)
    });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/admin/login", async (req, res, next) => {
  try {
    ensureAdminPasswordAvailable();
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: "Password is required." });

    let valid = false;
    if (process.env.ADMIN_PASSWORD_HASH) {
      valid = await bcrypt.compare(password, process.env.ADMIN_PASSWORD_HASH);
    } else {
      valid = password === process.env.ADMIN_PASSWORD;
    }

    if (!valid) return res.status(401).json({ error: "Invalid admin password." });

    const token = signToken({ sub: "admin", role: "admin", name: "Administrator" });
    return res.json({ token });
  } catch (error) {
    return next(error);
  }
});

app.get("/api/me", requireAuth(["student", "admin"]), async (req, res, next) => {
  try {
    if (req.user.role === "admin") {
      const [students, tests, questions] = await Promise.all([
        Student.countDocuments(),
        Test.countDocuments(),
        Question.countDocuments()
      ]);
      return res.json({
        role: "admin",
        profile: { name: "Administrator" },
        stats: { students, tests, questions }
      });
    }

    const student = await Student.findOne({ studentId: req.user.sub });
    if (!student) return res.status(404).json({ error: "Student not found." });
    if (student.status === "blocked") {
      return res.status(403).json({ error: "Your account is blocked by admin." });
    }

    const results = await Result.find({ studentId: student.studentId });
    const testsTaken = results.length;
    const totalScore = results.reduce((sum, row) => sum + (row.score || 0), 0);
    const averageScore = testsTaken ? Number((totalScore / testsTaken).toFixed(2)) : 0;

    return res.json({
      role: "student",
      student: sanitizeStudent(student),
      stats: { testsTaken, averageScore }
    });
  } catch (error) {
    return next(error);
  }
});

app.get("/api/admin/stats", requireAuth(["admin"]), async (_req, res, next) => {
  try {
    const [totalStudents, totalTests, totalQuestions] = await Promise.all([
      Student.countDocuments(),
      Test.countDocuments(),
      Question.countDocuments()
    ]);
    res.json({ totalStudents, totalTests, totalQuestions });
  } catch (error) {
    next(error);
  }
});

app.post("/api/students", requireAuth(["admin"]), async (req, res, next) => {
  try {
    const { studentId, name, dob, class: studentClass, parentMobile } = req.body;
    if (!studentId || !name || !dob || !studentClass || !parentMobile) {
      return res.status(400).json({
        error: "studentId, name, dob, class and parentMobile are required."
      });
    }

    const formattedDob = normalizeDob(dob);
    if (!isDobFormat(formattedDob)) {
      return res.status(400).json({ error: "DOB must be DDMMYYYY format." });
    }

    const passwordHash = await bcrypt.hash(formattedDob, 10);
    const student = await Student.create({
      studentId: String(studentId).trim(),
      name: String(name).trim(),
      dob: formattedDob,
      passwordHash,
      class: String(studentClass).trim(),
      parentMobile: String(parentMobile).trim(),
      status: "active"
    });

    return res.status(201).json({ student: sanitizeStudent(student) });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: "Student ID already exists." });
    }
    return next(error);
  }
});

app.get("/api/students", requireAuth(["admin"]), async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.class) filter.class = String(req.query.class);

    const students = await Student.find(filter).sort({ createdAt: -1 });
    return res.json({ students: students.map((s) => sanitizeStudent(s)) });
  } catch (error) {
    return next(error);
  }
});

app.put("/api/students/:studentId", requireAuth(["admin"]), async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const payload = { ...req.body };
    const updates = {};

    if (payload.name) updates.name = String(payload.name).trim();
    if (payload.class) updates.class = String(payload.class).trim();
    if (payload.parentMobile) updates.parentMobile = String(payload.parentMobile).trim();
    if (payload.status && ["active", "blocked"].includes(payload.status)) {
      updates.status = payload.status;
    }
    if (payload.dob) {
      const formattedDob = normalizeDob(payload.dob);
      if (!isDobFormat(formattedDob)) {
        return res.status(400).json({ error: "DOB must be DDMMYYYY format." });
      }
      updates.dob = formattedDob;
      updates.passwordHash = await bcrypt.hash(formattedDob, 10);
    }

    const student = await Student.findOneAndUpdate(
      { studentId },
      { $set: updates },
      { new: true }
    );

    if (!student) return res.status(404).json({ error: "Student not found." });
    return res.json({ student: sanitizeStudent(student) });
  } catch (error) {
    return next(error);
  }
});

app.delete("/api/students/:studentId", requireAuth(["admin"]), async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const deleted = await Student.findOneAndDelete({ studentId });
    if (!deleted) return res.status(404).json({ error: "Student not found." });
    await Promise.all([
      Result.deleteMany({ studentId }),
      Progress.deleteMany({ studentId }),
      Message.deleteMany({ $or: [{ fromId: studentId }, { toId: studentId }] })
    ]);
    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/block", requireAuth(["admin"]), async (req, res, next) => {
  try {
    const { studentId, action } = req.body;
    if (!studentId || !["block", "unblock"].includes(action)) {
      return res.status(400).json({ error: "studentId and action(block|unblock) are required." });
    }

    const nextStatus = action === "block" ? "blocked" : "active";
    const student = await Student.findOneAndUpdate(
      { studentId },
      { $set: { status: nextStatus } },
      { new: true }
    );

    if (!student) return res.status(404).json({ error: "Student not found." });
    return res.json({ student: sanitizeStudent(student) });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/tests", requireAuth(["admin"]), async (req, res, next) => {
  try {
    const { testId, title, class: testClass, duration, marks, shuffleQuestions } = req.body;
    if (!testId || !title || !testClass || !duration) {
      return res.status(400).json({ error: "testId, title, class and duration are required." });
    }

    const test = await Test.create({
      testId: String(testId).trim(),
      title: String(title).trim(),
      class: String(testClass).trim(),
      duration: Number(duration),
      marks: {
        correct: Number(marks?.correct ?? 4),
        wrong: Number(marks?.wrong ?? -1),
        skip: Number(marks?.skip ?? 0)
      },
      shuffleQuestions: Boolean(shuffleQuestions)
    });

    return res.status(201).json({ test });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: "Test ID already exists." });
    }
    return next(error);
  }
});

app.get("/api/tests", requireAuth(["student", "admin"]), async (req, res, next) => {
  try {
    const filter = {};
    if (req.user.role === "student") {
      filter.class = req.user.class;
    } else if (req.query.class) {
      filter.class = String(req.query.class);
    }

    const tests = await Test.find(filter).sort({ createdAt: -1 });
    const testIds = tests.map((t) => t.testId);
    const questionCounts = await Question.aggregate([
      { $match: { testId: { $in: testIds } } },
      { $group: { _id: "$testId", count: { $sum: 1 } } }
    ]);

    const countMap = questionCounts.reduce((acc, row) => {
      acc[row._id] = row.count;
      return acc;
    }, {});

    return res.json({
      tests: tests.map((test) => ({
        ...test.toObject(),
        questionCount: countMap[test.testId] || 0
      }))
    });
  } catch (error) {
    return next(error);
  }
});

app.get("/api/tests/:testId", requireAuth(["student", "admin"]), async (req, res, next) => {
  try {
    const test = await Test.findOne({ testId: req.params.testId });
    if (!test) return res.status(404).json({ error: "Test not found." });
    if (req.user.role === "student" && test.class !== req.user.class) {
      return res.status(403).json({ error: "This test is not assigned to your class." });
    }
    const questionCount = await Question.countDocuments({ testId: test.testId });
    return res.json({ test: { ...test.toObject(), questionCount } });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/questions", requireAuth(["admin"]), async (req, res, next) => {
  try {
    const payload = req.body.questions && Array.isArray(req.body.questions)
      ? req.body.questions
      : [req.body];

    const docs = payload.map((item, index) => ({
      testId: String(item.testId || req.body.testId || "").trim(),
      qId: String(item.qId || `Q${Date.now()}_${index + 1}`),
      type: item.type,
      question: {
        en: item.question?.en || item.questionEn || "",
        hi: item.question?.hi || item.questionHi || ""
      },
      options: Array.isArray(item.options) ? item.options : [],
      answer: item.answer,
      imageUrl: item.imageUrl || ""
    }));

    docs.forEach((doc) => {
      if (!doc.testId || !doc.qId || !doc.type || !doc.question.en) {
        throw new Error("Each question requires testId, qId, type, and English text.");
      }
      if (doc.type === "mcq" && doc.options.length < 2) {
        throw new Error("MCQ question requires at least two options.");
      }
    });

    const created = await Question.insertMany(docs, { ordered: false });
    return res.status(201).json({ count: created.length });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: "Duplicate qId for this test." });
    }
    if (error.message.includes("requires")) {
      return res.status(400).json({ error: error.message });
    }
    return next(error);
  }
});

app.get("/api/questions/:testId", requireAuth(["student", "admin"]), async (req, res, next) => {
  try {
    const testId = req.params.testId;
    const test = await Test.findOne({ testId });
    if (!test) return res.status(404).json({ error: "Test not found." });
    if (req.user.role === "student" && test.class !== req.user.class) {
      return res.status(403).json({ error: "This test is not assigned to your class." });
    }

    let questions = await Question.find({ testId }).sort({ createdAt: 1 });
    if (test.shuffleQuestions) {
      questions = shuffleArray(questions);
    }

    const sanitized = questions.map((q) => {
      const base = q.toObject();
      if (req.user.role === "student") delete base.answer;
      return base;
    });

    return res.json({ questions: sanitized, test });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/progress", requireAuth(["student"]), async (req, res, next) => {
  try {
    const { testId, answers, flagged, remainingSeconds } = req.body;
    if (!testId) return res.status(400).json({ error: "testId is required." });

    await Progress.findOneAndUpdate(
      { studentId: req.user.sub, testId },
      {
        $set: {
          answers: answers || {},
          flagged: Array.isArray(flagged) ? flagged : [],
          remainingSeconds: Number(remainingSeconds || 0)
        }
      },
      { upsert: true, new: true }
    );
    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

app.get("/api/progress/:testId", requireAuth(["student"]), async (req, res, next) => {
  try {
    const row = await Progress.findOne({ studentId: req.user.sub, testId: req.params.testId });
    return res.json({ progress: row || null });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/submit", requireAuth(["student"]), async (req, res, next) => {
  try {
    const { testId, answers = {} } = req.body;
    if (!testId) return res.status(400).json({ error: "testId is required." });

    const test = await Test.findOne({ testId });
    if (!test) return res.status(404).json({ error: "Test not found." });
    if (test.class !== req.user.class) {
      return res.status(403).json({ error: "This test is not assigned to your class." });
    }

    const questions = await Question.find({ testId });
    const marks = test.marks || { correct: 4, wrong: -1, skip: 0 };

    let correct = 0;
    let wrong = 0;
    let skipped = 0;
    let score = 0;

    questions.forEach((q) => {
      const answer = answers[q.qId];
      const normalizedAnswer = typeof answer === "string" ? answer.trim() : answer;

      if (normalizedAnswer === undefined || normalizedAnswer === null || normalizedAnswer === "") {
        skipped += 1;
        score += marks.skip;
        return;
      }

      const correctAnswer = q.answer;
      let isCorrect = false;

      if (q.type === "numerical") {
        isCorrect = Number(normalizedAnswer) === Number(correctAnswer);
      } else {
        isCorrect = String(normalizedAnswer) === String(correctAnswer);
      }

      if (isCorrect) {
        correct += 1;
        score += marks.correct;
      } else {
        wrong += 1;
        score += marks.wrong;
      }
    });

    await Result.findOneAndUpdate(
      { studentId: req.user.sub, testId },
      {
        $set: {
          answers,
          score,
          correct,
          wrong,
          skipped
        }
      },
      { upsert: true, new: true }
    );

    await calculateAndStoreRanks(testId);
    const result = await Result.findOne({ studentId: req.user.sub, testId });
    await Progress.deleteOne({ studentId: req.user.sub, testId });

    const top3 = await Result.find({ testId }).sort({ rank: 1, score: -1 }).limit(3);
    return res.json({ result, top3 });
  } catch (error) {
    return next(error);
  }
});

app.get("/api/results", requireAuth(["student", "admin"]), async (req, res, next) => {
  try {
    const { testId, studentId } = req.query;
    const filter = {};

    if (req.user.role === "student") {
      filter.studentId = req.user.sub;
      if (testId) filter.testId = testId;
    } else {
      if (testId) filter.testId = testId;
      if (studentId) filter.studentId = studentId;
    }

    const results = await Result.find(filter).sort({ updatedAt: -1 });

    let top3 = [];
    if (testId) {
      top3 = await Result.find({ testId }).sort({ rank: 1, score: -1 }).limit(3);
    }

    return res.json({ results, top3 });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/message", requireAuth(["student", "admin"]), async (req, res, next) => {
  try {
    const { text, studentId } = req.body;
    if (!text || !String(text).trim()) {
      return res.status(400).json({ error: "Message text is required." });
    }

    let fromRole;
    let fromId;
    let toRole;
    let toId;

    if (req.user.role === "student") {
      fromRole = "student";
      fromId = req.user.sub;
      toRole = "admin";
      toId = "admin";
    } else {
      if (!studentId) {
        return res.status(400).json({ error: "studentId is required for admin messages." });
      }
      fromRole = "admin";
      fromId = "admin";
      toRole = "student";
      toId = String(studentId);
    }

    const message = await Message.create({
      fromRole,
      fromId,
      toRole,
      toId,
      text: String(text).trim()
    });

    return res.status(201).json({ message });
  } catch (error) {
    return next(error);
  }
});

app.get("/api/messages", requireAuth(["student", "admin"]), async (req, res, next) => {
  try {
    let filter;
    if (req.user.role === "student") {
      const sid = req.user.sub;
      filter = {
        $or: [
          { fromRole: "student", fromId: sid, toRole: "admin", toId: "admin" },
          { fromRole: "admin", fromId: "admin", toRole: "student", toId: sid }
        ]
      };
    } else {
      const sid = req.query.studentId;
      if (sid) {
        filter = {
          $or: [
            { fromRole: "student", fromId: sid, toRole: "admin", toId: "admin" },
            { fromRole: "admin", fromId: "admin", toRole: "student", toId: sid }
          ]
        };
      } else {
        filter = {};
      }
    }

    const messages = await Message.find(filter).sort({ createdAt: 1 }).limit(300);
    return res.json({ messages });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/discussions", requireAuth(["admin"]), async (req, res, next) => {
  try {
    const { testId, title, message } = req.body;
    if (!testId || !title || !message) {
      return res.status(400).json({ error: "testId, title and message are required." });
    }

    const test = await Test.findOne({ testId });
    if (!test) return res.status(404).json({ error: "Test not found." });

    const discussion = await Discussion.create({
      testId,
      class: test.class,
      title: String(title).trim(),
      message: String(message).trim(),
      createdBy: "admin"
    });
    return res.status(201).json({ discussion });
  } catch (error) {
    return next(error);
  }
});

app.get("/api/discussions", requireAuth(["student", "admin"]), async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.testId) filter.testId = String(req.query.testId);
    if (req.user.role === "student") {
      filter.class = req.user.class;
    } else if (req.query.class) {
      filter.class = String(req.query.class);
    }

    const discussions = await Discussion.find(filter).sort({ createdAt: -1 }).limit(100);
    return res.json({ discussions });
  } catch (error) {
    return next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  return res.status(500).json({ error: "Internal server error", details: error.message });
});

if (process.env.NODE_ENV !== "production") {
  app.use(express.static(path.join(__dirname, "..")));
}

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

module.exports = app;
