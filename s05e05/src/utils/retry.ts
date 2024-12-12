interface RetryOptions {
  maxAttempts: number;
  delay: number;
  backoff?: number;
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = { maxAttempts: 3, delay: 1000, backoff: 2 }
): Promise<T> {
  let lastError: Error | undefined;
  let currentDelay = options.delay;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === options.maxAttempts) break;
      
      console.warn(
        `Próba ${attempt}/${options.maxAttempts} nie powiodła się: ${lastError.message}`
      );

      await new Promise(resolve => setTimeout(resolve, currentDelay));
      currentDelay *= options.backoff || 1;
    }
  }

  throw new Error(
    `Operacja nie powiodła się po ${options.maxAttempts} próbach: ${lastError?.message}`
  );
} 