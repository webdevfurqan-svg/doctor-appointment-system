require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const bcrypt = require("bcryptjs");

const Doctor = require("./models/Doctor");
const Appointment = require("./models/Appointment");
const requireDoctorLogin = require("./middleware/auth");

const app = express();


let isConnected = false;
const connectDB = async () => {
  if (isConnected || mongoose.connection.readyState === 1) return;
  try {
    await mongoose.connect(process.env.MONGO_URI);
    isConnected = true;
    console.log("MongoDB connected");
  } catch (err) {
    console.log("MongoDB connection error: " + err);
  }
};
connectDB();

app.set("view engine", "ejs");
app.set("trust proxy", 1); 
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI,
    collectionName: "sessions",
    ttl: 14 * 24 * 60 * 60
  }),
  cookie: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 14 * 24 * 60 * 60 * 1000
  }
}));

app.get("/", async (req, res) => {
  const doctors = await Doctor.find();
  res.render("index", { doctors: doctors });
});

app.get("/book", async (req, res) => {
  const doctors = await Doctor.find();
  const success = req.query.success ? "Appointment booked successfully." : null;
  res.render("book", { doctors: doctors, error: null, success: success });
});

app.post("/book", async (req, res) => {
  try {
    const { patientName, doctorId, date } = req.body;

    if (!patientName || !doctorId || !date) {
      const doctors = await Doctor.find();
      return res.render("book", {
        doctors: doctors,
        error: "All fields are required.",
        success: null
      });
    }

    const newAppointment = new Appointment({
      patientName: patientName,
      doctorId: doctorId,
      date: date
    });

    await newAppointment.save();

    res.redirect("/book?success=true");
  } catch (err) {
    console.log("Appointment booking error: " + err);
    const doctors = await Doctor.find();
    res.render("book", {
      doctors: doctors,
      error: "Something went wrong. Please try again.",
      success: null
    });
  }
});

app.get("/register", (req, res) => {
  res.render("register", { error: null });
});

app.post("/register", async (req, res) => {
  try {
    const { name, email, password, specialization } = req.body;

    if (!name || !email || !password || !specialization) {
      return res.render("register", { error: "All fields are required." });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existingDoctor = await Doctor.findOne({ email: normalizedEmail });
    if (existingDoctor) {
      return res.render("register", { error: "Email is already registered." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newDoctor = new Doctor({
      name: name,
      email: normalizedEmail,
      password: hashedPassword,
      specialization: specialization
    });

    await newDoctor.save();

    res.redirect("/login");
  } catch (err) {
    console.log("Register error: " + err);
    res.render("register", { error: "Something went wrong. Please try again." });
  }
});

app.get("/login", (req, res) => {
  res.render("login", { error: null });
});

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.render("login", { error: "Invalid email or password." });
    }

    const doctor = await Doctor.findOne({ email: email.toLowerCase().trim() });
    if (!doctor) {
      return res.render("login", { error: "Invalid email or password." });
    }

    const isMatch = await bcrypt.compare(password, doctor.password);
    if (!isMatch) {
      return res.render("login", { error: "Invalid email or password." });
    }

    req.session.doctorId = doctor._id;

    res.redirect("/dashboard");
  } catch (err) {
    console.log("Login error: " + err);
    res.render("login", { error: "Something went wrong. Please try again." });
  }
});

app.get("/dashboard", requireDoctorLogin, async (req, res) => {
  const appointments = await Appointment.find({ doctorId: req.session.doctorId });
  res.render("dashboard", { appointments: appointments, loggedIn: true });
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log("Server running on http://localhost:" + PORT);
  });
}

module.exports = app;