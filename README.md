# QA Testing Platform

A full-stack MERN application for validating CSV/Excel data against configurable rules.

## Prerequisites

- Node.js 18+
- MongoDB running locally on port 27017

## Setup & Run

### Backend
```bash
cd backend
npm install
npm run dev       # or: npm start
# Runs on http://localhost:5000
```

### Frontend
```bash
cd frontend
npm install
npm start
# Runs on http://localhost:3000
```

## Workflow

1. **Upload** a `.csv`, `.xlsx`, or `.xls` file on the Upload page
2. **Configure Rules** — select columns and assign validation rules
3. **Run Validation** — the engine checks every row against your rules
4. **View Results** — pass/fail summary, per-column breakdown, downloadable report

## Supported Validation Rules (16)

| Rule | Description |
|------|-------------|
| `has_empty` | Required field check — flag empty cells |
| `data_type` | Type check: `str`, `int`, `float`, `bool` |
| `data_length` | Exact, min, or max character length |
| `depend_header` | Conditional check based on another column's value |
| `data_redundant` | Duplicate value percentage threshold |
| `greater_than` | Numeric value must exceed threshold |
| `less_than` | Numeric value must be below threshold |
| `in_between` | Numeric value within a range |
| `double_depend` | Multiple column conditions must hold simultaneously |
| `fix_header` | Value must be one of allowed values |
| `date_format` | Date must match a strftime format string |
| `other_depend` | When trigger column equals value, other columns must match |
| `not_match_found` | Value must NOT equal the given string |
| `get_non_ld_indicesc` | All items in cell must be of specified type |
| `cell_contains` | Regex match/no-match check |
| `cell_value_start_end_with` | Value must start/end with given string |

## API Endpoints

| Method | URL | Description |
|--------|-----|-------------|
| POST | `/api/upload` | Upload file (multipart/form-data, field: `file`) |
| GET | `/api/upload` | List all uploads |
| GET | `/api/upload/:id` | Get upload by ID |
| POST | `/api/validate` | Run validation `{ uploadId, rules }` |
| GET | `/api/validate/report/:id` | Get validation report |
| GET | `/api/validate/report/:id/download` | Download report as CSV |
