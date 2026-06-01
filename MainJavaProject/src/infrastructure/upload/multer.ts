const multer = require('multer');
const path = require('path');
const MAX_FILES = 1;

const ALLOWED_MIME = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
]);

const ALLOWED_EXT = new Set(['.xlsx', '.xls', '.csv']);

function fileFilter(_req, file, cb) {
  const ext = path.extname(file.originalname || '').toLowerCase();

  if (!ALLOWED_MIME.has(file.mimetype) || !ALLOWED_EXT.has(ext)) {
    const err = new Error('UNSUPPORTED_FILE_TYPE');
    err.status = 415;
    err.code = 'UNSUPPORTED_FILE_TYPE';
    err.details = [{ message: `Unsupported file type: ${file.mimetype} (${ext})` }];
    return cb(err);
  }

  return cb(null, true);
}

function createUploadMiddleware({ env } = {}) {
  const maxFileSize = env.SECURITY_UPLOAD_MAX_FILE_SIZE;
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxFileSize, files: MAX_FILES },
    fileFilter,
  });
}

function multerErrorHandler({ maxFileSize }) {
  return function handleMulterError(err, _req, _res, next) {
    if (!err) return next();

    if (err instanceof multer.MulterError) {
      const e = new Error('UPLOAD_ERROR');
      e.code = 'UPLOAD_ERROR';
      if (err.code === 'LIMIT_FILE_SIZE') {
        e.status = 413;
        e.details = [{ message: `File too large. Max ${maxFileSize} bytes.` }];
      } else if (err.code === 'LIMIT_FILE_COUNT') {
        e.status = 400;
        e.details = [{ message: `Too many files. Max ${MAX_FILES}.` }];
      } else {
        e.status = 400;
        e.details = [{ message: err.message }];
      }
      return next(e);
    }

    return next(err);
  };
}

module.exports = { createUploadMiddleware, multerErrorHandler, MAX_FILES };
