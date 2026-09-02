function requireDoctorLogin(req, res, next) {
  if (!req.session.doctorId) {
    return res.redirect("/login");
  }
  next();
}

module.exports = requireDoctorLogin;