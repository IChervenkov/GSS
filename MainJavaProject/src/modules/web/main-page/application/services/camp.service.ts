const { AppError } = require('../../../../../shared/errors/app-error');
const ExcelJS = require('exceljs');
const { MAIN_PERMISSIONS } = require('../../domain/main.permissions');
const { AUDIT_EVENT_NAMES } = require('../../../../../shared/security/audit-event-names');

const CAMP_NAME_PATTERN = /^(?=.*[\p{L}\p{N}])[\p{L}\p{N} _.-]+$/u;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CAMP_TEMPLATE_HEADERS = Object.freeze(['camp id', 'camp name']);
const CAMP_TEMPLATE_FILENAME = 'camp-template.xlsx';
const { invalid, success } = require('../../../../../shared/application/action-result');

function normalizeCampName(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizeHeader(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function isUuid(value) {
  return UUID_PATTERN.test(String(value || '').trim());
}

function buildImportSummary(totalRows) {
  return {
    totalRows,
    processedRows: 0,
    addedCount: 0,
    updatedCount: 0,
    skippedCount: 0,
    errorCount: 0,
    errors: [],
  };
}

function summarizeImportMessage(summary) {
  return [
    `${summary.addedCount} added`,
    `${summary.updatedCount} updated`,
    `${summary.skippedCount} skipped`,
    `${summary.errorCount} errors`,
  ].join(', ');
}

function emitCampImportProgress(realtime, actorUserId, stage, summary, message) {
  realtime.emitCampImportProgress?.(actorUserId, {
    stage,
    totalRows: summary.totalRows,
    processedRows: summary.processedRows,
    addedCount: summary.addedCount,
    updatedCount: summary.updatedCount,
    skippedCount: summary.skippedCount,
    errorCount: summary.errorCount,
    progressPercent:
      summary.totalRows > 0 ? Math.round((summary.processedRows / summary.totalRows) * 100) : 0,
    message,
    errors: summary.errors.slice(-5),
  });
}

async function readCampTemplateRows(fileBuffer) {
  const workbook = new ExcelJS.Workbook();

  try {
    await workbook.xlsx.load(fileBuffer);
  } catch {
    throw new AppError({
      status: 400,
      code: 'INVALID_CAMP_TEMPLATE',
      message: 'The uploaded file must be a valid .xlsx camp template.',
    });
  }

  const worksheet = workbook.getWorksheet('Camps') || workbook.worksheets[0];
  if (!worksheet) {
    throw new AppError({
      status: 400,
      code: 'INVALID_CAMP_TEMPLATE',
      message: 'The uploaded template does not contain a Camps worksheet.',
    });
  }

  const headerRow = worksheet.getRow(1);
  const normalizedHeaders = CAMP_TEMPLATE_HEADERS.map((_, index) =>
    normalizeHeader(headerRow.getCell(index + 1).text),
  );

  if (
    normalizedHeaders.length !== CAMP_TEMPLATE_HEADERS.length ||
    normalizedHeaders.some((header, index) => header !== CAMP_TEMPLATE_HEADERS[index])
  ) {
    throw new AppError({
      status: 400,
      code: 'INVALID_CAMP_TEMPLATE',
      message: 'The camp template headers are invalid. Download a fresh template and try again.',
    });
  }

  const rows = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const campId = String(row.getCell(1).text || '')
      .trim()
      .toLowerCase();
    const campName = normalizeCampName(row.getCell(2).text);

    if (!campId && !campName) return;

    rows.push({ rowNumber, campId, campName });
  });

  return rows;
}

