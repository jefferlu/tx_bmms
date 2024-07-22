import { Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';

const fsPath = './uploads';

@Controller('api')
export class FilesController {

    @Post('upload')
    @UseInterceptors(FileInterceptor('file', {
        storage: diskStorage({
            destination: fsPath,
            filename: (req, file, callback) => { callback(null, file.originalname) }
        })
    }))
    async uploadFile(@UploadedFile() file: Express.Multer.File) {
        // console.log('file', file)
    }
}
