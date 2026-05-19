import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { env } from '../configs/env.js';

// Ensure upload directories exist
const dirs = ['uploads/resumes', 'uploads/csv'];
dirs.forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folder = file.fieldname === 'resume' ? 'uploads/resumes' : 'uploads/csv';
    cb(null, folder);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = {
    resume: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    csv: [
      'text/csv',
      'application/vnd.ms-excel',
      'text/plain',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ],
  };

  const allowed = allowedTypes[file.fieldname] || allowedTypes.resume;
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type for ${file.fieldname}`), false);
  }
};

export const uploadMiddleware = multer({
  storage,
  fileFilter,
  limits: { fileSize: env.maxFileSize },
});
