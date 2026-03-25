/**
 * QA Tool — Validation Engine
 * Implements all 16 validation rules.
 */

const moment = require('moment');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const isEmpty = (value) => {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  return false;
};

const toNumber = (value) => {
  const n = Number(value);
  return isNaN(n) ? null : n;
};

/**
 * Convert a Python strftime format string to a moment.js format string.
 * Only the most common tokens are mapped.
 */
const pythonToMomentFormat = (pyFormat) => {
  const tokenMap = {
    '%Y': 'YYYY',
    '%y': 'YY',
    '%m': 'MM',
    '%d': 'DD',
    '%H': 'HH',
    '%I': 'hh',
    '%M': 'mm',
    '%S': 'ss',
    '%f': 'SSSSSS',
    '%p': 'A',
    '%A': 'dddd',
    '%a': 'ddd',
    '%B': 'MMMM',
    '%b': 'MMM',
    '%j': 'DDDD',
    '%Z': 'z',
    '%z': 'ZZ',
  };

  // All Python strftime tokens are of the form %X where X is a single letter.
  // Build a single-pass regex to avoid double-replacing tokens.
  // Since every token is exactly two chars (%[a-zA-Z]), no regex escaping is needed.
  const tokenRegex = new RegExp(Object.keys(tokenMap).join('|'), 'g');

  return pyFormat.replace(tokenRegex, (match) => {
    const replacement = tokenMap[match];
    return replacement !== undefined ? replacement : match;
  });
};

// ---------------------------------------------------------------------------
// Individual rule checkers — each returns null (pass) or an error object
// ---------------------------------------------------------------------------

/**
 * Rule 1 — has_empty
 * "has_empty": "true"  => empty NOT allowed => error if empty
 * "has_empty": "false" => empty allowed (only warning, treated as pass)
 */
const checkHasEmpty = (value, ruleValue, column) => {
  const notAllowed = String(ruleValue).toLowerCase() === 'true';
  if (notAllowed && isEmpty(value)) {
    return {
      column,
      rule: 'has_empty',
      message: `Column "${column}" must not be empty.`,
      value,
    };
  }
  return null;
};

/**
 * Rule 2 — data_type
 * Supported types: "str", "int", "float", "bool"
 */
const checkDataType = (value, ruleValue, column) => {
  if (isEmpty(value)) return null; // empty handled by has_empty

  const type = String(ruleValue).toLowerCase().trim();

  switch (type) {
    case 'str':
      if (typeof value !== 'string') {
        return {
          column,
          rule: 'data_type',
          message: `Column "${column}" must be a string.`,
          value,
        };
      }
      break;

    case 'int': {
      const strVal = String(value).trim();
      if (!/^-?\d+$/.test(strVal)) {
        return {
          column,
          rule: 'data_type',
          message: `Column "${column}" must be an integer. Got: "${value}".`,
          value,
        };
      }
      break;
    }

    case 'float': {
      const n = toNumber(value);
      if (n === null) {
        return {
          column,
          rule: 'data_type',
          message: `Column "${column}" must be a float/number. Got: "${value}".`,
          value,
        };
      }
      break;
    }

    case 'bool': {
      const boolVals = ['true', 'false', '1', '0', 'yes', 'no'];
      if (!boolVals.includes(String(value).toLowerCase().trim())) {
        return {
          column,
          rule: 'data_type',
          message: `Column "${column}" must be a boolean (true/false/1/0/yes/no). Got: "${value}".`,
          value,
        };
      }
      break;
    }

    default:
      // Unknown type — skip
      break;
  }
  return null;
};

/**
 * Rule 3 — data_length
 * { "specific": "true", "fix_length": "2" }         => exact length
 * { "specific": "false", "grater_length": "10" }     => min length (value.length >= grater_length)
 * { "specific": "false", "less_length": "20" }       => max length (value.length <= less_length)
 */
const checkDataLength = (value, ruleValue, column) => {
  if (isEmpty(value)) return null;

  const strVal = String(value);
  const specific = String(ruleValue.specific).toLowerCase() === 'true';

  if (specific) {
    const fixLen = parseInt(ruleValue.fix_length, 10);
    if (!isNaN(fixLen) && strVal.length !== fixLen) {
      return {
        column,
        rule: 'data_length',
        message: `Column "${column}" must have exactly ${fixLen} characters. Got ${strVal.length}.`,
        value,
      };
    }
  } else {
    if (ruleValue.grater_length !== undefined) {
      const minLen = parseInt(ruleValue.grater_length, 10);
      if (!isNaN(minLen) && strVal.length < minLen) {
        return {
          column,
          rule: 'data_length',
          message: `Column "${column}" must have at least ${minLen} characters. Got ${strVal.length}.`,
          value,
        };
      }
    }
    if (ruleValue.less_length !== undefined) {
      const maxLen = parseInt(ruleValue.less_length, 10);
      if (!isNaN(maxLen) && strVal.length > maxLen) {
        return {
          column,
          rule: 'data_length',
          message: `Column "${column}" must have at most ${maxLen} characters. Got ${strVal.length}.`,
          value,
        };
      }
    }
  }
  return null;
};

// ---------------------------------------------------------------------------
// Shared condition evaluator for depend_header
// ---------------------------------------------------------------------------

