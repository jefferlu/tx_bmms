import * as express from 'express';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { IoAdapter } from '@nestjs/platform-socket.io';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    // Swagger 
    const config = new DocumentBuilder()
        .setTitle('BIM Model Management System API')
        .setDescription('The BMMS API description')
        .setVersion('1.0')
        .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document);

    // Socket
    app.useWebSocketAdapter(new IoAdapter(app));

    // Static
    app.use('/downloads', express.static('downloads'));
    
    app.enableCors();
    await app.listen(3000,'0.0.0.0');
}
bootstrap();
