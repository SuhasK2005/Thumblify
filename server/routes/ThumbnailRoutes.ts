import express from 'express';
import { deleteThumbnail, generateThumbnail } from '../controllers/ThumbnailController.js';
import  isAuth  from '../middlewares/Auth.js';

const ThumbnailRouter = express.Router();

ThumbnailRouter.post('/generate', isAuth, generateThumbnail)
ThumbnailRouter.delete('/delete/:id', isAuth, deleteThumbnail)

export default ThumbnailRouter;