function createCampService({ permissionRepository, repository, realtime, auditLog }) {
  async function assertCampPermission(actorUserId, permissionName, deniedMessage) {
    const [hasFullPermission, hasSpecificPermission] = await Promise.all([
      permissionRepository.userHasPermission(actorUserId, MAIN_PERMISSIONS.full),
      permissionRepository.userHasPermission(actorUserId, permissionName),
    ]);

    if (!hasFullPermission && !hasSpecificPermission) {
      throw new AppError({
        status: 403,
        code: 'PERMISSION_DENIED',
        message: deniedMessage,
      });
    }
  }

  async function getImportPermissions(actorUserId) {
    const [hasFullPermission, hasAddPermission, hasEditPermission] = await Promise.all([
      permissionRepository.userHasPermission(actorUserId, MAIN_PERMISSIONS.full),
      permissionRepository.userHasPermission(actorUserId, MAIN_PERMISSIONS.addCamp),
      permissionRepository.userHasPermission(actorUserId, MAIN_PERMISSIONS.editCamp),
    ]);

    return {
      canAdd: hasFullPermission || hasAddPermission,
      canEdit: hasFullPermission || hasEditPermission,
    };
  }

  async function addCamp({ actorUserId, campName, requestMeta }) {
    await assertCampPermission(
      actorUserId,
      MAIN_PERMISSIONS.addCamp,
      "You don't have permission to add a camp.",
    );

    const createdCamp = await repository.addCamp({ actorUserId, campName });
    realtime.emitCampAdded();
    auditLog?.(AUDIT_EVENT_NAMES.MAIN.CAMP_CREATED, {
      ...requestMeta,
      actorUserId,
      campId: createdCamp.id,
      campName,
    });

    return success({ message: 'Camp added successfully.', camp: createdCamp });
  }

  async function editCamp({ actorUserId, campId, campName, requestMeta }) {
    await assertCampPermission(
      actorUserId,
      MAIN_PERMISSIONS.editCamp,
      "You don't have permission to edit a camp.",
    );

    await repository.editCamp({ actorUserId, campId, campName });
    realtime.emitCampEdited(campId);

    auditLog?.(AUDIT_EVENT_NAMES.MAIN.CAMP_UPDATED, { ...requestMeta, actorUserId, campId, campName });

    return success({ message: 'Camp edited successfully.' });
  }

  async function removeCamp({
    actorUserId,
    campId,
    currentCampId = null,
    mainSession = null,
    requestMeta,
  }) {
    await assertCampPermission(
      actorUserId,
      MAIN_PERMISSIONS.deleteCamp,
      "You don't have permission to delete a camp.",
    );

    const dependencyCounts = await repository.getCampDependencySummary({ campId });
    const blockingDependencies = Object.entries(dependencyCounts).filter(
      ([, count]) => Number(count) > 0,
    );

    if (blockingDependencies.length) {
      throw new AppError({
        status: 409,
        code: 'CAMP_DELETE_BLOCKED',
        message:
          'This camp cannot be deleted until all dependent records are removed or reassigned.',
        details: blockingDependencies.map(([name, count]) => `${name}: ${count}`),
      });
    }

    await repository.deleteCamp({ actorUserId, campId });

    if (mainSession && currentCampId && String(currentCampId) === String(campId)) {
      mainSession.clearCurrentCamp();
      await mainSession.save();
    }

    realtime.emitCampDeleted(campId);

    auditLog?.(AUDIT_EVENT_NAMES.MAIN.CAMP_DELETED, { ...requestMeta, actorUserId, campId });

    return success({ message: 'Camp removed successfully.' });
  }

  async function downloadCampTemplate() {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Global Support System';
    workbook.created = new Date();

    const instructionsSheet = workbook.addWorksheet('Instructions');
    instructionsSheet.columns = [{ width: 110 }];
    instructionsSheet.addRows([
      ['Use the Camps sheet to add or update camps in bulk.'],
      ['Leave Camp ID blank only when creating a new camp.'],
      ['Provide an existing Camp ID to rename that camp.'],
      ['Camp Name is required and must be unique.'],
      ['Do not rename sheets, reorder columns, or change the header row in the Camps sheet.'],
      ['Save the completed file as .xlsx before uploading it back to the system.'],
    ]);

    const campsSheet = workbook.addWorksheet('Camps');
    campsSheet.columns = [
      { header: 'Camp ID', key: 'campId', width: 40 },
      { header: 'Camp Name', key: 'campName', width: 36 },
    ];
    campsSheet.getRow(1).font = { bold: true };

    return {
      status: 200,
      fileName: CAMP_TEMPLATE_FILENAME,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: await workbook.xlsx.writeBuffer(),
    };
  }

  async function importCamps({ actorUserId, fileBuffer, fileName, requestMeta }) {
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new AppError({
        status: 400,
        code: 'CAMP_TEMPLATE_REQUIRED',
        message: 'Select a camp template file before uploading.',
      });
    }

    if (
      !String(fileName || '')
        .toLowerCase()
        .endsWith('.xlsx')
    ) {
      throw new AppError({
        status: 400,
        code: 'INVALID_CAMP_TEMPLATE',
        message: 'Only .xlsx camp template files are supported.',
      });
    }

    const permissions = await getImportPermissions(actorUserId);
    if (!permissions.canAdd && !permissions.canEdit) {
      throw new AppError({
        status: 403,
        code: 'PERMISSION_DENIED',
        message: "You don't have permission to import camp changes.",
      });
    }

    const rows = await readCampTemplateRows(fileBuffer);
    if (rows.length === 0) {
      throw new AppError({
        status: 400,
        code: 'EMPTY_CAMP_TEMPLATE',
        message: 'The uploaded template does not contain any camp rows to process.',
      });
    }

    const summary = buildImportSummary(rows.length);
    const seenCampIds = new Set();
    const seenNewCampNames = new Set();
    emitCampImportProgress(realtime, actorUserId, 'processing', summary, 'Preparing import…');

    for (const row of rows) {
      const campId = String(row.campId || '')
        .trim()
        .toLowerCase();
      const campName = normalizeCampName(row.campName);

      let rowMessage = '';

      if (!campName) {
        summary.errorCount += 1;
        summary.errors.push({ rowNumber: row.rowNumber, message: 'Camp Name is required.' });
      } else if (!CAMP_NAME_PATTERN.test(campName) || campName.length < 2 || campName.length > 64) {
        summary.errorCount += 1;
        summary.errors.push({
          rowNumber: row.rowNumber,
          message: 'Camp Name must be 2-64 characters and contain only supported characters.',
        });
      } else if (campId && !isUuid(campId)) {
        summary.errorCount += 1;
        summary.errors.push({
          rowNumber: row.rowNumber,
          message: 'Camp ID must be a valid UUID when provided.',
        });
      } else if (campId && seenCampIds.has(campId)) {
        summary.errorCount += 1;
        summary.errors.push({
          rowNumber: row.rowNumber,
          message: `Camp ID ${campId} is duplicated in the uploaded file.`,
        });
      } else if (!campId && seenNewCampNames.has(campName.toLowerCase())) {
        summary.errorCount += 1;
        summary.errors.push({
          rowNumber: row.rowNumber,
          message: `Camp Name "${campName}" is duplicated in the uploaded file.`,
        });
      } else {
        try {
          if (campId) {
            seenCampIds.add(campId);

            if (!permissions.canEdit) {
              throw new AppError({
                status: 403,
                code: 'PERMISSION_DENIED',
                message: 'You do not have permission to edit camps.',
              });
            }

            const existingCamp = await repository.findCampById(campId);
            if (!existingCamp) {
              throw new AppError({
                status: 404,
                code: 'CAMP_NOT_FOUND',
                message: `Camp ${campId} was not found.`,
              });
            }

            const duplicateByName = await repository.findCampByName(campName);
            if (duplicateByName && String(duplicateByName.id) !== String(campId)) {
              throw new AppError({
                status: 409,
                code: 'DUPLICATE_DATA',
                message: `Camp name "${campName}" already exists.`,
              });
            }

            if (normalizeCampName(existingCamp.name).toLowerCase() === campName.toLowerCase()) {
              summary.skippedCount += 1;
              rowMessage = `Row ${row.rowNumber} skipped. Camp "${campName}" was unchanged.`;
            } else {
              await repository.editCamp({ actorUserId, campId, campName });
              summary.updatedCount += 1;
              rowMessage = `Row ${row.rowNumber} updated to "${campName}".`;
            }
          } else {
            seenNewCampNames.add(campName.toLowerCase());

            if (!permissions.canAdd) {
              throw new AppError({
                status: 403,
                code: 'PERMISSION_DENIED',
                message: 'You do not have permission to add camps.',
              });
            }

            const duplicateByName = await repository.findCampByName(campName);
            if (duplicateByName) {
              throw new AppError({
                status: 409,
                code: 'DUPLICATE_DATA',
                message: `Camp name "${campName}" already exists. Provide its Camp ID to edit it.`,
              });
            }

            await repository.addCamp({ actorUserId, campName });
            summary.addedCount += 1;
            rowMessage = `Row ${row.rowNumber} added "${campName}".`;
          }
        } catch (error) {
          summary.errorCount += 1;
          summary.errors.push({
            rowNumber: row.rowNumber,
            message: error?.message || 'The camp could not be processed.',
          });
        }
      }

      summary.processedRows += 1;
      emitCampImportProgress(
        realtime,
        actorUserId,
        'processing',
        summary,
        rowMessage || `Processed row ${summary.processedRows} of ${summary.totalRows}.`,
      );
    }

    if (summary.addedCount > 0 || summary.updatedCount > 0) {
      realtime.emitCampAdded?.();
    }

    auditLog?.(AUDIT_EVENT_NAMES.MAIN.CAMP_IMPORTED, {
      ...requestMeta,
      actorUserId,
      totalRows: summary.totalRows,
      addedCount: summary.addedCount,
      updatedCount: summary.updatedCount,
      skippedCount: summary.skippedCount,
      errorCount: summary.errorCount,
    });

    const message = summarizeImportMessage(summary);
    const stage =
      summary.errorCount > 0 && summary.addedCount === 0 && summary.updatedCount === 0
        ? 'failed'
        : 'completed';
    emitCampImportProgress(realtime, actorUserId, stage, summary, message);

    return (stage === 'failed' ? invalid : success)({
      message,
      summary,
    });
  }

  return {
    addCamp,
    editCamp,
    removeCamp,
    downloadCampTemplate,
    importCamps,
  };
}

module.exports = {
  CAMP_TEMPLATE_FILENAME,
  createCampService,
};
