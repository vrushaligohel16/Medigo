const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const cors = require('cors');
const mongoose = require('mongoose');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Connect to MongoDB Atlas (no separate config/db.js)
mongoose
  .connect(process.env.MONGO_URI)
  .then((conn) => console.log(`MongoDB Connected: ${conn.connection.host}`))
  .catch((err) => {
    console.error(`MongoDB connection error: ${err.message}`);
    process.exit(1);
  });

// Mount API routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/medicines', require('./routes/medicineRoutes'));
app.use('/api/reminders', require('./routes/reminderRoutes'));
app.use('/api/prescriptions', require('./routes/prescriptionRoutes'));
app.use('/api/health', require('./routes/healthRoutes'));
app.use('/api/appointments', require('./routes/appointmentRoutes'));
app.use('/api/family', require('./routes/familyRoutes'));
app.use('/api/emergency-contacts', require('./routes/emergencyContactRoutes'));
app.use('/api/ai', require('./routes/aiRoutes'));

// Health check for check-server.js and uptime monitors
app.get('/api/status', (req, res) => {
  res.json({ status: 'ok', dbState: mongoose.connection.readyState });
});

// Inline error-handling middleware (no separate errorMiddleware.js)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ message: err.message || 'Server error' });
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`MediGo server running on port ${PORT}`));
