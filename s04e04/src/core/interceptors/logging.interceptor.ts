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
    
    console.log('\n===================================');
    console.log(`🕒 [${timestamp}]`);
    console.log(`📨 Request: ${method} ${url}`);
    console.log('📝 Body:', JSON.stringify(requestBody, null, 2));

    return next.handle().pipe(
      tap((response) => {
        const executionTime = Date.now() - now.getTime();
        console.log('📤 Response:', JSON.stringify(response, null, 2));
        console.log(`⏱️  Execution time: ${executionTime}ms`);
        console.log('===================================\n');
      }),
    );
  }
} 