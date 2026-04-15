const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema(
  {
    studentId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    dob: { type: String, required: true },
    passwordHash: { type: String, required: true },
    class: { type: String, required: true, index: true },
    parentMobile: { type: String, required: true },
    status: {
      type: String,
      enum: ["active", "blocked"],
      default: "active",
      index: true
    }
  },
  { timestamps: true }
);

const testSchema = new mongoose.Schema(
  {
    testId: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    class: { type: String, required: true, index: true },
    duration: { type: Number, required: true },
    marks: {
      correct: { type: Number, required: true, default: 4 },
      wrong: { type: Number, required: true, default: -1 },
      skip: { type: Number, required: true, default: 0 }
    },
    shuffleQuestions: { type: Boolean, default: false }
  },
  { timestamps: true }
);

const questionSchema = new mongoose.Schema(
  {
    testId: { type: String, required: true, index: true },
    qId: { type: String, required: true },
    type: { type: String, enum: ["mcq", "numerical"], required: true },
    question: {
      en: { type: String, required: true },
      hi: { type: String, default: "" }
    },
    options: [{ type: String }],
    answer: { type: mongoose.Schema.Types.Mixed, required: true },
    imageUrl: { type: String, default: "" }
  },
  { timestamps: true }
);

questionSchema.index({ testId: 1, qId: 1 }, { unique: true });

const resultSchema = new mongoose.Schema(
  {
    studentId: { type: String, required: true, index: true },
    testId: { type: String, required: true, index: true },
    answers: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
    score: { type: Number, default: 0 },
    rank: { type: Number, default: null },
    correct: { type: Number, default: 0 },
    wrong: { type: Number, default: 0 },
    skipped: { type: Number, default: 0 }
  },
  { timestamps: true }
);

resultSchema.index({ studentId: 1, testId: 1 }, { unique: true });

const messageSchema = new mongoose.Schema(
  {
    fromRole: { type: String, enum: ["admin", "student"], required: true },
    fromId: { type: String, required: true },
    toRole: { type: String, enum: ["admin", "student"], required: true },
    toId: { type: String, required: true },
    text: { type: String, required: true, maxlength: 1000 }
  },
  { timestamps: true }
);

const discussionSchema = new mongoose.Schema(
  {
    testId: { type: String, required: true, index: true },
    class: { type: String, required: true, index: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    createdBy: { type: String, default: "admin" }
  },
  { timestamps: true }
);

const progressSchema = new mongoose.Schema(
  {
    studentId: { type: String, required: true, index: true },
    testId: { type: String, required: true, index: true },
    answers: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
    flagged: [{ type: String }],
    remainingSeconds: { type: Number, default: 0 }
  },
  { timestamps: true }
);

progressSchema.index({ studentId: 1, testId: 1 }, { unique: true });

const Student = mongoose.models.Student || mongoose.model("Student", studentSchema);
const Test = mongoose.models.Test || mongoose.model("Test", testSchema);
const Question = mongoose.models.Question || mongoose.model("Question", questionSchema);
const Result = mongoose.models.Result || mongoose.model("Result", resultSchema);
const Message = mongoose.models.Message || mongoose.model("Message", messageSchema);
const Discussion = mongoose.models.Discussion || mongoose.model("Discussion", discussionSchema);
const Progress = mongoose.models.Progress || mongoose.model("Progress", progressSchema);

module.exports = {
  Student,
  Test,
  Question,
  Result,
  Message,
  Discussion,
  Progress
};
