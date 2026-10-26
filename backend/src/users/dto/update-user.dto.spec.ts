import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { UpdateUserDto } from './update-user.dto.js';

describe('UpdateUserDto validation', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });
  const metadata = { type: 'body' as const, metatype: UpdateUserDto };

  it.each([{}, { name: 'Updated Name' }, { email: 'updated@example.com' }])(
    'accepts partial update %j',
    async (body) => {
      await expect(pipe.transform(body, metadata)).resolves.toMatchObject(body);
    },
  );

  it.each([
    { name: null },
    { email: null },
    { name: '' },
    { name: 123 },
    { email: 'invalid' },
    { role: 'admin' },
    { passwordHash: 'must-not-be-writable' },
  ])('rejects invalid update %j', async (body) => {
    await expect(pipe.transform(body, metadata)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