/**
 * Check whether a single cell value satisfies the given condition string.
 * Returns true (passes) or false (fails).
 * Conditions: "not_empty" | "empty" | "<exact_value>"
 */
const satisfiesCondition = (value, condition) => {
  const cond = String(condition).toLowerCase().trim();
  if (cond === 'not_empty') return !isEmpty(value);
  if (cond === 'empty') return isEmpty(value);
  // exact value match
  return String(value ?? '').trim() === String(condition).trim();
};

/**
 * Build an error object for a failed depend_header condition.
 */
const dependHeaderError = (col, condition, value, triggerCol) => {
  const cond = String(condition).toLowerCase().trim();
  let message;
  if (cond === 'not_empty') {
    message = `When "${triggerCol}" satisfies its condition, column "${col}" must not be empty.`;
  } else if (cond === 'empty') {
    message = `When "${triggerCol}" satisfies its condition, column "${col}" must be empty. Got: "${value}".`;
  } else {
    message = `When "${triggerCol}" satisfies its condition, column "${col}" must equal "${condition}". Got: "${value}".`;
  }
  return { column: col, rule: 'depend_header', message, value };
};

/**
 * Rule 4 — depend_header (conditional trigger validation)
 *
 * Format: first key = trigger column(s) + condition, remaining keys = dependent columns + conditions.
 * Keys and values may be comma-separated for multi-column groups.
 * Conditions: "not_empty" | "empty" | "<exact_value>"
 *
 * Logic per row:
 *   1. Evaluate the trigger column(s) against their condition(s).
 *   2. If the trigger condition IS satisfied → validate all dependent columns.
 *   3. If the trigger condition is NOT satisfied → skip (return triggered: false).
 *
 * Example:
 *   { "Mrp": "not_empty", "Sale Price": "not_empty", "Final Price": "not_empty" }
 *   → If Mrp is not empty, then Sale Price AND Final Price must also not be empty.
 *   → If Mrp IS empty, the dependent check is skipped entirely.
 *
 * Returns: { triggered: boolean, errors: object[] }
 */
const checkDependHeader = (row, ruleValue) => {
  const entries = Object.entries(ruleValue);
  if (entries.length === 0) return { triggered: false, errors: [] };

  // ---- Step 1: evaluate trigger (first entry) ----
  const [triggerKey, triggerCondValue] = entries[0];
  const triggerColumns = String(triggerKey).split(',').map((c) => c.trim()).filter(Boolean);
  const triggerConditions = String(triggerCondValue).split(',').map((c) => c.trim()).filter(Boolean);
  const triggerColName = triggerColumns[0]; // used in error messages

  const triggerFired = triggerColumns.every((col, i) => {
    const condition = triggerConditions[i] !== undefined ? triggerConditions[i] : triggerConditions[0];
    return condition ? satisfiesCondition(row[col], condition) : true;
  });

  if (!triggerFired) return { triggered: false, errors: [] };

  // ---- Step 2: validate dependents (remaining entries) ----
  const errors = [];
  for (const [depKey, depCondValue] of entries.slice(1)) {
    const depColumns = String(depKey).split(',').map((c) => c.trim()).filter(Boolean);
    const depConditions = String(depCondValue).split(',').map((c) => c.trim()).filter(Boolean);

    depColumns.forEach((col, i) => {
      const condition = depConditions[i] !== undefined ? depConditions[i] : depConditions[0];
      if (!condition) return;
      const value = row[col];
      if (!satisfiesCondition(value, condition)) {
        errors.push(dependHeaderError(col, condition, value, triggerColName));
      }
    });
  }

  return { triggered: true, errors };
};

/**
 * Rule 5 — data_redundant
 * { "value": "Amazon", "Threshold": "50" }
 * If the specified value appears in more than Threshold% of all rows for this column, flag all those rows.
 * This rule is evaluated post-pass (aggregate), so it is handled at the engine level.
 */
// Handled in validateData — see below.

/**
 * Rule 6 — greater_than
 */
const checkGreaterThan = (value, ruleValue, column) => {
  if (isEmpty(value)) return null;
  const n = toNumber(value);
  const threshold = toNumber(ruleValue);
  if (n === null) {
    return {
      column,
      rule: 'greater_than',
      message: `Column "${column}" must be numeric for greater_than check. Got: "${value}".`,
      value,
    };
  }
  if (threshold !== null && n <= threshold) {
    return {
      column,
      rule: 'greater_than',
      message: `Column "${column}" must be greater than ${threshold}. Got: ${n}.`,
      value,
    };
  }
  return null;
};

/**
 * Rule 7 — less_than
 */
const checkLessThan = (value, ruleValue, column) => {
  if (isEmpty(value)) return null;
  const n = toNumber(value);
  const threshold = toNumber(ruleValue);
  if (n === null) {
    return {
      column,
      rule: 'less_than',
      message: `Column "${column}" must be numeric for less_than check. Got: "${value}".`,
      value,
    };
  }
  if (threshold !== null && n >= threshold) {
    return {
      column,
      rule: 'less_than',
      message: `Column "${column}" must be less than ${threshold}. Got: ${n}.`,
      value,
    };
  }
  return null;
};

/**
 * Rule 8 — in_between
 * e.g. "50, 100" => value must be 50 <= x <= 100
 */
