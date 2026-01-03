import express from 'express';
import { getThumbnailById, getUserThumbnails } from '../controllers/UserController.js';

const UserRouter = express.Router();

UserRouter.get('/thumbnails', getUserThumbnails)
UserRouter.get('/thumbnail/:id', getThumbnailById)

export default UserRouter;
