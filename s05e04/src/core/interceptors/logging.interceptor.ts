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
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    console.log('\n=== INTERCEPTOR START ===');
    
    const request = context.switchToHttp().getRequest();
    const { method, url, body } = request;
    
    console.log(`Metoda: ${method} ${url}`);
    console.log('Request body:', body);

    return next.handle().pipe(
      tap(response => {
        console.log('\n=== ODPOWIEDŹ ===');
        console.log('Response:', response);
        console.log('Odpowiedź:', response?.answer);
        console.log('=== INTERCEPTOR END ===\n');
      }),
    );
  }
} 