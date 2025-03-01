import type { ErrorCode } from './code.js';

export class BlockSuiteError extends Error {
  public code: ErrorCode;
  public isFatal: boolean;
  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = 'BlockSuiteError';
    this.code = code;
    this.isFatal = code >= 10000;
  }
}

export function handleError(error: Error) {
  if (!(error instanceof BlockSuiteError)) {
    throw error;
  }

  if (error.isFatal) {
    throw new Error(
      'A fatal error for BlockSuite occur, please concat the team if you find this.',
      { cause: error }
    );
  }

  console.error(
    'A runtime error for BlockSuite occur, you can ignore this error if it won\t break the user experience.'
  );
  console.error(error.stack);
}

export * from './code.js';
