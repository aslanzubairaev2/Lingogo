# API Documentation

## Overview

This API provides endpoints for managing Learning phrases and categories for a language learning application. It uses Supabase as the database and is built with Express.js.

**Base URL:** `http://localhost:3001/api` (or as configured in environment)

**Authentication:** Not implemented (uses Supabase client directly)

## Endpoints

### Health Check

#### GET /api/health

Checks the health status of the server.

**Response (200 OK):**
```json
{
  "status": "ok",
  "timestamp": "2025-10-01T12:00:00.000Z"
}
```

### Initial Data

#### GET /api/initial-data

Retrieves all categories and phrases with additional frontend-specific fields for phrases.

**Response (200 OK):**
```json
{
  "categories": [
    {
      "id": 1,
      "name": "Basics",
      "color": "#ff0000",
      "is_foundational": true
    }
  ],
  "phrases": [
    {
      "id": 1,
      "native": "привет",
      "learning": "hallo",
      "category": 1,
      "transcription": "halo",
      "context": "Greeting",
      "masteryLevel": 0,
      "lastReviewedAt": null,
      "nextReviewAt": 1640995200000,
      "knowCount": 0,
      "knowStreak": 0,
      "isMastered": false,
      "lapses": 0
    }
  ]
}
```

**Error Response (500):**
```json
{
  "error": "Failed to fetch initial data",
  "details": "Error message"
}
```

#### POST /api/initial-data

Loads initial data from a predefined JSON file into the database. This endpoint is used to populate the database with default categories and phrases.

**Response (200 OK):**
```json
{
  "message": "Initial data loaded successfully"
}
```

**Error Response (500):**
```json
{
  "error": "Failed to load initial data",
  "details": "Error message"
}
```

### Phrases

#### POST /api/phrases

Creates a new phrase.

**Request Body:**
```json
{
  "native": "спасибо",
  "learning": "danke",
  "category_id": 1
}
```

**Validation:**
- `native`: Required, non-empty string
- `learning`: Required, non-empty string
- `category_id`: Required, number

**Response (201 Created):**
```json
{
  "id": 1,
  "native": "спасибо",
  "learning": "danke",
  "category_id": 1
}
```

**Error Response (400 - Validation Error):**
```json
{
  "error": "Native text is required and must be a non-empty string"
}
```

**Error Response (500):**
```json
{
  "error": "Failed to create phrase",
  "details": "Error message"
}
```

#### PUT /api/phrases/:id

Updates an existing phrase.

**Path Parameters:**
- `id` (number): Phrase ID

**Request Body:**
```json
{
  "native": "пожалуйста",
  "learning": "bitte",
  "category_id": 1
}
```

**Validation:**
- `native`: Required, non-empty string
- `learning`: Required, non-empty string
- `category_id`: Required, number

**Response (200 OK):**
```json
{
  "id": 1,
  "native": "пожалуйста",
  "learning": "bitte",
  "category_id": 1
}
```

**Error Response (400 - Validation Error):**
```json
{
  "error": "Native text is required and must be a non-empty string"
}
```

**Error Response (500):**
```json
{
  "error": "Failed to update phrase",
  "details": "Error message"
}
```

#### DELETE /api/phrases/:id

Deletes a phrase.

**Path Parameters:**
- `id` (number): Phrase ID

**Response (204 No Content):** Empty body

**Error Response (500):**
```json
{
  "error": "Failed to delete phrase",
  "details": "Error message"
}
```

### Categories

#### POST /api/categories

Creates a new category.

**Request Body:**
```json
{
  "name": "Verbs",
  "color": "#00ff00",
  "is_foundational": false
}
```

**Validation:**
- `name`: Required, non-empty string
- `color`: Required, valid hex color code (e.g., #00FF00)

**Response (201 Created):**
```json
{
  "id": 1,
  "name": "Verbs",
  "color": "#00ff00",
  "is_foundational": false
}
```

**Error Response (400 - Validation Error):**
```json
{
  "error": "Color is required and must be a valid hex color code"
}
```

**Error Response (500):**
```json
{
  "error": "Failed to create category",
  "details": "Error message"
}
```

#### PUT /api/categories/:id

Updates an existing category.

**Path Parameters:**
- `id` (number): Category ID

**Request Body:**
```json
{
  "name": "Updated Verbs",
  "color": "#0000ff"
}
```

**Validation:**
- `name`: Required, non-empty string
- `color`: Required, valid hex color code (e.g., #0000FF)

**Response (200 OK):**
```json
{
  "id": 1,
  "name": "Updated Verbs",
  "color": "#0000ff",
  "is_foundational": false
}
```

**Error Response (400 - Validation Error):**
```json
{
  "error": "Color is required and must be a valid hex color code"
}
```

**Error Response (500):**
```json
{
  "error": "Failed to update category",
  "details": "Error message"
}
```

#### DELETE /api/categories/:id

Deletes a category. If `migrationTargetId` is provided in the request body, associated phrases are moved to that category. Otherwise, associated phrases are deleted.

**Path Parameters:**
- `id` (number): Category ID

**Request Body (optional):**
```json
{
  "migrationTargetId": 2
}
```

**Validation:**
- `migrationTargetId`: If provided, must be a positive number

**Response (204 No Content):** Empty body

**Error Response (400 - Validation Error):**
```json
{
  "error": "Migration target ID must be a positive number if provided"
}
```

**Error Response (500):**
```json
{
  "error": "Failed to delete category",
  "details": "Error message"
}
```

## Data Models

### Phrase
- `id` (number): Unique identifier
- `native` (string): Native text
- `learning` (string): Learning text
- `category_id` (number): Reference to category
- `transcription` (string, optional): Pronunciation guide
- `context` (string, optional): Usage context

### Category
- `id` (number): Unique identifier
- `name` (string): Category name
- `color` (string): Hex color code
- `is_foundational` (boolean): Whether it's a foundational category

## Error Handling

All endpoints return errors in the following format:
```json
{
  "error": "Error message",
  "details": "Detailed error information"
}
```

Common HTTP status codes:
- 200: Success
- 201: Created
- 204: No Content
- 400: Bad Request (validation errors)
- 500: Internal Server Error

## Middleware

The API uses several middleware for enhanced functionality:

- **CORS**: Enables cross-origin requests
- **JSON Parser**: Parses incoming JSON payloads
- **Error Handler**: Centralized error handling and logging
- **Rate Limiter**: Limits the number of requests per IP address
- **Validation**: Validates incoming request data

## Validation

The API validates incoming request data to ensure data integrity. Validation is applied to POST and PUT requests for phrases and categories, and to DELETE requests for categories when migration is involved.

### Validation Rules

#### Phrases (POST /api/phrases, PUT /api/phrases/:id)
- `native`: Required, must be a non-empty string
- `learning`: Required, must be a non-empty string
- `category_id`: Required, must be a number

#### Categories (POST /api/categories, PUT /api/categories/:id)
- `name`: Required, must be a non-empty string
- `color`: Required, must be a valid hex color code (e.g., #FF0000)

#### Categories (DELETE /api/categories/:id)
- `migrationTargetId`: Optional, but if provided, must be a positive number

### Validation Error Response
If validation fails, the API returns a 400 Bad Request status with the following format:
```json
{
  "error": "Validation error message",
  "details": undefined
}
```

## Testing

Run tests with: `npm test`

Tests cover all endpoints with success and error scenarios.