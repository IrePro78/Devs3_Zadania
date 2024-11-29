import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private static requestCount = 0;
  private static requestHistory: Array<{
    timestamp: string;
    method: string;
    url: string;
    body: any;
    response?: any;
    executionTime?: number;
  }> = [];

  public intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;
    const url = request.url;
    const now = new Date();
    const timestamp = now.toISOString();
    const requestBody = request.body;
    
    LoggingInterceptor.requestCount++;
    
    console.log('\n===================================');
    console.log(`🔢 Request number: ${LoggingInterceptor.requestCount}`);
    console.log(`🕒 [${timestamp}]`);
    console.log(`📨 Request: ${method} ${url}`);
    console.log('📝 Body:', JSON.stringify(requestBody, null, 2));

    return next.handle().pipe(
      tap((response) => {
        const executionTime = Date.now() - now.getTime();
        
        // Dodaj request do historii
        LoggingInterceptor.requestHistory.push({
          timestamp,
          method,
          url,
          body: requestBody,
          response,
          executionTime,
        });

        console.log('📤 Response:', JSON.stringify(response, null, 2));
        console.log(`⏱️  Execution time: ${executionTime}ms`);
        console.log('\n📊 Request Statistics:');
        console.log(`Total requests received: ${LoggingInterceptor.requestCount}`);
        console.log(`Request history length: ${LoggingInterceptor.requestHistory.length}`);
        console.log('===================================\n');

        // Co 5 requestów wyświetl pełną historię
        if (LoggingInterceptor.requestCount % 5 === 0) {
          console.log('\n🔍 Last 5 requests history:');
          const lastFiveRequests = LoggingInterceptor.requestHistory.slice(-5);
          lastFiveRequests.forEach((req, index) => {
            console.log(`\nRequest #${LoggingInterceptor.requestCount - 4 + index}:`);
            console.log(`Time: ${req.timestamp}`);
            console.log(`Method: ${req.method} ${req.url}`);
            console.log('Body:', JSON.stringify(req.body, null, 2));
            console.log('Response:', JSON.stringify(req.response, null, 2));
            console.log(`Execution time: ${req.executionTime}ms`);
          });
        }
      }),
    );
  }
} 