const checkInBetween = (value, ruleValue, column) => {
  if (isEmpty(value)) return null;
  const n = toNumber(value);
  if (n === null) {
    return {
      column,
      rule: 'in_between',
      message: `Column "${column}" must be numeric for in_between check. Got: "${value}".`,
      value,
    };
  }

  const parts = String(ruleValue)
    .split(',')
    .map((s) => s.trim());
  if (parts.length < 2) return null;

  const lower = toNumber(parts[0]);
  const upper = toNumber(parts[1]);

  if (lower !== null && upper !== null && (n < lower || n > upper)) {
    return {
      column,
      rule: 'in_between',
      message: `Column "${column}" must be between ${lower} and ${upper}. Got: ${n}.`,
      value,
    };
  }
  return null;
};

/**
 * Rule 9 — double_depend
 * Check multiple columns' values simultaneously as conditions.
 * Format: { "ColA": "valA", "ColB": "valB", ... }
 * All conditions must hold true simultaneously. If any column does NOT match its expected value, flag an error.
 */
const checkDoubleDepend = (row, ruleValue, column) => {
  if (typeof ruleValue !== 'object' || Array.isArray(ruleValue)) return null;

  const errors = [];
  for (const [condCol, expectedVal] of Object.entries(ruleValue)) {
    const actualVal = row[condCol];
    if (String(actualVal).trim() !== String(expectedVal).trim()) {
      errors.push({
        column: condCol,
        rule: 'double_depend',
        message: `double_depend: "${condCol}" expected "${expectedVal}" but got "${actualVal}".`,
        value: actualVal,
      });
    }
  }
  return errors.length > 0 ? errors : null;
};

/**
 * Rule 10 — fix_header
 * e.g. "In stock, Out of stock" — value must be one of these comma-separated options.
 */
const checkFixHeader = (value, ruleValue, column) => {
  if (isEmpty(value)) return null;
  const allowedValues = String(ruleValue)
    .split(',')
    .map((s) => s.trim());
  const strVal = String(value).trim();
  if (!allowedValues.includes(strVal)) {
    return {
      column,
      rule: 'fix_header',
      message: `Column "${column}" must be one of [${allowedValues.join(', ')}]. Got: "${strVal}".`,
      value,
    };
  }
  return null;
};

/**
 * Rule 11 — date_format
 * e.g. "%Y_%m_%d" (Python strftime) => convert to moment.js format and validate.
 */
const checkDateFormat = (value, ruleValue, column) => {
  if (isEmpty(value)) return null;
  const momentFormat = pythonToMomentFormat(String(ruleValue));
  const m = moment(String(value), momentFormat, true); // strict mode
  if (!m.isValid()) {
    return {
      column,
      rule: 'date_format',
      message: `Column "${column}" must match date format "${ruleValue}" (moment: "${momentFormat}"). Got: "${value}".`,
      value,
    };
  }
  return null;
};

/**
 * Rule 12 — other_depend
 * When column A has value X, other columns B, C must also have specific values.
 * Format: { "trigger_col": "trigger_val", "ColB": "expectedValB", "ColC": "expectedValC" }
 * The first entry is the trigger; rest are requirements.
 */
const checkOtherDepend = (row, ruleValue, column) => {
  if (typeof ruleValue !== 'object' || Array.isArray(ruleValue)) return null;

  const entries = Object.entries(ruleValue);
  if (entries.length < 2) return null;

  const [triggerCol, triggerVal] = entries[0];
  const triggerActual = row[triggerCol];

  // Only apply if trigger condition is met
  if (isEmpty(triggerActual) || String(triggerActual).trim() !== String(triggerVal).trim()) {
    return null;
  }

  const errors = [];
  for (const [depCol, expectedVal] of entries.slice(1)) {
    const actualVal = row[depCol];
    if (String(actualVal).trim() !== String(expectedVal).trim()) {
      errors.push({
        column: depCol,
        rule: 'other_depend',
        message: `When "${triggerCol}" is "${triggerVal}", "${depCol}" must be "${expectedVal}". Got: "${actualVal}".`,
        value: actualVal,
      });
    }
  }
  return errors.length > 0 ? errors : null;
};

/**
 * Rule 13 — not_match_found
 * Value must NOT equal the given string/value.
 */
const checkNotMatchFound = (value, ruleValue, column) => {
  if (isEmpty(value)) return null;
  if (String(value).trim() === String(ruleValue).trim()) {
    return {
      column,
      rule: 'not_match_found',
      message: `Column "${column}" must not equal "${ruleValue}". Got: "${value}".`,
      value,
    };
  }
  return null;
};

/**
 * Rule 14 — get_non_ld_indicesc
 * Check all items in a cell are of the specified type.
 * Cell may contain comma/pipe/space-separated items. All must match the type.
 * Format: "int" | "float" | "str"
 */
const checkGetNonLdIndices = (value, ruleValue, column) => {
  if (isEmpty(value)) return null;

  const type = String(ruleValue).toLowerCase().trim();
  // Split cell on common delimiters
  const items = String(value)
    .split(/[,|;\s]+/)
    .filter((s) => s.length > 0);

  const invalidItems = [];
  for (const item of items) {
    const trimmed = item.trim();
    if (type === 'int' && !/^-?\d+$/.test(trimmed)) {
      invalidItems.push(trimmed);
    } else if (type === 'float' && isNaN(Number(trimmed))) {
      invalidItems.push(trimmed);
    }
    // "str" — everything is a string, always passes
  }

  if (invalidItems.length > 0) {
    return {
      column,
      rule: 'get_non_ld_indicesc',
      message: `Column "${column}" contains non-${type} items: [${invalidItems.join(', ')}].`,
      value,
    };
  }
  return null;
};

