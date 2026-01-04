import express from 'express';
import { deleteThumbnail, generateThumbnail } from '../controllers/ThumbnailController.js';
import  isAuth  from '../middlewares/Auth.js';
import protect from '../middlewares/Auth.js';

const ThumbnailRouter = express.Router();

ThumbnailRouter.post('/generate', isAuth, protect, generateThumbnail)
ThumbnailRouter.delete('/delete/:id', isAuth, protect, deleteThumbnail)

export default ThumbnailRouter;