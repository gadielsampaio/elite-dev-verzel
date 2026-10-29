import { ValidationPipe, type INestApplication } from '@nestjs/common';

export function configureTestValidation(app: INestApplication) {
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}