/**
 * Rule 15 — cell_contains
 * { "contains": "true", "value": "^[A-Z]*$" } => cell must match regex
 * { "contains": "false", "value": "^[A-Z]*$" } => cell must NOT match regex
 */
const checkCellContains = (value, ruleValue, column) => {
  if (isEmpty(value)) return null;

  const mustMatch = String(ruleValue.contains).toLowerCase() === 'true';
  const pattern = ruleValue.value;

  if (!pattern) return null;

  let regex;
  try {
    regex = new RegExp(pattern);
  } catch (e) {
    return {
      column,
      rule: 'cell_contains',
      message: `Invalid regex pattern "${pattern}" for column "${column}".`,
      value,
    };
  }

  const matches = regex.test(String(value));

  if (mustMatch && !matches) {
    return {
      column,
      rule: 'cell_contains',
      message: `Column "${column}" must match pattern "${pattern}". Got: "${value}".`,
      value,
    };
  }

  if (!mustMatch && matches) {
    return {
      column,
      rule: 'cell_contains',
      message: `Column "${column}" must NOT match pattern "${pattern}". Got: "${value}".`,
      value,
    };
  }

  return null;
};

/**
 * Rule 16 — cell_value_start_end_with
 * { "start_end_with": "yes"|"no", "start_with": "https", "end_with": ".com" }
 * If start_end_with == "yes" => value must start with start_with AND end with end_with
 * If start_end_with == "no" => only check the provided start_with / end_with values individually
 */
const checkCellValueStartEndWith = (value, ruleValue, column) => {
  if (isEmpty(value)) return null;

  const strVal = String(value);
  const startEndWith = String(ruleValue.start_end_with || 'no').toLowerCase() === 'yes';
  const startWith = ruleValue.start_with || '';
  const endWith = ruleValue.end_with || '';

  const errors = [];

  if (startEndWith) {
    // Both must be satisfied
    if (startWith && !strVal.startsWith(startWith)) {
      errors.push({
        column,
        rule: 'cell_value_start_end_with',
        message: `Column "${column}" must start with "${startWith}". Got: "${strVal}".`,
        value,
      });
    }
    if (endWith && !strVal.endsWith(endWith)) {
      errors.push({
        column,
        rule: 'cell_value_start_end_with',
        message: `Column "${column}" must end with "${endWith}". Got: "${strVal}".`,
        value,
      });
    }
  } else {
    // Check individually only if value is provided
    if (startWith && !strVal.startsWith(startWith)) {
      errors.push({
        column,
        rule: 'cell_value_start_end_with',
        message: `Column "${column}" must start with "${startWith}". Got: "${strVal}".`,
        value,
      });
    }
    if (endWith && !strVal.endsWith(endWith)) {
      errors.push({
        column,
        rule: 'cell_value_start_end_with',
        message: `Column "${column}" must end with "${endWith}". Got: "${strVal}".`,
        value,
      });
    }
  }

  return errors.length > 0 ? errors : null;
};

// ---------------------------------------------------------------------------
// Main validation function
// ---------------------------------------------------------------------------

/**
 * Validate all rows against the provided rules.
 *
 * @param {object[]} rows    - Array of row objects (key = column name).
 * @param {string[]} headers - Array of column header names.
 * @param {object}   rules   - Rules object: { columnName: { ruleName: ruleValue, ... } }
 * @returns {{
 *   results: object[],
 *   summary: object[],
 *   totalRows: number,
 *   passedRows: number,
 *   failedRows: number
 * }}
 */
