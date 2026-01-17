/**
 * MongoDB input sanitization utility
 * Prevents NoSQL injection attacks by validating and sanitizing user input
 */

export function sanitizeMongoInput(input: unknown): string {
  // Validate input is a string
  if (typeof input !== 'string') {
    throw new Error('Input must be a string');
  }

  const trimmed = input.trim();

  // Validate length
  if (trimmed.length === 0) {
    throw new Error('Input cannot be empty');
  }

  if (trimmed.length > 255) {
    throw new Error('Input length exceeds maximum allowed (255 characters)');
  }

  // Check for MongoDB operator injection attempts
  // Reject if input starts with { or $ which could be MongoDB operators
  if (trimmed.startsWith('{') || trimmed.startsWith('$')) {
    throw new Error('Invalid input: contains MongoDB operators');
  }

  // Check for common MongoDB operators in the string
  const mongoOperators = ['$ne', '$gt', '$lt', '$gte', '$lte', '$in', '$nin', '$regex', '$where', '$exists', '$or', '$and', '$not'];

  const lowerInput = trimmed.toLowerCase();
  for (const operator of mongoOperators) {
    if (lowerInput.includes(operator)) {
      throw new Error('Invalid input: contains MongoDB operators');
    }
  }

  // Return sanitized input
  return trimmed;
}