const validateData = (rows, headers, rules) => {
  // ------------------------------------------------------------------
  // Pre-compute aggregate data needed for data_redundant rule
  // ------------------------------------------------------------------
  const columnValueCounts = {}; // { col: { value: count } }
  for (const row of rows) {
    for (const col of headers) {
      if (!columnValueCounts[col]) columnValueCounts[col] = {};
      const cellVal = String(row[col] !== undefined ? row[col] : '').trim();
      columnValueCounts[col][cellVal] = (columnValueCounts[col][cellVal] || 0) + 1;
    }
  }

  // Determine which (col, value) pairs exceed the redundancy threshold
  const redundantFlags = new Set(); // Set<`${col}::${value}`>
  for (const [col, colRules] of Object.entries(rules)) {
    if (!colRules.data_redundant) continue;
    const rv = colRules.data_redundant;
    const targetValue = String(rv.value).trim();
    const threshold = parseFloat(rv.Threshold || rv.threshold || 0);
    const count = (columnValueCounts[col] && columnValueCounts[col][targetValue]) || 0;
    const pct = rows.length > 0 ? (count / rows.length) * 100 : 0;
    if (pct > threshold) {
      redundantFlags.add(`${col}::${targetValue}`);
    }
  }

  // ------------------------------------------------------------------
  // Summary tracker: { `${col}::${rule}`: { failCount, passCount } }
  // ------------------------------------------------------------------
  const summaryMap = {};

  const trackSummary = (column, ruleName, passed) => {
    const key = `${column}::${ruleName}`;
    if (!summaryMap[key]) {
      summaryMap[key] = { column, rule: ruleName, failCount: 0, passCount: 0 };
    }
    if (passed) {
      summaryMap[key].passCount += 1;
    } else {
      summaryMap[key].failCount += 1;
    }
  };

  // ------------------------------------------------------------------
  // Row-level validation
  // ------------------------------------------------------------------
  const results = [];

  for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
    const row = rows[rowIdx];
    const rowErrors = [];

    for (const [column, colRules] of Object.entries(rules)) {
      if (!headers.includes(column)) continue; // skip unknown columns

      const cellValue = row[column];

      // ---------- Rule 1: has_empty ----------
      if (colRules.has_empty !== undefined) {
        const err = checkHasEmpty(cellValue, colRules.has_empty, column);
        if (err) {
          rowErrors.push(err);
          trackSummary(column, 'has_empty', false);
        } else {
          trackSummary(column, 'has_empty', true);
        }
      }

      // ---------- Rule 2: data_type ----------
      if (colRules.data_type !== undefined) {
        const err = checkDataType(cellValue, colRules.data_type, column);
        if (err) {
          rowErrors.push(err);
          trackSummary(column, 'data_type', false);
        } else {
          trackSummary(column, 'data_type', true);
        }
      }

      // ---------- Rule 3: data_length ----------
      if (colRules.data_length !== undefined) {
        const err = checkDataLength(cellValue, colRules.data_length, column);
        if (err) {
          rowErrors.push(err);
          trackSummary(column, 'data_length', false);
        } else {
          trackSummary(column, 'data_length', true);
        }
      }

      // ---------- Rule 4: depend_header ----------
      if (colRules.depend_header !== undefined) {
        const { triggered, errors: depErrs } = checkDependHeader(row, colRules.depend_header);

        if (triggered) {
          // Collect dependent column names (all entries after the first)
          const depEntries = Object.entries(colRules.depend_header).slice(1);
          const depCols = [];
          depEntries.forEach(([k]) => {
            String(k).split(',').map((c) => c.trim()).filter(Boolean).forEach((c) => depCols.push(c));
          });

          if (depErrs.length > 0) {
            const failedCols = new Set(depErrs.map((e) => e.column));
            depErrs.forEach((e) => rowErrors.push(e));
            depCols.forEach((c) => trackSummary(c, 'depend_header', !failedCols.has(c)));
          } else {
            depCols.forEach((c) => trackSummary(c, 'depend_header', true));
          }
        }
        // If trigger did not fire, skip entirely — no errors, no summary entry for this row
      }

      // ---------- Rule 5: data_redundant ----------
      if (colRules.data_redundant !== undefined) {
        const targetValue = String(colRules.data_redundant.value || '').trim();
        const cellStr = String(cellValue !== undefined ? cellValue : '').trim();
        const flagKey = `${column}::${targetValue}`;
        if (cellStr === targetValue && redundantFlags.has(flagKey)) {
          rowErrors.push({
            column,
            rule: 'data_redundant',
            message: `Column "${column}" value "${targetValue}" exceeds redundancy threshold of ${colRules.data_redundant.Threshold || colRules.data_redundant.threshold}%.`,
            value: cellValue,
          });
          trackSummary(column, 'data_redundant', false);
        } else {
          trackSummary(column, 'data_redundant', true);
        }
      }

      // ---------- Rule 6: greater_than ----------
      if (colRules.greater_than !== undefined) {
        const err = checkGreaterThan(cellValue, colRules.greater_than, column);
        if (err) {
          rowErrors.push(err);
          trackSummary(column, 'greater_than', false);
        } else {
          trackSummary(column, 'greater_than', true);
        }
      }

      // ---------- Rule 7: less_than ----------
      if (colRules.less_than !== undefined) {
        const err = checkLessThan(cellValue, colRules.less_than, column);
        if (err) {
          rowErrors.push(err);
          trackSummary(column, 'less_than', false);
        } else {
          trackSummary(column, 'less_than', true);
        }
      }

      // ---------- Rule 8: in_between ----------
      if (colRules.in_between !== undefined) {
        const err = checkInBetween(cellValue, colRules.in_between, column);
        if (err) {
          rowErrors.push(err);
          trackSummary(column, 'in_between', false);
        } else {
          trackSummary(column, 'in_between', true);
        }
      }

      // ---------- Rule 9: double_depend ----------
      if (colRules.double_depend !== undefined) {
        const errs = checkDoubleDepend(row, colRules.double_depend, column);
        if (errs) {
          const errArray = Array.isArray(errs) ? errs : [errs];
          errArray.forEach((e) => rowErrors.push(e));
          trackSummary(column, 'double_depend', false);
        } else {
          trackSummary(column, 'double_depend', true);
        }
      }

      // ---------- Rule 10: fix_header ----------
      if (colRules.fix_header !== undefined) {
        const err = checkFixHeader(cellValue, colRules.fix_header, column);
        if (err) {
          rowErrors.push(err);
          trackSummary(column, 'fix_header', false);
        } else {
          trackSummary(column, 'fix_header', true);
        }
      }

      // ---------- Rule 11: date_format ----------
      if (colRules.date_format !== undefined) {
        const err = checkDateFormat(cellValue, colRules.date_format, column);
        if (err) {
          rowErrors.push(err);
          trackSummary(column, 'date_format', false);
        } else {
          trackSummary(column, 'date_format', true);
        }
      }

      // ---------- Rule 12: other_depend ----------
      if (colRules.other_depend !== undefined) {
        const errs = checkOtherDepend(row, colRules.other_depend, column);
        if (errs) {
          const errArray = Array.isArray(errs) ? errs : [errs];
          errArray.forEach((e) => rowErrors.push(e));
          trackSummary(column, 'other_depend', false);
        } else {
          trackSummary(column, 'other_depend', true);
        }
      }

      // ---------- Rule 13: not_match_found ----------
      if (colRules.not_match_found !== undefined) {
        const err = checkNotMatchFound(cellValue, colRules.not_match_found, column);
        if (err) {
          rowErrors.push(err);
          trackSummary(column, 'not_match_found', false);
        } else {
          trackSummary(column, 'not_match_found', true);
        }
      }

      // ---------- Rule 14: get_non_ld_indicesc ----------
      if (colRules.get_non_ld_indicesc !== undefined) {
        const err = checkGetNonLdIndices(cellValue, colRules.get_non_ld_indicesc, column);
        if (err) {
          rowErrors.push(err);
          trackSummary(column, 'get_non_ld_indicesc', false);
        } else {
          trackSummary(column, 'get_non_ld_indicesc', true);
        }
      }

      // ---------- Rule 15: cell_contains ----------
      if (colRules.cell_contains !== undefined) {
        const err = checkCellContains(cellValue, colRules.cell_contains, column);
        if (err) {
          rowErrors.push(err);
          trackSummary(column, 'cell_contains', false);
        } else {
          trackSummary(column, 'cell_contains', true);
        }
      }

      // ---------- Rule 16: cell_value_start_end_with ----------
      if (colRules.cell_value_start_end_with !== undefined) {
        const errs = checkCellValueStartEndWith(
          cellValue,
          colRules.cell_value_start_end_with,
          column
        );
        if (errs) {
          const errArray = Array.isArray(errs) ? errs : [errs];
          errArray.forEach((e) => rowErrors.push(e));
          trackSummary(column, 'cell_value_start_end_with', false);
        } else {
          trackSummary(column, 'cell_value_start_end_with', true);
        }
      }
    }

    results.push({
      rowIndex: rowIdx,
      status: rowErrors.length === 0 ? 'pass' : 'fail',
      errors: rowErrors,
    });
  }

  // ------------------------------------------------------------------
  // Aggregate statistics
  // ------------------------------------------------------------------
  const totalRows = rows.length;
  const failedRows = results.filter((r) => r.status === 'fail').length;
  const passedRows = totalRows - failedRows;

  const summary = Object.values(summaryMap);

  return {
    results,
    summary,
    totalRows,
    passedRows,
    failedRows,
  };
};

// ---------------------------------------------------------------------------
// Streaming validation — for large / GB-scale files
// ---------------------------------------------------------------------------

/**
 * Validate a file without loading all rows into memory at once.
 *
 * @param {Function} createStream  - () => AsyncGenerator  — called once (or twice if
 *                                    data_redundant rules are present).
 * @param {string[]} headers       - Column names.
 * @param {object}   rules         - Same rules object as validateData.
 * @param {object}   [opts]
 * @param {number}   [opts.maxStoredResults=100000] - Max failing rows stored in memory.
 *                                    Statistics (totalRows, failedRows) remain exact.
 * @returns {Promise<{ results, summary, totalRows, passedRows, failedRows }>}
 */
const validateDataStream = async (createStream, headers, rules, opts = {}) => {
  const MAX_STORED = opts.maxStoredResults ?? 5_000;

  // ---- Step 1: pre-scan for data_redundant (requires a full pass) ----
  const redundantFlags = new Set();
  const hasRedundantRule = Object.values(rules).some((r) => r.data_redundant !== undefined);

  if (hasRedundantRule) {
    // Only track columns that actually have a data_redundant rule, not every header
    const redundantCols = new Set(
      Object.entries(rules)
        .filter(([, r]) => r.data_redundant !== undefined)
        .map(([col]) => col)
    );

    const totalRowCount = {};
    let rowCount = 0;

    for await (const item of createStream()) {
      if (item._headers) continue;
      rowCount++;
      for (const col of redundantCols) {
        if (!totalRowCount[col]) totalRowCount[col] = {};
        const v = String(item[col] !== undefined ? item[col] : '').trim();
        totalRowCount[col][v] = (totalRowCount[col][v] || 0) + 1;
      }
    }

    for (const [col, colRules] of Object.entries(rules)) {
      if (!colRules.data_redundant) continue;
      const rv = colRules.data_redundant;
      const targetValue = String(rv.value || '').trim();
      const threshold = parseFloat(rv.Threshold || rv.threshold || 0);
      const count = (totalRowCount[col]?.[targetValue]) || 0;
      const pct = rowCount > 0 ? (count / rowCount) * 100 : 0;
      if (pct > threshold) redundantFlags.add(`${col}::${targetValue}`);
    }
  }

  // ---- Step 2: pre-compile rules (once, before the row loop) ----
  // - filter to columns that exist in headers (O(1) Set lookup)
  // - cache fix_header allowed values as a Set (avoids split+map per row)
  // - pre-compile cell_contains RegExp (avoids new RegExp per row)
  // - pre-convert date_format to moment format (avoids pythonToMomentFormat per row)
  const headerSet = new Set(headers);
  const compiledRules = Object.entries(rules)
    .filter(([col]) => headerSet.has(col))
    .map(([column, colRules]) => {
      const c = { column, colRules };

      if (colRules.fix_header !== undefined) {
        c.fixHeaderAllowed = new Set(
          String(colRules.fix_header).split(',').map((s) => s.trim())
        );
        c.fixHeaderLabel = String(colRules.fix_header);
      }

      if (colRules.cell_contains !== undefined) {
        const pattern = colRules.cell_contains.value;
        if (pattern) {
          c.cellContainsMustMatch = String(colRules.cell_contains.contains).toLowerCase() === 'true';
          try {
            c.cellContainsRegex = new RegExp(pattern);
          } catch (e) {
            c.cellContainsInvalidRegex = true;
          }
        }
      }

      if (colRules.date_format !== undefined) {
        c.momentFormat = pythonToMomentFormat(String(colRules.date_format));
      }

      return c;
    });

  // ---- Step 3: streaming validation pass ----
  const summaryMap = {};
  const trackSummary = (column, ruleName, passed) => {
    const key = `${column}::${ruleName}`;
    if (!summaryMap[key]) summaryMap[key] = { column, rule: ruleName, failCount: 0, passCount: 0 };
    if (passed) summaryMap[key].passCount++; else summaryMap[key].failCount++;
  };

  const results = []; // only stores failing rows (up to MAX_STORED)
  let totalRows = 0;
  let failedRows = 0;
  let rowIdx = 0;

  for await (const item of createStream()) {
    if (item._headers) continue;

    const row = item;
    const rowErrors = [];

    for (const compiled of compiledRules) {
      const { column, colRules } = compiled;
      const cellValue = row[column];

      if (colRules.has_empty !== undefined) {
        const err = checkHasEmpty(cellValue, colRules.has_empty, column);
        if (err) { rowErrors.push(err); trackSummary(column, 'has_empty', false); }
        else trackSummary(column, 'has_empty', true);
      }
      if (colRules.data_type !== undefined) {
        const err = checkDataType(cellValue, colRules.data_type, column);
        if (err) { rowErrors.push(err); trackSummary(column, 'data_type', false); }
        else trackSummary(column, 'data_type', true);
      }
      if (colRules.data_length !== undefined) {
        const err = checkDataLength(cellValue, colRules.data_length, column);
        if (err) { rowErrors.push(err); trackSummary(column, 'data_length', false); }
        else trackSummary(column, 'data_length', true);
      }
      if (colRules.depend_header !== undefined) {
        const { triggered, errors: depErrs } = checkDependHeader(row, colRules.depend_header);
        if (triggered) {
          const depEntries = Object.entries(colRules.depend_header).slice(1);
          const depCols = [];
          depEntries.forEach(([k]) => String(k).split(',').map((c) => c.trim()).filter(Boolean).forEach((c) => depCols.push(c)));
          if (depErrs.length > 0) {
            const failedCols = new Set(depErrs.map((e) => e.column));
            depErrs.forEach((e) => rowErrors.push(e));
            depCols.forEach((c) => trackSummary(c, 'depend_header', !failedCols.has(c)));
          } else {
            depCols.forEach((c) => trackSummary(c, 'depend_header', true));
          }
        }
      }
      if (colRules.data_redundant !== undefined) {
        const targetValue = String(colRules.data_redundant.value || '').trim();
        const cellStr = String(cellValue !== undefined ? cellValue : '').trim();
        const flagKey = `${column}::${targetValue}`;
        if (cellStr === targetValue && redundantFlags.has(flagKey)) {
          rowErrors.push({
            column, rule: 'data_redundant',
            message: `Column "${column}" value "${targetValue}" exceeds redundancy threshold.`, value: cellValue
          });
          trackSummary(column, 'data_redundant', false);
        } else trackSummary(column, 'data_redundant', true);
      }
      if (colRules.greater_than !== undefined) {
        const err = checkGreaterThan(cellValue, colRules.greater_than, column);
        if (err) { rowErrors.push(err); trackSummary(column, 'greater_than', false); }
        else trackSummary(column, 'greater_than', true);
      }
      if (colRules.less_than !== undefined) {
        const err = checkLessThan(cellValue, colRules.less_than, column);
        if (err) { rowErrors.push(err); trackSummary(column, 'less_than', false); }
        else trackSummary(column, 'less_than', true);
      }
      if (colRules.in_between !== undefined) {
        const err = checkInBetween(cellValue, colRules.in_between, column);
        if (err) { rowErrors.push(err); trackSummary(column, 'in_between', false); }
        else trackSummary(column, 'in_between', true);
      }
      if (colRules.double_depend !== undefined) {
        const errs = checkDoubleDepend(row, colRules.double_depend, column);
        if (errs) {
          (Array.isArray(errs) ? errs : [errs]).forEach((e) => rowErrors.push(e));
          trackSummary(column, 'double_depend', false);
        } else trackSummary(column, 'double_depend', true);
      }
      // fix_header: pre-built Set for O(1) lookup instead of split+map per row
      if (colRules.fix_header !== undefined) {
        let fhErr = null;
        if (!isEmpty(cellValue)) {
          const strVal = String(cellValue).trim();
          if (!compiled.fixHeaderAllowed.has(strVal)) {
            fhErr = {
              column, rule: 'fix_header',
              message: `Column "${column}" must be one of [${compiled.fixHeaderLabel}]. Got: "${strVal}".`,
              value: cellValue,
            };
          }
        }
        if (fhErr) { rowErrors.push(fhErr); trackSummary(column, 'fix_header', false); }
        else trackSummary(column, 'fix_header', true);
      }
      // date_format: pre-converted moment format string, no pythonToMomentFormat per row
      if (colRules.date_format !== undefined) {
        let dtErr = null;
        if (!isEmpty(cellValue)) {
          const m = moment(String(cellValue), compiled.momentFormat, true);
          if (!m.isValid()) {
            dtErr = {
              column, rule: 'date_format',
              message: `Column "${column}" must match date format "${colRules.date_format}" (moment: "${compiled.momentFormat}"). Got: "${cellValue}".`,
              value: cellValue,
            };
          }
        }
        if (dtErr) { rowErrors.push(dtErr); trackSummary(column, 'date_format', false); }
        else trackSummary(column, 'date_format', true);
      }
      if (colRules.other_depend !== undefined) {
        const errs = checkOtherDepend(row, colRules.other_depend, column);
        if (errs) {
          (Array.isArray(errs) ? errs : [errs]).forEach((e) => rowErrors.push(e));
          trackSummary(column, 'other_depend', false);
        } else trackSummary(column, 'other_depend', true);
      }
      if (colRules.not_match_found !== undefined) {
        const err = checkNotMatchFound(cellValue, colRules.not_match_found, column);
        if (err) { rowErrors.push(err); trackSummary(column, 'not_match_found', false); }
        else trackSummary(column, 'not_match_found', true);
      }
      if (colRules.get_non_ld_indicesc !== undefined) {
        const err = checkGetNonLdIndices(cellValue, colRules.get_non_ld_indicesc, column);
        if (err) { rowErrors.push(err); trackSummary(column, 'get_non_ld_indicesc', false); }
        else trackSummary(column, 'get_non_ld_indicesc', true);
      }
      // cell_contains: pre-compiled RegExp instead of new RegExp per row
      if (colRules.cell_contains !== undefined) {
        let ccErr = null;
        if (!isEmpty(cellValue)) {
          const pattern = colRules.cell_contains.value;
          if (pattern) {
            if (compiled.cellContainsInvalidRegex) {
              ccErr = {
                column, rule: 'cell_contains',
                message: `Invalid regex pattern "${pattern}" for column "${column}".`,
                value: cellValue,
              };
            } else if (compiled.cellContainsRegex) {
              const matches = compiled.cellContainsRegex.test(String(cellValue));
              if (compiled.cellContainsMustMatch && !matches) {
                ccErr = {
                  column, rule: 'cell_contains',
                  message: `Column "${column}" must match pattern "${pattern}". Got: "${cellValue}".`,
                  value: cellValue,
                };
              } else if (!compiled.cellContainsMustMatch && matches) {
                ccErr = {
                  column, rule: 'cell_contains',
                  message: `Column "${column}" must NOT match pattern "${pattern}". Got: "${cellValue}".`,
                  value: cellValue,
                };
              }
            }
          }
        }
        if (ccErr) { rowErrors.push(ccErr); trackSummary(column, 'cell_contains', false); }
        else trackSummary(column, 'cell_contains', true);
      }
      if (colRules.cell_value_start_end_with !== undefined) {
        const errs = checkCellValueStartEndWith(cellValue, colRules.cell_value_start_end_with, column);
        if (errs) {
          (Array.isArray(errs) ? errs : [errs]).forEach((e) => rowErrors.push(e));
          trackSummary(column, 'cell_value_start_end_with', false);
        } else trackSummary(column, 'cell_value_start_end_with', true);
      }
    }

    totalRows++;
    if (rowErrors.length > 0) {
      failedRows++;
      if (results.length < MAX_STORED) {
        // Cap errors per row at 20; trim value strings to 200 chars to limit doc size
        const trimmedErrors = rowErrors.slice(0, 20).map((e) => ({
          column: e.column || '',
          rule: e.rule || '',
          message: e.message || '',
          value: e.value !== undefined && e.value !== null
            ? String(e.value).slice(0, 200)
            : '',
        }));
        results.push({ rowIndex: rowIdx, status: 'fail', errors: trimmedErrors });
      }
    }
    rowIdx++;
  }

  const passedRows = totalRows - failedRows;
  const summary = Object.values(summaryMap);

  return { results, summary, totalRows, passedRows, failedRows };
};



module.exports = {
  validateData,
  validateDataStream,
  // Export individual checkers for unit testing
  checkHasEmpty,
  checkDataType,
  checkDataLength,
  checkDependHeader,
  checkGreaterThan,
  checkLessThan,
  checkInBetween,
  checkDoubleDepend,
  checkFixHeader,
  checkDateFormat,
  checkOtherDepend,
  checkNotMatchFound,
  checkGetNonLdIndices,
  checkCellContains,
  checkCellValueStartEndWith,
  pythonToMomentFormat,
};
